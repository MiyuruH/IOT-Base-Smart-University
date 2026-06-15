import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/authGuard";

export async function GET(req: Request) {
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const timeRange = searchParams.get("range") || "24h"; // e.g., 24h, 7d, 30d, all
    
    let hoursAgo = 24;
    if (timeRange === "7d") hoursAgo = 24 * 7;
    if (timeRange === "30d") hoursAgo = 24 * 30;
    
    let query = supabase
      .from("sensor_readings")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5000); // Fetch up to 5000 recent readings for better accuracy

    // Apply time filter if not 'all'
    if (timeRange !== "all") {
      const pastDate = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
      query = query.gte("created_at", pastDate);
    }

    const { data: readings, error: readingsError } = await query;

    if (readingsError) throw readingsError;

    const { data: rooms, error: roomsError } = await supabase
      .from("rooms")
      .select("room_id, name, building_id");

    if (roomsError) throw roomsError;

    const { data: buildings, error: buildingsError } = await supabase
      .from("buildings")
      .select("building_id, name");

    if (buildingsError) throw buildingsError;

    let totalTemp = 0;
    let tempCount = 0;
    let totalNoise = 0;
    let noiseCount = 0;
    
    let healthyEnvCount = 0;
    let envCheckCount = 0;

    const activeRoomsSet = new Set<string>();

    // Aggregate by Room
    const roomStats: Record<string, { rName: string; occupied: number; totalOcc: number; }> = {};
    
    // Time Series Aggregation
    const timeSeries: Record<string, { tempSum: number, tempCount: number, noiseSum: number, noiseCount: number, occupiedRooms: Set<string> }> = {};

    // Initialize stats for ALL rooms so they appear on the chart
    rooms?.forEach(r => {
      roomStats[r.room_id] = { rName: r.name || 'Unknown Room', occupied: 0, totalOcc: 0 };
    });

    readings?.forEach((r) => {
      if (r.room_id) activeRoomsSet.add(r.room_id);

      const parsedTemp = typeof r.temp === "number" ? r.temp : parseFloat(r.temp);
      const tempValid = !isNaN(parsedTemp) && parsedTemp != null;
      if (tempValid) {
         totalTemp += parsedTemp;
         tempCount++;
      }
      
      const parsedNoise = typeof r.noise_level === "number" ? r.noise_level : parseFloat(r.noise_level);
      const noiseValid = !isNaN(parsedNoise) && parsedNoise != null;
      if (noiseValid) {
         totalNoise += parsedNoise;
         noiseCount++;
      }
      
      if (tempValid && noiseValid) {
         envCheckCount++;
         if (parsedTemp >= 20 && parsedTemp <= 25 && parsedNoise <= 60) {
            healthyEnvCount++;
         }
      }

      // Group by room
      if (r.room_id && roomStats[r.room_id]) {
        if (r.is_occupied !== null) {
           if (r.is_occupied) roomStats[r.room_id].occupied++;
           roomStats[r.room_id].totalOcc++;
        }
      }
      
      // Time Series
      const date = new Date(r.created_at);
      let timeKey = "";
      if (timeRange === "24h") {
         timeKey = `${date.getHours().toString().padStart(2, '0')}:00`;
      } else {
         timeKey = `${date.getMonth() + 1}/${date.getDate()}`;
      }
      
      if (!timeSeries[timeKey]) {
         timeSeries[timeKey] = { tempSum: 0, tempCount: 0, noiseSum: 0, noiseCount: 0, occupiedRooms: new Set() };
      }
      
      if (tempValid) {
         timeSeries[timeKey].tempSum += parsedTemp;
         timeSeries[timeKey].tempCount++;
      }
      if (noiseValid) {
         timeSeries[timeKey].noiseSum += parsedNoise;
         timeSeries[timeKey].noiseCount++;
      }
      if (r.is_occupied) {
         timeSeries[timeKey].occupiedRooms.add(r.room_id);
      }
    });

    const avgTemperature = tempCount > 0 ? +(totalTemp / tempCount).toFixed(1) : 0;
    const envHealthScore = envCheckCount > 0 ? +((healthyEnvCount / envCheckCount) * 100).toFixed(1) : 0;
    const avgNoiseLevel = noiseCount > 0 ? +(totalNoise / noiseCount).toFixed(1) : 0;

    const roomStatsArr = Object.values(roomStats)
      .map(r => ({
        name: r.rName,
        occupancy: r.totalOcc > 0 ? +((r.occupied / r.totalOcc) * 100).toFixed(1) : 0
      }))
      .sort((a, b) => b.occupancy - a.occupancy);

    let peakOccupancy = 0;
    // Map timeSeries to array
    const trendsArr = Object.entries(timeSeries).map(([time, data]) => {
      const peak = data.occupiedRooms.size;
      if (peak > peakOccupancy) peakOccupancy = peak;
      return {
        time,
        temp: data.tempCount > 0 ? +(data.tempSum / data.tempCount).toFixed(1) : null,
        noise: data.noiseCount > 0 ? +(data.noiseSum / data.noiseCount).toFixed(1) : null,
        peakOccupancy: peak
      };
    });
    
    // Sort trends chronologically
    trendsArr.reverse();

    return NextResponse.json({
       avgTemperature,
       envHealthScore,
       avgNoiseLevel,
       totalRoomsMonitored: rooms?.length || 0,
       activeRoomsCount: activeRoomsSet.size,
       peakOccupancy,
       roomStats: roomStatsArr,
       trends: trendsArr
    });

  } catch {
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}
