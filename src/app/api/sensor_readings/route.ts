import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { evaluateRoomReading } from "@/lib/services/alerts";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { room_id, temp, humidity, noise_level, is_occupied, light_status } = body;

    if (!room_id) {
      return NextResponse.json(
        { error: "room_id is required from the ESP32" },
        { status: 400 }
      );
    }

    // Insert reading into tracking table without checking for user auth (service role used)
    const { data, error } = await supabase
      .from("sensor_readings")
      .insert([
        {
          room_id,
          temp,
          humidity,
          noise_level,
          is_occupied,
          light_status,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Supabase insert error (sensor_readings):", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Keep room_status in sync for dashboard / rooms list (live snapshot)
    const occupancy =
      is_occupied === true ? "OCCUPIED" : is_occupied === false ? "EMPTY" : null;
    const ghostCooling =
      is_occupied === false && light_status === true ? true : false;

    if (occupancy) {
      const { error: statusError } = await supabase.from("room_status").upsert(
        {
          room_id,
          occupancy,
          temperature_c: temp != null ? Number(temp) : null,
          noise_db: noise_level != null ? Number(noise_level) : null,
          light_lux: light_status != null ? (light_status ? 500 : 0) : null,
          ghost_cooling_active: ghostCooling,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "room_id" }
      );
      if (statusError) {
        console.error("room_status upsert error:", statusError);
      }
    }

    // Automatically evaluate IoT alert rules & auto-resolve cleared conditions
    const triggeredAlerts = await evaluateRoomReading({
      room_id,
      temperature_c: temp != null ? Number(temp) : null,
      humidity: humidity != null ? Number(humidity) : null,
      noise_db: noise_level != null ? Number(noise_level) : null,
      is_occupied: typeof is_occupied === "boolean" ? is_occupied : null,
      light_status: typeof light_status === "boolean" ? light_status : null,
      ghost_cooling_suspected: ghostCooling,
    });

    return NextResponse.json(
      { success: true, data, alerts_triggered: triggeredAlerts.length },
      { status: 201 }
    );
  } catch (err) {
    console.error("Error processing sensor reading:", err);
    return NextResponse.json(
      { error: "Invalid sensor data payload" },
      { status: 400 }
    );
  }
}
