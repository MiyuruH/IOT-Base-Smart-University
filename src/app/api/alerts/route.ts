import { NextResponse } from "next/server";
import {
  getActiveAnomalies,
  getAllAnomalies,
  createAnomaly,
  updateAnomaly,
  resolveAllActiveAnomalies,
  deleteAnomaly,
  syncCampusAnomalies,
} from "@/lib/services/alerts";
import {
  getAlertSettings,
  saveAlertSettings,
  type AlertSettingsConfig,
} from "@/lib/services/alertSettings";
import { requireAuth } from "@/lib/authGuard";

export async function GET(req: Request) {
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const status = (searchParams.get("status") || "active") as
      | "active"
      | "resolved"
      | "all";
    const roomId = searchParams.get("room_id");
    const shouldSync = searchParams.get("sync") !== "false";
    const includeSettings = searchParams.get("include_settings") === "true";

    if (shouldSync) {
      await syncCampusAnomalies();
    }

    const anomalies =
      status === "active"
        ? await getActiveAnomalies()
        : await getAllAnomalies(200, status);

    const filtered = roomId
      ? anomalies.filter((a) => a.room_id === roomId)
      : anomalies;

    if (includeSettings) {
      const settings = await getAlertSettings();
      return NextResponse.json({ alerts: filtered, settings });
    }

    return NextResponse.json(filtered);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch alerts" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();

    if (body.action === "scan") {
      await syncCampusAnomalies();
      const active = await getActiveAnomalies();
      return NextResponse.json({
        message: "Campus anomaly scan completed",
        activeCount: active.length,
        alerts: active,
      });
    }

    if (body.action === "resolve_all") {
      const count = await resolveAllActiveAnomalies(body.room_id);
      return NextResponse.json({
        message: `Resolved ${count} active alert(s)`,
        resolvedCount: count,
      });
    }

    if (body.action === "delete" && body.anomaly_id) {
      await deleteAnomaly(body.anomaly_id);
      return NextResponse.json({ message: "Alert deleted" });
    }

    if (body.action === "update" && body.anomaly_id) {
      const updated = await updateAnomaly(body.anomaly_id, {
        type: body.type,
        room_id: body.room_id,
        severity: body.severity,
        message: body.message,
        threshold_value:
          body.threshold_value != null && body.threshold_value !== ""
            ? Number(body.threshold_value)
            : null,
        measured_value:
          body.measured_value != null && body.measured_value !== ""
            ? Number(body.measured_value)
            : null,
        unit: body.unit ?? null,
        is_active: body.is_active,
      });
      return NextResponse.json(updated);
    }

    if (body.action === "save_settings" && body.settings) {
      const saved = await saveAlertSettings(body.settings);
      await syncCampusAnomalies();
      return NextResponse.json(saved);
    }

    // Optional: If user checked "Save this threshold as default setting" when triggering an alert
    if (
      body.save_threshold_to_settings &&
      body.threshold_value != null &&
      !Number.isNaN(Number(body.threshold_value))
    ) {
      let thVal = Number(body.threshold_value);
      const rawUnit = typeof body.unit === "string" ? body.unit.trim() : "";
      const isHigh = body.severity === "HIGH";
      const patch: Partial<AlertSettingsConfig> = {};

      if (body.type === "HIGH_TEMP") {
        if (rawUnit === "°F") thVal = Number((((thVal - 32) * 5) / 9).toFixed(1));
        if (isHigh) patch.temp_critical_c = thVal;
        else patch.temp_warning_c = thVal;
      } else if (body.type === "GHOST_COOLING") {
        if (rawUnit === "°F") thVal = Number((((thVal - 32) * 5) / 9).toFixed(1));
        patch.ghost_cooling_temp_c = thVal;
      } else if (body.type === "HIGH_NOISE") {
        patch.noise_critical_db = isHigh ? thVal : undefined;
        patch.noise_warning_db = !isHigh ? thVal : undefined;
      } else if (body.type === "HIGH_HUMIDITY") {
        if (isHigh) patch.humidity_critical_pct = thVal;
        else patch.humidity_warning_pct = thVal;
      } else if (body.type === "SENSOR_OFFLINE") {
        if (rawUnit === "hr") thVal = Math.round(thVal * 60);
        if (isHigh) patch.offline_critical_min = thVal;
        else patch.offline_warning_min = thVal;
      }

      // Remove undefined keys before patching settings
      const cleanPatch = Object.fromEntries(
        Object.entries(patch).filter(([, v]) => v !== undefined)
      ) as Partial<AlertSettingsConfig>;

      if (Object.keys(cleanPatch).length > 0) {
        await saveAlertSettings(cleanPatch);
      }
    }

    const anomaly = await createAnomaly({
      type: body.type || "HIGH_TEMP",
      room_id: body.room_id || null,
      node_id: body.node_id || null,
      severity: body.severity || "MEDIUM",
      message: body.message || "Manual system alert triggered",
      threshold_value:
        body.threshold_value != null && body.threshold_value !== ""
          ? Number(body.threshold_value)
          : null,
      measured_value:
        body.measured_value != null && body.measured_value !== ""
          ? Number(body.measured_value)
          : null,
      unit: body.unit || null,
    });
    return NextResponse.json(anomaly, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to process alert action" },
      { status: 500 }
    );
  }
}
