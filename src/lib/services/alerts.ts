import { supabase } from "@/lib/supabase";
import {
  getLatestByRoom,
  type LatestRoomSnapshot,
} from "@/lib/services/latestSensorData";
import {
  getAlertSettings,
  getDefaultThresholdForType,
  SYSTEM_SETTINGS_MARKER,
} from "@/lib/services/alertSettings";

export type AlertType =
  | "GHOST_COOLING"
  | "HIGH_TEMP"
  | "SENSOR_OFFLINE"
  | "HIGH_NOISE"
  | "HIGH_HUMIDITY";

export type AlertSeverity = "LOW" | "MEDIUM" | "HIGH";

export interface NormalizedAnomaly {
  anomaly_id: string;
  type: AlertType | string;
  db_type?: string;
  room_id: string | null;
  node_id: string | null;
  severity: AlertSeverity;
  message: string;
  threshold_value: number | null;
  measured_value: number | null;
  unit: string | null;
  recommendation?: string;
  start_at: string;
  end_at: string | null;
  is_active: boolean;
  rooms?: { name: string; code: string } | null;
}

const TYPE_PREFIX_REGEX = /^\[(HIGH_NOISE|HIGH_HUMIDITY)\]\s*/;
const META_PREFIX_REGEX = /^\[META:(\{[^\]]+\})\]\s*/;

interface AlertMetaTag {
  t?: string;
  th?: number | null;
  val?: number | null;
  u?: string | null;
}

function encodeAlertMessage(params: {
  cleanMessage: string;
  type?: string;
  includeTypeInMeta?: boolean;
  threshold_value?: number | null;
  measured_value?: number | null;
  unit?: string | null;
}): string {
  const {
    cleanMessage,
    type,
    includeTypeInMeta,
    threshold_value,
    measured_value,
    unit,
  } = params;

  const hasMeta =
    includeTypeInMeta ||
    threshold_value != null ||
    measured_value != null ||
    Boolean(unit);

  if (!hasMeta) return cleanMessage;

  const meta: AlertMetaTag = {};
  if (includeTypeInMeta && type) meta.t = type;
  if (threshold_value != null && !Number.isNaN(Number(threshold_value))) {
    meta.th = Number(threshold_value);
  }
  if (measured_value != null && !Number.isNaN(Number(measured_value))) {
    meta.val = Number(measured_value);
  }
  if (unit) meta.u = unit;

  if (Object.keys(meta).length === 0) return cleanMessage;
  return `[META:${JSON.stringify(meta)}] ${cleanMessage}`;
}

export function stripPrefixes(msg: string): string {
  return (msg || "")
    .replace(META_PREFIX_REGEX, "")
    .replace(TYPE_PREFIX_REGEX, "")
    .trim();
}

export function getAlertRecommendation(type: string): string {
  switch (type) {
    case "GHOST_COOLING":
      return "Room is unoccupied while utilities (lights/AC) are active. Turn off utilities to prevent energy waste.";
    case "HIGH_TEMP":
      return "Check HVAC cooling settings and room ventilation immediately.";
    case "HIGH_NOISE":
      return "Acoustic threshold exceeded. Inspect room for unusual disturbance or equipment noise.";
    case "HIGH_HUMIDITY":
      return "Verify dehumidifier and air circulation to maintain optimal indoor comfort.";
    case "SENSOR_OFFLINE":
      return "Verify ESP32 node power supply, Wi-Fi signal strength, and server endpoint configuration.";
    default:
      return "Inspect the room and connected IoT sensor node.";
  }
}

