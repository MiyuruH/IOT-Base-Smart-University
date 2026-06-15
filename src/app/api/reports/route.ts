import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/authGuard";
import {
  buildLiveRoomStatus,
  getLatestByRoom,
} from "@/lib/services/latestSensorData";

export async function GET(req: Request) {
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") || "json";
    const category = searchParams.get("category") || "all"; // all, buildings, rooms, alerts, sensors
    const buildingId = searchParams.get("building_id") || null;
    const roomType = searchParams.get("room_type") || null; // HALL, LAB, OFFICE
    const timeRange = searchParams.get("range") || "all"; // 24h, 7d, 30d, all

    // Compute time filter
    let timeFilter: string | null = null;
    if (timeRange !== "all") {
      let hoursAgo = 24;
      if (timeRange === "7d") hoursAgo = 24 * 7;
      if (timeRange === "30d") hoursAgo = 24 * 30;
      timeFilter = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
    }

    let buildings: any[] | null = null;
    let rooms: any[] | null = null;
    let alerts: any[] | null = null;
    let sensors: any[] | null = null;
    let readings: any[] | null = null;

    // ----- BUILDINGS REPORT -----
    if (category === "buildings" || category === "all") {
      let buildingsQuery = supabase
        .from("buildings")
        .select("*, floors(floor_id, level, name), rooms(room_id, name, code, type)");
      if (buildingId) buildingsQuery = buildingsQuery.eq("building_id", buildingId);
      const { data, error } = await buildingsQuery;
      if (error) throw error;
      buildings = data;
    }

    // ----- ROOMS REPORT -----
    if (category === "rooms" || category === "all") {
      let roomsQuery = supabase
        .from("rooms")
        .select("*, room_status(*), sensor_nodes(node_id, device_name, is_active, last_seen_at)");
      if (buildingId) roomsQuery = roomsQuery.eq("building_id", buildingId);
      if (roomType) roomsQuery = roomsQuery.eq("type", roomType);
      const { data, error } = await roomsQuery;
      if (error) throw error;

      if (data && data.length > 0) {
        const roomIds = data.map((r: { room_id: string }) => r.room_id);
        const latestByRoom = await getLatestByRoom(roomIds);

        rooms = data.map((room: { room_id: string; room_status: unknown }) => {
          const status = Array.isArray(room.room_status)
            ? room.room_status[0]
            : room.room_status;
          const merged = buildLiveRoomStatus(
            status as Record<string, unknown> | undefined,
            latestByRoom[room.room_id]
          );
          return {
            ...room,
            room_status: merged,
          };
        });
      } else {
        rooms = data;
      }
    }

    // ----- ALERTS REPORT -----
    if (category === "alerts" || category === "all") {
      let alertsQuery = supabase
        .from("anomalies")
        .select("*, rooms(name, code)")
        .order("start_at", { ascending: false });
      if (buildingId) {
        const { data: buildingRooms } = await supabase
          .from("rooms")
          .select("room_id")
          .eq("building_id", buildingId);
        if (buildingRooms && buildingRooms.length > 0) {
          alertsQuery = alertsQuery.in("room_id", buildingRooms.map(r => r.room_id));
        }
      }
      if (timeFilter) alertsQuery = alertsQuery.gte("start_at", timeFilter);
      const { data, error } = await alertsQuery;
      if (error) throw error;
      alerts = data;
    }

    // ----- SENSORS REPORT -----
    if (category === "sensors" || category === "all") {
      const sensorsQuery = supabase
        .from("sensor_nodes")
        .select("*, rooms(name, code, building_id)");
      const { data, error } = await sensorsQuery;
      if (error) throw error;
      sensors = data;

      // Filter sensors by building if needed
      if (buildingId && sensors) {
        sensors = sensors.filter((s: any) => s.rooms?.building_id === buildingId);
      }
    }

    // ----- READINGS SUMMARY (from both readings AND sensor_readings tables) -----
    if (category === "rooms" || category === "all") {
      // Fetch from 'readings' table
      let readingsQuery = supabase
        .from("readings")
        .select("room_id, temperature_c, occupancy_detected, created_at")
        .order("created_at", { ascending: false })
        .limit(5000);
      if (timeFilter) readingsQuery = readingsQuery.gte("created_at", timeFilter);
      const { data: readingsData, error: readingsErr } = await readingsQuery;
      if (readingsErr) throw readingsErr;

      // Fetch from 'sensor_readings' table (ESP32 data)
      let sensorQuery = supabase
        .from("sensor_readings")
        .select("room_id, temp, is_occupied, created_at")
        .order("created_at", { ascending: false })
        .limit(5000);
      if (timeFilter) sensorQuery = sensorQuery.gte("created_at", timeFilter);
      const { data: sensorData, error: sensorErr } = await sensorQuery;
      if (sensorErr) throw sensorErr;

      // Normalize sensor_readings to the same shape as readings
      // Note: Supabase returns 'numeric' columns as strings, so we must parseFloat
      const normalizedSensor = (sensorData || []).map((sr: any) => {
        const parsedTemp = sr.temp != null ? parseFloat(sr.temp) : NaN;
        return {
          room_id: sr.room_id,
          temperature_c: !isNaN(parsedTemp) ? parsedTemp : null,
          occupancy_detected: sr.is_occupied,
          created_at: sr.created_at,
        };
      });

      // Combine both sources
      readings = [...(readingsData || []), ...normalizedSensor];
    }

    // Build the report data object
    const reportData: any = {
      generatedAt: new Date().toISOString(),
      filters: { category, buildingId, roomType, timeRange },
    };

    if (buildings) reportData.buildings = buildings;
    if (rooms) reportData.rooms = rooms;
    if (alerts) reportData.alerts = alerts;
    if (sensors) reportData.sensors = sensors;

    // Historical aggregations only when a time range is selected (not for live status)
    if (rooms && readings && timeRange !== "all") {
      const roomAggregations: Record<string, any> = {};
      readings.forEach((r: any) => {
        if (!r.room_id) return;
        if (!roomAggregations[r.room_id]) {
          roomAggregations[r.room_id] = {
            totalReadings: 0,
            totalTemp: 0,
            tempCount: 0,
            occupiedCount: 0,
            totalOccupancy: 0,
          };
        }
        const agg = roomAggregations[r.room_id];
        agg.totalReadings++;
        if (typeof r.temperature_c === "number") {
          agg.totalTemp += r.temperature_c;
          agg.tempCount++;
        }
        if (r.occupancy_detected !== null) {
          if (r.occupancy_detected) agg.occupiedCount++;
          agg.totalOccupancy++;
        }
      });

      // Attach aggregations to rooms
      reportData.rooms = rooms.map((room: any) => {
        const agg = roomAggregations[room.room_id];
        return {
          ...room,
          stats: agg
            ? {
                totalReadings: agg.totalReadings,
                avgTemperature: agg.tempCount > 0 ? +(agg.totalTemp / agg.tempCount).toFixed(1) : null,
                occupancyRate: agg.totalOccupancy > 0 ? +((agg.occupiedCount / agg.totalOccupancy) * 100).toFixed(1) : null,
              }
            : { totalReadings: 0, avgTemperature: null, occupancyRate: null },
        };
      });
    }

    // ----- CSV FORMAT -----
    if (format === "csv") {
      const date = new Date().toISOString().split("T")[0];

      if (category === "buildings" && buildings) {
        let csv = "Building Name,Address,Floors,Rooms,Created At\n";
        buildings.forEach((b: any) => {
          csv += [
            `"${b.name || ""}"`,
            `"${b.address || ""}"`,
            b.floors?.length || 0,
            b.rooms?.length || 0,
            b.created_at || "",
          ].join(",") + "\n";
        });
        return csvResponse(csv, `navsense-buildings-report-${date}.csv`);
      }

      if (category === "rooms" && reportData.rooms) {
        let csv = "Room Name,Room Code,Type,Building ID,Occupied,Temperature (°C),Avg Temp,Occupancy Rate (%),Total Readings,Ghost Cooling,Sensors Count\n";
        reportData.rooms.forEach((r: any) => {
          const status = r.room_status || {};
          csv += [
            `"${r.name || ""}"`,
            `"${r.code || ""}"`,
            r.type || "",
            r.building_id || "",
            status.occupancy === "OCCUPIED" ? "Yes" : "No",
            status.temperature_c ?? "",
            r.stats?.avgTemperature ?? "",
            r.stats?.occupancyRate ?? "",
            r.stats?.totalReadings ?? 0,
            status.ghost_cooling_active ? "Yes" : "No",
            r.sensor_nodes?.length || 0,
          ].join(",") + "\n";
        });
        return csvResponse(csv, `navsense-rooms-report-${date}.csv`);
      }

      if (category === "alerts" && alerts) {
        let csv = "Type,Severity,Room,Message,Active,Started At,Ended At\n";
        alerts.forEach((a: any) => {
          csv += [
            a.type || "",
            a.severity || "",
            `"${a.rooms?.name || ""}"`,
            `"${(a.message || "").replace(/"/g, '""')}"`,
            a.is_active ? "Active" : "Resolved",
            a.start_at || "",
            a.end_at || "",
          ].join(",") + "\n";
        });
        return csvResponse(csv, `navsense-alerts-report-${date}.csv`);
      }

      if (category === "sensors" && sensors) {
        let csv = "Node ID,Device Name,Room,Active,Firmware,WiFi MAC,Last Seen\n";
        sensors.forEach((s: any) => {
          csv += [
            s.node_id || "",
            `"${s.device_name || ""}"`,
            `"${s.rooms?.name || ""}"`,
            s.is_active ? "Yes" : "No",
            s.firmware_version || "",
            s.wifi_mac || "",
            s.last_seen_at || "",
          ].join(",") + "\n";
        });
        return csvResponse(csv, `navsense-sensors-report-${date}.csv`);
      }

      // "all" category — comprehensive rooms CSV (backward compatible)
      let csv = "Room Name,Room Code,Type,Building ID,Occupied,Temperature,Ghost Cooling Active\n";
      (reportData.rooms || []).forEach((r: any) => {
        const status = r.room_status || {};
        csv += [
          `"${r.name || ""}"`,
          `"${r.code || ""}"`,
          r.type || "",
          r.building_id,
          status.occupancy === "OCCUPIED" ? "Yes" : "No",
          status.temperature_c ?? "",
          status.ghost_cooling_active ? "Yes" : "No",
        ].join(",") + "\n";
      });
      return csvResponse(csv, `navsense-full-report-${date}.csv`);
    }

    // Default JSON
    return NextResponse.json(reportData);

  } catch {
    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 }
    );
  }
}

function csvResponse(csv: string, filename: string) {
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
