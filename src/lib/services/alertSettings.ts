import { supabase } from "@/lib/supabase";

export interface AlertSettingsConfig {
  // Temperature thresholds (°C)
  temp_enabled: boolean;
  temp_warning_c: number;
  temp_critical_c: number;

  // Ghost Cooling / Energy Waste thresholds
  ghost_cooling_enabled: boolean;
  ghost_cooling_light_check: boolean;
  ghost_cooling_temp_c: number;

  // Noise Level thresholds (dB)
  noise_enabled: boolean;
  noise_warning_db: number;
  noise_critical_db: number;

  // Humidity thresholds (%)
  humidity_enabled: boolean;
  humidity_warning_pct: number;
  humidity_critical_pct: number;

  // Sensor Offline timeout thresholds (minutes)
  offline_enabled: boolean;
  offline_warning_min: number;
  offline_critical_min: number;

  // Notification delivery & automation preferences (saved in DB)
  sound_enabled: boolean;
  toast_enabled: boolean;
  desktop_enabled: boolean;
  auto_resolve: boolean;
  updated_at?: string;
}

export const DEFAULT_ALERT_SETTINGS: AlertSettingsConfig = {
  temp_enabled: true,
  temp_warning_c: 28,
  temp_critical_c: 30,

  ghost_cooling_enabled: true,
  ghost_cooling_light_check: true,
  ghost_cooling_temp_c: 20,

  noise_enabled: true,
  noise_warning_db: 68,
  noise_critical_db: 82,

  humidity_enabled: true,
  humidity_warning_pct: 80,
  humidity_critical_pct: 88,

  offline_enabled: true,
  offline_warning_min: 5,
  offline_critical_min: 30,

  sound_enabled: true,
  toast_enabled: true,
  desktop_enabled: false,
  auto_resolve: true,
};

export const SYSTEM_SETTINGS_MARKER = "__SYSTEM_ALERT_SETTINGS__:";

let cachedSettings: { data: AlertSettingsConfig; ts: number } | null = null;
const CACHE_TTL_MS = 5000;