export function normalizeAnomaly(raw: Record<string, any>): NormalizedAnomaly {
  let effectiveType: string = raw.type || "HIGH_TEMP";
  let cleanMessage: string = raw.message || "";
  let threshold_value: number | null =
    raw.threshold_value != null ? Number(raw.threshold_value) : null;
  let measured_value: number | null =
    raw.measured_value != null ? Number(raw.measured_value) : null;
  let unit: string | null = raw.unit ?? null;

  const metaMatch = cleanMessage.match(META_PREFIX_REGEX);
  if (metaMatch) {
    try {
      const parsed: AlertMetaTag = JSON.parse(metaMatch[1]);
      if (parsed.t) effectiveType = parsed.t;
      if (parsed.th !== undefined) threshold_value = parsed.th;
      if (parsed.val !== undefined) measured_value = parsed.val;
      if (parsed.u !== undefined) unit = parsed.u;
    } catch {
      // ignore malformed meta tag
    }
    cleanMessage = cleanMessage.replace(META_PREFIX_REGEX, "");
  }

  const typeMatch = cleanMessage.match(TYPE_PREFIX_REGEX);
  if (typeMatch) {
    effectiveType = typeMatch[1];
    cleanMessage = cleanMessage.replace(TYPE_PREFIX_REGEX, "");
  }

  return {
    anomaly_id: raw.anomaly_id,
    type: effectiveType,
    db_type: raw.type,
    room_id: raw.room_id ?? null,
    node_id: raw.node_id ?? null,
    severity: (raw.severity as AlertSeverity) || "MEDIUM",
    message: cleanMessage,
    threshold_value,
    measured_value,
    unit,
    recommendation: getAlertRecommendation(effectiveType),
    start_at: raw.start_at || new Date().toISOString(),
    end_at: raw.end_at ?? null,
    is_active: Boolean(raw.is_active),
    rooms: raw.rooms ?? null,
  };
}

export function isSystemSettingsRow(raw: Record<string, any>): boolean {
  return (
    typeof raw?.message === "string" &&
    raw.message.startsWith(SYSTEM_SETTINGS_MARKER)
  );
}

export async function getActiveAnomalies(): Promise<NormalizedAnomaly[]> {
  const { data, error } = await supabase
    .from("anomalies")
    .select("*, rooms(name, code)")
    .eq("is_active", true)
    .order("start_at", { ascending: false });

  if (error) throw error;
  return (data || [])
    .filter((r) => !isSystemSettingsRow(r))
    .map(normalizeAnomaly);
}

export async function getAllAnomalies(
  limit = 150,
  status: "active" | "resolved" | "all" = "all"
): Promise<NormalizedAnomaly[]> {
  let query = supabase
    .from("anomalies")
    .select("*, rooms(name, code)")
    .order("start_at", { ascending: false })
    .limit(limit);

  if (status === "active") {
    query = query.eq("is_active", true);
  } else if (status === "resolved") {
    query = query.eq("is_active", false);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || [])
    .filter((r) => !isSystemSettingsRow(r))
    .map(normalizeAnomaly);
}

