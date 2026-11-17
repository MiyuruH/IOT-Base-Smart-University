"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Check,
  Clock,
  Droplets,
  Lightbulb,
  Radio,
  Snowflake,
  Thermometer,
  Users,
  Volume2,
} from "lucide-react";
import { getAlertMeta, useNotifications } from "@/components/NotificationProvider";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

interface SensorReading {
  id: number;
  room_id: string;
  created_at: string;
  temp: number | null;
  humidity: number | null;
  noise_level: number | null;
  is_occupied: boolean | null;
  light_status: boolean | null;
}

/* ── Helper components ── */
function StatusCard({
  icon,
  iconBg,
  iconColor,
  label,
  alertBadge,
  children,
}: {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  label: string;
  alertBadge?: { text: string; color: "red" | "amber" | "green" | "blue" };
  children: React.ReactNode;
}) {
  return (
    <div
      className="card"
      style={{
        padding: 24,
        display: "flex",
        flexDirection: "column",
        minHeight: 140,
        borderColor:
          alertBadge?.color === "red"
            ? "rgba(239, 83, 80, 0.45)"
            : alertBadge?.color === "amber"
              ? "rgba(245, 183, 49, 0.4)"
              : undefined,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: "50%",
              background: iconBg,
              color: iconColor,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
              flexShrink: 0,
            }}
          >
            {icon}
          </div>
          <h4
            style={{
              margin: 0,
              fontSize: 14,
              color: "var(--text-muted)",
              fontWeight: 500,
            }}
          >
            {label}
          </h4>
        </div>
        {alertBadge && (
          <span
            className={`badge ${alertBadge.color}`}
            style={{ fontSize: 10, padding: "2px 8px" }}
          >
            {alertBadge.text}
          </span>
        )}
      </div>
      <div style={{ marginTop: "auto" }}>{children}</div>
    </div>
  );
}

function BigValue({
  value,
  unit,
  color,
}: {
  value: string;
  unit?: string;
  color?: string;
}) {
  return (
    <div
      style={{
        fontSize: 30,
        fontWeight: 700,
        color: color ?? "var(--text-primary)",
        display: "flex",
        alignItems: "baseline",
        gap: 4,
      }}
    >
      {value}
      {unit && (
        <span
          style={{
            fontSize: 15,
            fontWeight: 500,
            color: "var(--text-muted)",
          }}
        >
          {unit}
        </span>
      )}
    </div>
  );
}