function sanitizeSettings(
  raw: Partial<AlertSettingsConfig> | null | undefined
): AlertSettingsConfig {
  const base = { ...DEFAULT_ALERT_SETTINGS };
  if (!raw || typeof raw !== "object") return base;

  const num = (v: unknown, fallback: number) => {
    const parsed = Number(v);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const bool = (v: unknown, fallback: boolean) =>
    typeof v === "boolean" ? v : fallback;

  return {
    temp_enabled: bool(raw.temp_enabled, base.temp_enabled),
    temp_warning_c: num(raw.temp_warning_c, base.temp_warning_c),
    temp_critical_c: num(raw.temp_critical_c, base.temp_critical_c),

    ghost_cooling_enabled: bool(
      raw.ghost_cooling_enabled,
      base.ghost_cooling_enabled
    ),
    ghost_cooling_light_check: bool(
      raw.ghost_cooling_light_check,
      base.ghost_cooling_light_check
    ),
    ghost_cooling_temp_c: num(
      raw.ghost_cooling_temp_c,
      base.ghost_cooling_temp_c
    ),

    noise_enabled: bool(raw.noise_enabled, base.noise_enabled),
    noise_warning_db: num(raw.noise_warning_db, base.noise_warning_db),
    noise_critical_db: num(raw.noise_critical_db, base.noise_critical_db),

    humidity_enabled: bool(raw.humidity_enabled, base.humidity_enabled),
    humidity_warning_pct: num(
      raw.humidity_warning_pct,
      base.humidity_warning_pct
    ),
    humidity_critical_pct: num(
      raw.humidity_critical_pct,
      base.humidity_critical_pct
    ),

    offline_enabled: bool(raw.offline_enabled, base.offline_enabled),
    offline_warning_min: num(raw.offline_warning_min, base.offline_warning_min),
    offline_critical_min: num(
      raw.offline_critical_min,
      base.offline_critical_min
    ),

    sound_enabled: bool(raw.sound_enabled, base.sound_enabled),
    toast_enabled: bool(raw.toast_enabled, base.toast_enabled),
    desktop_enabled: bool(raw.desktop_enabled, base.desktop_enabled),
    auto_resolve: bool(raw.auto_resolve, base.auto_resolve),
    updated_at: raw.updated_at || new Date().toISOString(),
  };
}

/**
 * Reads the global alert & notification settings from Supabase.
 * First checks `alert_settings` table; if that table hasn't been created yet,
 * reads from the system config record stored in `anomalies`.
 */
export async function getAlertSettings(
  forceRefresh = false
): Promise<AlertSettingsConfig> {
  if (
    !forceRefresh &&
    cachedSettings &&
    Date.now() - cachedSettings.ts < CACHE_TTL_MS
  ) {
    return cachedSettings.data;
  }

  // 1. Try dedicated `alert_settings` table first
  try {
    const { data, error } = await supabase
      .from("alert_settings")
      .select("*")
      .eq("setting_key", "global")
      .maybeSingle();

    if (!error && data?.config) {
      const merged = sanitizeSettings({
        ...(typeof data.config === "object" ? data.config : {}),
        updated_at: data.updated_at,
      });
      cachedSettings = { data: merged, ts: Date.now() };
      return merged;
    }
  } catch {
    // Table may not exist yet; fall through to anomalies storage
  }

  // 2. Fallback: read from system config record in `anomalies` table
  try {
    const { data, error } = await supabase
      .from("anomalies")
      .select("anomaly_id, message, end_at, start_at")
      .like("message", `${SYSTEM_SETTINGS_MARKER}%`)
      .order("start_at", { ascending: false })
      .limit(1);

    if (!error && data && data.length > 0) {
      const rawJson = data[0].message.slice(SYSTEM_SETTINGS_MARKER.length);
      const parsed = JSON.parse(rawJson);
      const merged = sanitizeSettings({
        ...parsed,
        updated_at: data[0].end_at || data[0].start_at,
      });
      cachedSettings = { data: merged, ts: Date.now() };
      return merged;
    }
  } catch (err) {
    console.error("Error reading fallback alert settings:", err);
  }

  const defaults = sanitizeSettings(DEFAULT_ALERT_SETTINGS);
  cachedSettings = { data: defaults, ts: Date.now() };
  return defaults;
}

/**
 * Saves the global alert & notification settings to Supabase.
 */
export async function saveAlertSettings(
  updates: Partial<AlertSettingsConfig>
): Promise<AlertSettingsConfig> {
  const current = await getAlertSettings(true);
  const next = sanitizeSettings({
    ...current,
    ...updates,
    updated_at: new Date().toISOString(),
  });

  let savedToDedicatedTable = false;

  // 1. Try upserting into dedicated `alert_settings` table
  try {
    const { error } = await supabase.from("alert_settings").upsert(
      {
        setting_key: "global",
        config: next,
        updated_at: next.updated_at,
      },
      { onConflict: "setting_key" }
    );
    if (!error) {
      savedToDedicatedTable = true;
    }
  } catch {
    // Fallback to anomalies system row below
  }

  // 2. Also persist in `anomalies` system row so it works even without new table migration
  if (!savedToDedicatedTable) {
    const encodedMessage = `${SYSTEM_SETTINGS_MARKER}${JSON.stringify(next)}`;
    const { data: existing } = await supabase
      .from("anomalies")
      .select("anomaly_id")
      .like("message", `${SYSTEM_SETTINGS_MARKER}%`)
      .order("start_at", { ascending: false });

    if (existing && existing.length > 0) {
      const primaryId = existing[0].anomaly_id;
      const { error: updateErr } = await supabase
        .from("anomalies")
        .update({
          message: encodedMessage,
          is_active: false,
          end_at: next.updated_at,
        })
        .eq("anomaly_id", primaryId);
      if (updateErr) throw updateErr;

      // Clean up any duplicate system rows if present
      if (existing.length > 1) {
        const extraIds = existing.slice(1).map((r) => r.anomaly_id);
        await supabase.from("anomalies").delete().in("anomaly_id", extraIds);
      }
    } else {
      const { error: insertErr } = await supabase.from("anomalies").insert({
        type: "HIGH_TEMP",
        severity: "LOW",
        room_id: null,
        node_id: null,
        message: encodedMessage,
        start_at: next.updated_at,
        end_at: next.updated_at,
        is_active: false,
      });
      if (insertErr) throw insertErr;
    }
  }

  cachedSettings = { data: next, ts: Date.now() };
  return next;
}

export function getDefaultThresholdForType(
  type: string,
  severity: "LOW" | "MEDIUM" | "HIGH",
  settings: AlertSettingsConfig
): { threshold: number; unit: string } {
  switch (type) {
    case "HIGH_TEMP":
      return {
        threshold:
          severity === "HIGH"
            ? settings.temp_critical_c
            : settings.temp_warning_c,
        unit: "°C",
      };
    case "GHOST_COOLING":
      return {
        threshold: settings.ghost_cooling_temp_c,
        unit: "°C",
      };
    case "HIGH_NOISE":
      return {
        threshold:
          severity === "HIGH"
            ? settings.noise_critical_db
            : settings.noise_warning_db,
        unit: "dB",
      };
    case "HIGH_HUMIDITY":
      return {
        threshold:
          severity === "HIGH"
            ? settings.humidity_critical_pct
            : settings.humidity_warning_pct,
        unit: "%",
      };
    case "SENSOR_OFFLINE":
      return {
        threshold:
          severity === "HIGH"
            ? settings.offline_critical_min
            : settings.offline_warning_min,
        unit: "min",
      };
    default:
      return { threshold: 0, unit: "" };
  }
}
