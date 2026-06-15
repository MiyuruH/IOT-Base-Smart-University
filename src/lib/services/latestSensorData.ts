import { supabase } from "@/lib/supabase";

/** Readings older than this are not used for live occupancy/status tiles */
export const LIVE_DATA_MAX_AGE_MS = 5 * 60 * 1000;

export type LatestRoomSnapshot = {
  room_id: string;
  temperature_c: number | null;
  occupancy_detected: boolean | null;
  noise_db: number | null;
  light_lux: number | null;
  ghost_cooling_suspected: boolean | null;
  humidity: number | null;
  light_status: boolean | null;
  created_at: string;
  source: "readings" | "sensor_readings";
};

export function isLiveSnapshot(
  snapshot: LatestRoomSnapshot | undefined,
  maxAgeMs = LIVE_DATA_MAX_AGE_MS
): boolean {
  if (!snapshot?.created_at) return false;
  return Date.now() - new Date(snapshot.created_at).getTime() <= maxAgeMs;
}

export function occupancyLabel(
  detected: boolean | null | undefined,
  fallback?: string | null
): "OCCUPIED" | "EMPTY" | null {
  if (detected === true) return "OCCUPIED";
  if (detected === false) return "EMPTY";
  return fallback === "OCCUPIED" || fallback === "EMPTY" ? fallback : null;
}

function parseNum(value: unknown): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isNaN(n) ? null : n;
}

function pickNewer(
  current: LatestRoomSnapshot | undefined,
  candidate: LatestRoomSnapshot
): LatestRoomSnapshot {
  if (!current) return candidate;
  const curTs = new Date(current.created_at).getTime();
  const candTs = new Date(candidate.created_at).getTime();
  return candTs >= curTs ? candidate : current;
}

/**
 * Latest reading per room from both `readings` (simulator/nodes) and
 * `sensor_readings` (ESP32), choosing whichever is newest.
 */
export async function getLatestByRoom(
  roomIds: string[]
): Promise<Record<string, LatestRoomSnapshot>> {
  if (roomIds.length === 0) return {};

  const [readingsRes, sensorRes] = await Promise.all([
    supabase
      .from("readings")
      .select(
        "room_id, temperature_c, occupancy_detected, noise_db, light_lux, ghost_cooling_suspected, created_at"
      )
      .in("room_id", roomIds)
      .order("created_at", { ascending: false }),
    supabase
      .from("sensor_readings")
      .select(
        "room_id, temp, humidity, noise_level, is_occupied, light_status, created_at"
      )
      .in("room_id", roomIds)
      .order("created_at", { ascending: false }),
  ]);

  if (readingsRes.error) throw readingsRes.error;
  if (sensorRes.error) throw sensorRes.error;

  const latestByRoom: Record<string, LatestRoomSnapshot> = {};

  for (const r of readingsRes.data || []) {
    if (!r.room_id) continue;
    const snapshot: LatestRoomSnapshot = {
      room_id: r.room_id,
      temperature_c: r.temperature_c ?? null,
      occupancy_detected: r.occupancy_detected ?? null,
      noise_db: r.noise_db ?? null,
      light_lux: r.light_lux ?? null,
      ghost_cooling_suspected: r.ghost_cooling_suspected ?? null,
      humidity: null,
      light_status: null,
      created_at: r.created_at,
      source: "readings",
    };
    latestByRoom[r.room_id] = pickNewer(latestByRoom[r.room_id], snapshot);
  }

  for (const sr of sensorRes.data || []) {
    if (!sr.room_id) continue;
    const temp = parseNum(sr.temp);
    const noise = parseNum(sr.noise_level);
    const snapshot: LatestRoomSnapshot = {
      room_id: sr.room_id,
      temperature_c: temp,
      occupancy_detected: sr.is_occupied ?? null,
      noise_db: noise,
      light_lux: sr.light_status != null ? (sr.light_status ? 500 : 0) : null,
      ghost_cooling_suspected:
        sr.is_occupied === false && sr.light_status === true ? true : null,
      humidity: parseNum(sr.humidity),
      light_status: sr.light_status ?? null,
      created_at: sr.created_at,
      source: "sensor_readings",
    };
    latestByRoom[sr.room_id] = pickNewer(latestByRoom[sr.room_id], snapshot);
  }

  return latestByRoom;
}

export function buildLiveRoomStatus(
  base: Record<string, unknown> | null | undefined,
  latest: LatestRoomSnapshot | undefined
) {
  const status = base || {};
  if (!latest || !isLiveSnapshot(latest)) {
    return {
      ...status,
      occupancy: null,
      temperature_c: null,
      noise_db: null,
      light_lux: null,
      ghost_cooling_active: status.ghost_cooling_active ?? null,
      last_sensor_reading_at: latest?.created_at ?? null,
      is_stale: true,
    };
  }

  const occupancy = occupancyLabel(
    latest.occupancy_detected,
    typeof status.occupancy === "string" ? status.occupancy : null
  );

  return {
    ...status,
    occupancy,
    temperature_c: latest.temperature_c ?? status.temperature_c ?? null,
    noise_db: latest.noise_db ?? status.noise_db ?? null,
    light_lux: latest.light_lux ?? status.light_lux ?? null,
    ghost_cooling_active:
      latest.ghost_cooling_suspected === true ||
      (latest.occupancy_detected === false && latest.light_status === true)
        ? true
        : latest.ghost_cooling_suspected === false
          ? false
          : (status.ghost_cooling_active ?? null),
    last_sensor_reading_at: latest.created_at,
    is_stale: false,
  };
}

/** Recent rows for dashboard feed (ESP32 + simulator), newest first */
export async function getRecentLiveReadings(limit = 10) {
  const [readingsRes, sensorRes] = await Promise.all([
    supabase
      .from("readings")
      .select(
        "reading_id, node_id, room_id, temperature_c, noise_db, light_lux, occupancy_detected, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(limit * 3),
    supabase
      .from("sensor_readings")
      .select("id, room_id, temp, noise_level, light_status, is_occupied, created_at")
      .order("created_at", { ascending: false })
      .limit(limit * 3),
  ]);

  if (readingsRes.error) throw readingsRes.error;
  if (sensorRes.error) throw sensorRes.error;

  const normalized = [
    ...(readingsRes.data || []).map((r) => ({
      reading_id: r.reading_id,
      node_id: r.node_id || "Sensor node",
      room_id: r.room_id,
      temperature_c: r.temperature_c,
      noise_db: r.noise_db,
      light_lux: r.light_lux,
      occupancy_detected: r.occupancy_detected,
      created_at: r.created_at,
    })),
    ...(sensorRes.data || []).map((sr) => ({
      reading_id: `esp32-${sr.id}`,
      node_id: "ESP32",
      room_id: sr.room_id,
      temperature_c: parseNum(sr.temp),
      noise_db: parseNum(sr.noise_level),
      light_lux: sr.light_status != null ? (sr.light_status ? 500 : 0) : null,
      occupancy_detected: sr.is_occupied,
      created_at: sr.created_at,
    })),
  ];

  return normalized
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    .slice(0, limit);
}
