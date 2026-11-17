import { NextResponse } from "next/server";
import { createReading, getReadings } from "@/lib/services/sensors";
import { getRecentLiveReadings } from "@/lib/services/latestSensorData";
import { evaluateRoomReading } from "@/lib/services/alerts";
import { requireAuth } from "@/lib/authGuard";

export async function GET(req: Request) {
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const room_id = searchParams.get("room_id") || undefined;
    const limit = parseInt(searchParams.get("limit") || "50");
    if (room_id) {
      const readings = await getReadings(room_id, limit);
      return NextResponse.json(readings);
    }
    const readings = await getRecentLiveReadings(limit);
    return NextResponse.json(readings);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch readings" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const reading = await createReading(body);

    if (body.room_id) {
      await evaluateRoomReading({
        room_id: body.room_id,
        node_id: body.node_id ?? null,
        temperature_c: body.temperature_c ?? null,
        noise_db: body.noise_db ?? null,
        light_lux: body.light_lux ?? null,
        is_occupied: body.occupancy_detected ?? body.pir_motion ?? null,
        ghost_cooling_suspected: body.ghost_cooling_suspected ?? null,
      });
    }

    return NextResponse.json(reading, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to create reading" },
      { status: 500 }
    );
  }
}
