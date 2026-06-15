import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // We expect the ESP32 to send:
    // {
    //   "room_id": "Rajarata_Uni/Building_A/Room_101",
    //   "temp": 28.5,
    //   "humidity": 60.2,
    //   "noise_level": 55.4,
    //   "is_occupied": true,
    //   "light_status": true
    // }
    
    const { room_id, temp, humidity, noise_level, is_occupied, light_status } = body;

    if (!room_id) {
      return NextResponse.json({ error: "room_id is required from the ESP32" }, { status: 400 });
    }

    // Insert reading into tracking table without checking for user auth (service role used)
    const { data, error } = await supabase
      .from("sensor_readings")
      .insert([{
        room_id,
        temp,
        humidity,
        noise_level,
        is_occupied,
        light_status,
      }])
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

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (err: any) {
    console.error("Error processing sensor reading:", err);
    return NextResponse.json({ error: "Invalid sensor data payload" }, { status: 400 });
  }
}