export async function createAnomaly(input: {
  type: string;
  room_id?: string | null;
  node_id?: string | null;
  severity: string;
  message: string;
  threshold_value?: number | null;
  measured_value?: number | null;
  unit?: string | null;
}): Promise<NormalizedAnomaly> {
  const requestedType = input.type;
  const cleanMessage = stripPrefixes(input.message);

  // Fill default threshold/unit from DB settings if not explicitly passed
  let thresholdVal = input.threshold_value ?? null;
  let unitVal = input.unit ?? null;
  if (thresholdVal == null || !unitVal) {
    const settings = await getAlertSettings();
    const def = getDefaultThresholdForType(
      requestedType,
      (input.severity as AlertSeverity) || "MEDIUM",
      settings
    );
    if (thresholdVal == null && def.threshold > 0) thresholdVal = def.threshold;
    if (!unitVal && def.unit) unitVal = def.unit;
  }

  const directMessage = encodeAlertMessage({
    cleanMessage,
    type: requestedType,
    includeTypeInMeta: false,
    threshold_value: thresholdVal,
    measured_value: input.measured_value ?? null,
    unit: unitVal,
  });

  const payload = {
    type: requestedType,
    room_id: input.room_id || null,
    node_id: input.node_id || null,
    severity: input.severity,
    message: directMessage,
    start_at: new Date().toISOString(),
    is_active: true,
  };

  const { data, error } = await supabase
    .from("anomalies")
    .insert(payload)
    .select("*, rooms(name, code)")
    .single();

  if (!error && data) {
    return normalizeAnomaly(data);
  }

  // Fallback if Postgres schema has strict CHECK (type IN ('GHOST_COOLING','SENSOR_OFFLINE','HIGH_TEMP'))
  if (
    error &&
    (requestedType === "HIGH_NOISE" || requestedType === "HIGH_HUMIDITY")
  ) {
    const fallbackMessage = encodeAlertMessage({
      cleanMessage,
      type: requestedType,
      includeTypeInMeta: true,
      threshold_value: thresholdVal,
      measured_value: input.measured_value ?? null,
      unit: unitVal,
    });
    const fallbackPayload = {
      ...payload,
      type: "HIGH_TEMP",
      message: fallbackMessage,
    };
    const { data: fbData, error: fbError } = await supabase
      .from("anomalies")
      .insert(fallbackPayload)
      .select("*, rooms(name, code)")
      .single();

    if (fbError) throw fbError;
    return normalizeAnomaly(fbData);
  }

  throw error;
}

