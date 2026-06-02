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
    let occupiedCount = 0;
    let validOccupancyCount = 0;
    let totalNoise = 0;
    let noiseCount = 0;

    // Aggregate by Room
    const roomStats: Record<string, { rName: string; occupied: number; totalOcc: number; }> = {};
    
    // Initialize stats for ALL rooms so they appear on the chart
    rooms?.forEach(r => {
      roomStats[r.room_id] = { rName: r.name || 'Unknown Room', occupied: 0, totalOcc: 0 };
    });

    readings?.forEach((r) => {
      if (typeof r.temp === "number") {
         totalTemp += r.temp;
         tempCount++;
      } else if (r.temp != null) {
         const parsed = parseFloat(r.temp);
         if (!isNaN(parsed)) { totalTemp += parsed; tempCount++; }
      }
      if (r.noise_level != null) {
         const noise = typeof r.noise_level === "number" ? r.noise_level : parseFloat(r.noise_level);
         if (!isNaN(noise)) { totalNoise += noise; noiseCount++; }
      }
      if (r.is_occupied !== null) {
         if (r.is_occupied) occupiedCount++;
         validOccupancyCount++;
      }

      // Group by room
      if (r.room_id && roomStats[r.room_id]) {
        if (r.is_occupied !== null) {
           if (r.is_occupied) roomStats[r.room_id].occupied++;
           roomStats[r.room_id].totalOcc++;
        }
      }
    });

    const avgTemperature = tempCount > 0 ? +(totalTemp / tempCount).toFixed(1) : 0;
    const occupancyRate = validOccupancyCount > 0 ? +((occupiedCount / validOccupancyCount) * 100).toFixed(1) : 0;
    const avgNoiseLevel = noiseCount > 0 ? +(totalNoise / noiseCount).toFixed(1) : 0;

    const roomStatsArr = Object.values(roomStats)
      .map(r => ({
        name: r.rName,
        occupancy: r.totalOcc > 0 ? +((r.occupied / r.totalOcc) * 100).toFixed(1) : 0
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({
       avgTemperature,
       occupancyRate,
       avgNoiseLevel,
       totalRoomsMonitored: rooms?.length || 0,
       roomStats: roomStatsArr
    });

  } catch {
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}