export default function IoTDashboard({ roomId }: { roomId: string }) {
  const [reading, setReading] = useState<SensorReading | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { activeAlerts, alertSettings, resolveAlert } = useNotifications();

  const roomActiveAlerts = activeAlerts.filter((a) => a.room_id === roomId);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const { data, error } = await supabase
          .from("sensor_readings")
          .select("*")
          .eq("room_id", roomId)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (error && error.code !== "PGRST116") {
          throw error;
        }

        if (data) {
          setReading(data as SensorReading);
        }
      } catch (err) {
        console.error("Error fetching IoT data:", err);
        setError("Failed to load sensor data.");
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();

    // Subscribe to realtime updates for THIS room
    const channel = supabase
      .channel(`sensor_readings_room_${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "sensor_readings",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          setReading(payload.new as SensorReading);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  /* ── Loading state ── */
  if (loading) {
    return (
      <div className="card" style={{ padding: 24, textAlign: "center" }}>
        <p style={{ color: "var(--text-muted)" }}>Connecting to IoT nodes...</p>
      </div>
    );
  }

  /* ── Error state ── */
  if (error) {
    return (
      <div
        className="card"
        style={{ padding: 24, borderLeft: "4px solid var(--accent-red)" }}
      >
        <p style={{ color: "var(--accent-red)", margin: 0 }}>{error}</p>
      </div>
    );
  }

  /* ── Waiting for first reading ── */
  if (!reading) {
    return (
      <div
        className="card animate-in"
        style={{
          padding: "48px 24px",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 20,
          border: "2px dashed var(--border-color)",
        }}
      >
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            background: "rgba(59, 130, 246, 0.1)",
            color: "var(--accent-blue)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 40,
            boxShadow: "0 0 0 8px rgba(59, 130, 246, 0.05)",
          }}
        >
          <Radio size={36} />
        </div>
        <div>
          <h3
            style={{
              margin: "0 0 12px 0",
              fontSize: 20,
              color: "var(--text-primary)",
            }}
          >
            Waiting for IoT Device Connection
          </h3>
          <p
            style={{
              margin: "0 auto",
              color: "var(--text-muted)",
              maxWidth: 450,
              lineHeight: 1.6,
            }}
          >
            No sensor data has been received yet. Please configure your IoT node
            (ESP32/NodeMCU) to send data to this specific room using the Room ID
            below.
          </p>
        </div>

        <div
          style={{
            marginTop: 8,
            padding: "16px 24px",
            background: "var(--bg-secondary)",
            borderRadius: "var(--radius-md)",
            display: "flex",
            flexDirection: "column",
            gap: 8,
            alignItems: "center",
          }}
        >
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Target Room ID for Sensor Node
          </span>
          <code
            style={{
              fontSize: 16,
              color: "var(--accent-blue)",
              fontWeight: 700,
              padding: "8px 16px",
              background: "rgba(59, 130, 246, 0.1)",
              borderRadius: 6,
              letterSpacing: "1px",
            }}
          >
            {roomId}
          </code>
        </div>

        <div style={{ marginTop: 12 }}>
          <span
            className="badge blue"
            style={{ padding: "8px 16px", fontSize: 13 }}
          >
            <span
              className="badge-dot"
              style={{ animation: "pulse 1.5s infinite" }}
            />
            Waiting to listen for real-time sensor data...
          </span>
        </div>
      </div>
    );
  }

  /* ── Active dashboard with data ── */
  const tempVal = reading.temp != null ? Number(reading.temp) : null;
  const humVal = reading.humidity != null ? Number(reading.humidity) : null;
  const noiseVal =
    reading.noise_level != null ? Number(reading.noise_level) : null;

  const isEnergyWaste =
    alertSettings.ghost_cooling_enabled &&
    ((alertSettings.ghost_cooling_light_check &&
      reading.is_occupied === false &&
      reading.light_status === true) ||
      (reading.is_occupied === false &&
        tempVal != null &&
        tempVal > 0 &&
        tempVal < alertSettings.ghost_cooling_temp_c));
  const isHighTemp =
    alertSettings.temp_enabled &&
    tempVal != null &&
    tempVal >= alertSettings.temp_warning_c;
  const isHighNoise =
    alertSettings.noise_enabled &&
    noiseVal != null &&
    noiseVal >= alertSettings.noise_warning_db;
  const isHighHumidity =
    alertSettings.humidity_enabled &&
    humVal != null &&
    humVal >= alertSettings.humidity_warning_pct;

  const occupancyLabel = reading.is_occupied ? "Occupied" : "Vacant";
  const occupancyColor = reading.is_occupied
    ? "var(--accent-green)"
    : "var(--text-muted)";
  const timeFormatted = new Date(reading.created_at).toLocaleString();

  return (
    <div className="iot-dashboard animate-in">
      {/* Live Alert Banners for this room */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
        {isEnergyWaste && (
          <div
            style={{
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.25)",
              padding: "16px 20px",
              borderRadius: "var(--radius-lg)",
              display: "flex",
              alignItems: "center",
              gap: 14,
            }}
          >
            <Snowflake
              size={24}
              style={{ color: "var(--accent-red)", flexShrink: 0 }}
            />
            <div style={{ flex: 1 }}>
              <h4
                style={{
                  margin: 0,
                  fontSize: 15,
                  fontWeight: 600,
                  color: "var(--accent-red)",
                }}
              >
                Energy Waste Detected — Ghost Cooling / Lighting
              </h4>
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: 13,
                  color: "var(--text-secondary)",
                }}
              >
                The room is vacant while utilities remain active (threshold: &lt;{" "}
                {alertSettings.ghost_cooling_temp_c}°C or lights ON). Consider
                turning off utilities to save energy.
              </p>
            </div>
          </div>
        )}

        {isHighTemp && (
          <div
            style={{
              background: "rgba(245, 158, 11, 0.1)",
              border: "1px solid rgba(245, 158, 11, 0.25)",
              padding: "16px 20px",
              borderRadius: "var(--radius-lg)",
              display: "flex",
              alignItems: "center",
              gap: 14,
            }}
          >
            <Thermometer
              size={24}
              style={{ color: "var(--accent-amber)", flexShrink: 0 }}
            />
            <div style={{ flex: 1 }}>
              <h4
                style={{
                  margin: 0,
                  fontSize: 15,
                  fontWeight: 600,
                  color: "var(--accent-amber)",
                }}
              >
                {tempVal! >= alertSettings.temp_critical_c
                  ? "Critical Temperature Threshold Exceeded"
                  : "Elevated Room Temperature"}
              </h4>
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: 13,
                  color: "var(--text-secondary)",
                }}
              >
                Current room temperature is {tempVal!.toFixed(1)}°C (configured
                threshold: {alertSettings.temp_warning_c}°C warn /{" "}
                {alertSettings.temp_critical_c}°C crit).
              </p>
            </div>
          </div>
        )}

        {isHighNoise && (
          <div
            style={{
              background: "rgba(168, 85, 247, 0.1)",
              border: "1px solid rgba(168, 85, 247, 0.25)",
              padding: "16px 20px",
              borderRadius: "var(--radius-lg)",
              display: "flex",
              alignItems: "center",
              gap: 14,
            }}
          >
            <Volume2 size={24} style={{ color: "#a855f7", flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <h4
                style={{
                  margin: 0,
                  fontSize: 15,
                  fontWeight: 600,
                  color: "#c084fc",
                }}
              >
                High Acoustic Noise Level ({noiseVal!.toFixed(0)} dB)
              </h4>
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: 13,
                  color: "var(--text-secondary)",
                }}
              >
                Sound level exceeds configured campus threshold (
                {alertSettings.noise_warning_db} dB).
              </p>
            </div>
          </div>
        )}

        {/* Active Recorded Anomalies from Alert System for this Room */}
        {roomActiveAlerts.map((alert) => {
          const meta = getAlertMeta(alert.type);
          const Icon = meta.icon;
          return (
            <div
              key={alert.anomaly_id}
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border-color)",
                borderLeft: `4px solid ${meta.color}`,
                padding: "12px 18px",
                borderRadius: "var(--radius-md)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Icon size={18} style={{ color: meta.color, flexShrink: 0 }} />
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>
                      Active Alert: {meta.shortLabel}
                    </span>
                    <span
                      className={`badge ${
                        alert.severity === "HIGH"
                          ? "red"
                          : alert.severity === "MEDIUM"
                            ? "amber"
                            : "blue"
                      }`}
                      style={{ fontSize: 10, padding: "1px 7px" }}
                    >
                      {alert.severity}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--text-secondary)",
                      marginTop: 2,
                    }}
                  >
                    {alert.message}
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => resolveAlert(alert.anomaly_id)}
              >
                <Check size={14} />
                Resolve
              </button>
            </div>
          );
        })}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 20,
        }}
      >
        {/* Occupancy */}
        <StatusCard
          icon={<Users size={20} />}
          iconBg="rgba(59,130,246,0.1)"
          iconColor="var(--accent-blue)"
          label="Occupancy"
          alertBadge={
            isEnergyWaste
              ? { text: "Energy Waste", color: "red" }
              : reading.is_occupied
                ? { text: "In Use", color: "green" }
                : undefined
          }
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              className="badge-dot"
              style={{ width: 10, height: 10, background: occupancyColor }}
            />
            <span
              style={{
                fontSize: 22,
                fontWeight: 600,
                color: occupancyColor,
              }}
            >
              {occupancyLabel}
            </span>
          </div>
        </StatusCard>

        {/* Temperature */}
        <StatusCard
          icon={<Thermometer size={20} />}
          iconBg="rgba(245,158,11,0.1)"
          iconColor="var(--accent-amber)"
          label="Temperature"
          alertBadge={
            tempVal != null
              ? tempVal >= alertSettings.temp_critical_c
                ? { text: "Critical", color: "red" }
                : tempVal >= alertSettings.temp_warning_c
                  ? { text: "High", color: "amber" }
                  : { text: "Optimal", color: "green" }
              : undefined
          }
        >
          <BigValue
            value={tempVal != null ? tempVal.toFixed(1) : "—"}
            unit="°C"
            color={
              tempVal != null && tempVal >= alertSettings.temp_critical_c
                ? "var(--accent-red)"
                : tempVal != null && tempVal >= alertSettings.temp_warning_c
                  ? "var(--accent-amber)"
                  : undefined
            }
          />
        </StatusCard>

        {/* Humidity */}
        <StatusCard
          icon={<Droplets size={20} />}
          iconBg="rgba(59,130,246,0.1)"
          iconColor="var(--accent-blue)"
          label="Humidity"
          alertBadge={
            humVal != null
              ? humVal >= alertSettings.humidity_critical_pct
                ? { text: "Critical", color: "red" }
                : isHighHumidity
                  ? { text: "High", color: "amber" }
                  : { text: "Normal", color: "green" }
              : undefined
          }
        >
          <BigValue
            value={humVal != null ? humVal.toFixed(0) : "—"}
            unit="%"
          />
        </StatusCard>

        {/* Noise Level */}
        <StatusCard
          icon={<Volume2 size={20} />}
          iconBg="rgba(168,85,247,0.1)"
          iconColor="#a855f7"
          label="Noise Level"
          alertBadge={
            noiseVal != null
              ? noiseVal >= alertSettings.noise_critical_db
                ? { text: "Severe", color: "red" }
                : noiseVal >= alertSettings.noise_warning_db
                  ? { text: "Loud", color: "amber" }
                  : { text: "Quiet", color: "green" }
              : undefined
          }
        >
          <BigValue
            value={noiseVal != null ? noiseVal.toFixed(0) : "—"}
            unit="dB"
          />
          {noiseVal != null && (
            <div
              style={{
                marginTop: 6,
                fontSize: 13,
                color:
                  noiseVal >= alertSettings.noise_warning_db
                    ? "var(--accent-amber)"
                    : "var(--text-muted)",
              }}
            >
              {noiseVal >= alertSettings.noise_warning_db
                ? `Loud (threshold: ${alertSettings.noise_warning_db} dB)`
                : "Normal levels"}
            </div>
          )}
        </StatusCard>

        {/* Lighting */}
        <StatusCard
          icon={<Lightbulb size={20} />}
          iconBg="rgba(250,204,21,0.1)"
          iconColor="#facc15"
          label="Lighting"
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 50,
                height: 28,
                borderRadius: 14,
                background: reading.light_status
                  ? "var(--accent-green)"
                  : "var(--border-color)",
                position: "relative",
                transition: "background 0.3s",
              }}
            >
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  background: "white",
                  position: "absolute",
                  top: 4,
                  left: reading.light_status ? 26 : 4,
                  transition: "left 0.3s",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                }}
              />
            </div>
            <span
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: reading.light_status
                  ? "var(--text-primary)"
                  : "var(--text-muted)",
              }}
            >
              {reading.light_status ? "ON" : "OFF"}
            </span>
          </div>
        </StatusCard>

        {/* Last Updated */}
        <StatusCard
          icon={<Clock size={20} />}
          iconBg="rgba(0,173,181,0.08)"
          iconColor="var(--accent-blue)"
          label="Last Updated"
        >
          <span
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: "var(--text-secondary)",
              lineHeight: 1.5,
            }}
          >
            {timeFormatted}
          </span>
          <div style={{ marginTop: 8 }}>
            <span
              className="badge blue"
              style={{ padding: "4px 12px", fontSize: 11 }}
            >
              <span
                className="badge-dot"
                style={{ animation: "pulse 1.5s infinite" }}
              />
               Live
            </span>
          </div>
        </StatusCard>
      </div>
    </div>
  );
}