export async function updateAnomaly(
  anomaly_id: string,
  updates: {
    type?: string;
    room_id?: string | null;
    severity?: AlertSeverity;
    message?: string;
    threshold_value?: number | null;
    measured_value?: number | null;
    unit?: string | null;
    is_active?: boolean;
  }
): Promise<NormalizedAnomaly> {
  // Fetch current anomaly first
  const { data: existingRaw, error: fetchErr } = await supabase
    .from("anomalies")
    .select("*, rooms(name, code)")
    .eq("anomaly_id", anomaly_id)
    .single();

  if (fetchErr || !existingRaw) throw fetchErr || new Error("Alert not found");

  const current = normalizeAnomaly(existingRaw);
  const nextType = updates.type ?? current.type;
  const nextSeverity = updates.severity ?? current.severity;
  const nextCleanMessage =
    updates.message !== undefined
      ? stripPrefixes(updates.message)
      : current.message;
  const nextThreshold =
    updates.threshold_value !== undefined
      ? updates.threshold_value
      : current.threshold_value;
  const nextMeasured =
    updates.measured_value !== undefined
      ? updates.measured_value
      : current.measured_value;
  const nextUnit =
    updates.unit !== undefined ? updates.unit : current.unit;
  const nextActive =
    updates.is_active !== undefined ? updates.is_active : current.is_active;
  const nextRoomId =
    updates.room_id !== undefined ? updates.room_id : current.room_id;

  const isCustomType =
    nextType === "HIGH_NOISE" || nextType === "HIGH_HUMIDITY";

  const encodedMessage = encodeAlertMessage({
    cleanMessage: nextCleanMessage,
    type: nextType,
    includeTypeInMeta: isCustomType,
    threshold_value: nextThreshold,
    measured_value: nextMeasured,
    unit: nextUnit,
  });

  const dbPayload: Record<string, any> = {
    type: isCustomType ? "HIGH_TEMP" : nextType,
    room_id: nextRoomId || null,
    severity: nextSeverity,
    message: encodedMessage,
    is_active: nextActive,
    end_at: nextActive
      ? null
      : existingRaw.end_at || new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("anomalies")
    .update(dbPayload)
    .eq("anomaly_id", anomaly_id)
    .select("*, rooms(name, code)")
    .single();

  if (error) throw error;
  return normalizeAnomaly(data);
}

export async function resolveAnomaly(
  anomaly_id: string
): Promise<NormalizedAnomaly> {
  const { data, error } = await supabase
    .from("anomalies")
    .update({
      is_active: false,
      end_at: new Date().toISOString(),
    })
    .eq("anomaly_id", anomaly_id)
    .select("*, rooms(name, code)")
    .single();

  if (error) throw error;
  return normalizeAnomaly(data);
}

export async function resolveAllActiveAnomalies(
  room_id?: string
): Promise<number> {
  let query = supabase
    .from("anomalies")
    .update({
      is_active: false,
      end_at: new Date().toISOString(),
    })
    .eq("is_active", true);

  if (room_id) {
    query = query.eq("room_id", room_id);
  }

  const { data, error } = await query.select("anomaly_id");
  if (error) throw error;
  return data?.length || 0;
}

export async function deleteAnomaly(anomaly_id: string): Promise<void> {
  const { error } = await supabase
    .from("anomalies")
    .delete()
    .eq("anomaly_id", anomaly_id);

  if (error) throw error;
}

/**
 * Evaluates a live room reading against the database-stored Alert Settings thresholds,
 * creating new anomalies or auto-resolving cleared ones for that room.
 */
export async function evaluateRoomReading(params: {
  room_id: string;
  room_name?: string;
  node_id?: string | null;
  temperature_c?: number | null;
  humidity?: number | null;
  noise_db?: number | null;
  is_occupied?: boolean | null;
  light_status?: boolean | null;
  light_lux?: number | null;
  ghost_cooling_suspected?: boolean | null;
}): Promise<NormalizedAnomaly[]> {
  const { room_id } = params;
  if (!room_id) return [];

  try {
    const [settings, roomRes, activeRes] = await Promise.all([
      getAlertSettings(),
      params.room_name
        ? Promise.resolve({ data: { name: params.room_name, code: "" } })
        : supabase
            .from("rooms")
            .select("name, code")
            .eq("room_id", room_id)
            .maybeSingle(),
      supabase
        .from("anomalies")
        .select("*, rooms(name, code)")
        .eq("room_id", room_id)
        .eq("is_active", true),
    ]);

    const roomLabel =
      roomRes.data?.name ||
      (roomRes.data as { code?: string } | null)?.code ||
      `Room ${room_id.slice(0, 8)}`;

    const existingActive = (activeRes.data || [])
      .filter((r) => !isSystemSettingsRow(r))
      .map(normalizeAnomaly);
    const activeByType = new Map<string, NormalizedAnomaly>();
    for (const a of existingActive) {
      if (!activeByType.has(a.type)) {
        activeByType.set(a.type, a);
      }
    }

    const detectedConditions = new Map<
      AlertType,
      {
        severity: AlertSeverity;
        message: string;
        threshold_value: number;
        measured_value: number | null;
        unit: string;
      }
    >();

    const temp =
      params.temperature_c != null && !Number.isNaN(Number(params.temperature_c))
        ? Number(params.temperature_c)
        : null;
    const humidity =
      params.humidity != null && !Number.isNaN(Number(params.humidity))
        ? Number(params.humidity)
        : null;
    const noise =
      params.noise_db != null && !Number.isNaN(Number(params.noise_db))
        ? Number(params.noise_db)
        : null;
    const isOccupied = params.is_occupied;
    const lightOn =
      params.light_status === true ||
      (params.light_lux != null && Number(params.light_lux) > 200);

    // Condition 1: GHOST_COOLING (using DB settings)
    if (settings.ghost_cooling_enabled) {
      const isOvercooled =
        isOccupied === false &&
        temp != null &&
        temp > 0 &&
        temp < settings.ghost_cooling_temp_c;
      const isVacantLightWaste =
        settings.ghost_cooling_light_check && isOccupied === false && lightOn;
      const isGhostCooling =
        params.ghost_cooling_suspected === true ||
        isOvercooled ||
        isVacantLightWaste;

      if (isGhostCooling) {
        detectedConditions.set("GHOST_COOLING", {
          severity: isOvercooled ? "HIGH" : "MEDIUM",
          message: isOvercooled
            ? `Ghost cooling in ${roomLabel}: Room is vacant with AC cooling at ${temp!.toFixed(1)}°C (threshold < ${settings.ghost_cooling_temp_c}°C)`
            : `Energy waste in ${roomLabel}: Room is vacant while lights/utilities remain ON`,
          threshold_value: settings.ghost_cooling_temp_c,
          measured_value: temp,
          unit: "°C",
        });
      }
    }

    // Condition 2: HIGH_TEMP (using DB settings)
    if (
      settings.temp_enabled &&
      temp != null &&
      temp >= settings.temp_warning_c
    ) {
      const isCritical = temp >= settings.temp_critical_c;
      const thresholdUsed = isCritical
        ? settings.temp_critical_c
        : settings.temp_warning_c;
      detectedConditions.set("HIGH_TEMP", {
        severity: isCritical ? "HIGH" : "MEDIUM",
        message: isCritical
          ? `Critical high temperature (${temp.toFixed(1)}°C) in ${roomLabel} (threshold: ${thresholdUsed}°C)`
          : `Elevated temperature (${temp.toFixed(1)}°C) in ${roomLabel} (threshold: ${thresholdUsed}°C)`,
        threshold_value: thresholdUsed,
        measured_value: Number(temp.toFixed(1)),
        unit: "°C",
      });
    }

    // Condition 3: HIGH_NOISE (using DB settings)
    if (
      settings.noise_enabled &&
      noise != null &&
      noise >= settings.noise_warning_db
    ) {
      const isCritical = noise >= settings.noise_critical_db;
      const thresholdUsed = isCritical
        ? settings.noise_critical_db
        : settings.noise_warning_db;
      detectedConditions.set("HIGH_NOISE", {
        severity: isCritical ? "HIGH" : "MEDIUM",
        message: isCritical
          ? `Severe noise level (${noise.toFixed(0)} dB) in ${roomLabel} (threshold: ${thresholdUsed} dB)`
          : `High noise level (${noise.toFixed(0)} dB) in ${roomLabel} (threshold: ${thresholdUsed} dB)`,
        threshold_value: thresholdUsed,
        measured_value: Number(noise.toFixed(1)),
        unit: "dB",
      });
    }

    // Condition 4: HIGH_HUMIDITY (using DB settings)
    if (
      settings.humidity_enabled &&
      humidity != null &&
      humidity >= settings.humidity_warning_pct
    ) {
      const isCritical = humidity >= settings.humidity_critical_pct;
      const thresholdUsed = isCritical
        ? settings.humidity_critical_pct
        : settings.humidity_warning_pct;
      detectedConditions.set("HIGH_HUMIDITY", {
        severity: isCritical ? "HIGH" : "MEDIUM",
        message: `High humidity (${humidity.toFixed(0)}%) in ${roomLabel} (threshold: ${thresholdUsed}%)`,
        threshold_value: thresholdUsed,
        measured_value: Number(humidity.toFixed(0)),
        unit: "%",
      });
    }

    const newlyCreated: NormalizedAnomaly[] = [];

    // Resolve any active SENSOR_OFFLINE anomaly for this room when a new reading arrives
    if (settings.auto_resolve) {
      const offlineAnomaly = activeByType.get("SENSOR_OFFLINE");
      if (offlineAnomaly) {
        await resolveAnomaly(offlineAnomaly.anomaly_id);
      }

      // Auto-resolve conditions that have returned to normal
      const checkTypes: AlertType[] = [
        "GHOST_COOLING",
        "HIGH_TEMP",
        "HIGH_NOISE",
        "HIGH_HUMIDITY",
      ];
      for (const t of checkTypes) {
        const currentActive = activeByType.get(t);
        if (currentActive && !detectedConditions.has(t)) {
          await resolveAnomaly(currentActive.anomaly_id);
        }
      }
    }

    // Create new anomalies for breached conditions not currently active
    for (const [type, cond] of detectedConditions.entries()) {
      const currentActive = activeByType.get(type);
      if (!currentActive) {
        const created = await createAnomaly({
          type,
          room_id,
          node_id: params.node_id ?? null,
          severity: cond.severity,
          message: cond.message,
          threshold_value: cond.threshold_value,
          measured_value: cond.measured_value,
          unit: cond.unit,
        });
        newlyCreated.push(created);
      }
    }

    return newlyCreated;
  } catch (err) {
    console.error("Failed to evaluate room reading for alerts:", err);
    return [];
  }
}

/**
 * Scans all campus rooms and their latest snapshots against database-stored
 * alert settings to ensure anomalies are synced.
 */
export async function syncCampusAnomalies(): Promise<void> {
  try {
    const [settings, roomsRes] = await Promise.all([
      getAlertSettings(),
      supabase
        .from("rooms")
        .select("room_id, name, code, sensor_nodes(node_id, is_active)"),
    ]);

    const rooms = roomsRes.data;
    if (!rooms || rooms.length === 0) return;

    const roomIds = rooms.map((r: { room_id: string }) => r.room_id);
    const [latestByRoom, activeAnomalies] = await Promise.all([
      getLatestByRoom(roomIds),
      getActiveAnomalies(),
    ]);

    const activeByRoomAndType = new Map<string, NormalizedAnomaly>();
    for (const a of activeAnomalies) {
      if (a.room_id) {
        activeByRoomAndType.set(`${a.room_id}:${a.type}`, a);
      }
    }

    const offlineWarnMs = settings.offline_warning_min * 60 * 1000;

    for (const room of rooms) {
      const latest: LatestRoomSnapshot | undefined = latestByRoom[room.room_id];
      const roomLabel =
        room.name || room.code || `Room ${room.room_id.slice(0, 8)}`;
      const nodes = Array.isArray(room.sensor_nodes) ? room.sensor_nodes : [];
      const primaryNodeId = nodes[0]?.node_id ?? null;

      if (!latest) continue;

      const ageMs = Date.now() - new Date(latest.created_at).getTime();
      const isStale = ageMs > offlineWarnMs;

      if (isStale) {
        if (settings.offline_enabled) {
          const offlineKey = `${room.room_id}:SENSOR_OFFLINE`;
          if (!activeByRoomAndType.has(offlineKey)) {
            const minsOffline = Math.round(ageMs / 60000);
            const isCrit = minsOffline >= settings.offline_critical_min;
            const thresholdUsed = isCrit
              ? settings.offline_critical_min
              : settings.offline_warning_min;
            const timeText =
              minsOffline >= 60
                ? `${(minsOffline / 60).toFixed(1)} hours`
                : `${minsOffline} minutes`;
            await createAnomaly({
              type: "SENSOR_OFFLINE",
              room_id: room.room_id,
              node_id: primaryNodeId,
              severity: isCrit ? "HIGH" : "MEDIUM",
              message: `Sensor node in ${roomLabel} has not reported data for ${timeText} (threshold: ${thresholdUsed} min)`,
              threshold_value: thresholdUsed,
              measured_value: minsOffline,
              unit: "min",
            });
          }
        }
      } else {
        await evaluateRoomReading({
          room_id: room.room_id,
          room_name: roomLabel,
          node_id: primaryNodeId,
          temperature_c: latest.temperature_c,
          humidity: latest.humidity,
          noise_db: latest.noise_db,
          is_occupied: latest.occupancy_detected,
          light_status: latest.light_status,
          light_lux: latest.light_lux,
          ghost_cooling_suspected: latest.ghost_cooling_suspected,
        });
      }
    }
  } catch (err) {
    console.error("Failed to sync campus anomalies:", err);
  }
}
