"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Bell,
  Check,
  Droplets,
  ExternalLink,
  Ghost,
  Radio,
  Thermometer,
  Volume2,
  X,
} from "lucide-react";
import { useRealtime } from "@/hooks/useRealtime";

export interface AlertSettingsConfig {
  temp_enabled: boolean;
  temp_warning_c: number;
  temp_critical_c: number;

  ghost_cooling_enabled: boolean;
  ghost_cooling_light_check: boolean;
  ghost_cooling_temp_c: number;

  noise_enabled: boolean;
  noise_warning_db: number;
  noise_critical_db: number;

  humidity_enabled: boolean;
  humidity_warning_pct: number;
  humidity_critical_pct: number;

  offline_enabled: boolean;
  offline_warning_min: number;
  offline_critical_min: number;

  sound_enabled: boolean;
  toast_enabled: boolean;
  desktop_enabled: boolean;
  auto_resolve: boolean;
  updated_at?: string;
}

export const INITIAL_ALERT_SETTINGS: AlertSettingsConfig = {
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

export interface AnomalyItem {
  anomaly_id: string;
  type: string;
  room_id: string | null;
  node_id: string | null;
  severity: "LOW" | "MEDIUM" | "HIGH";
  message: string;
  threshold_value?: number | null;
  measured_value?: number | null;
  unit?: string | null;
  recommendation?: string;
  start_at: string;
  end_at: string | null;
  is_active: boolean;
  rooms?: { name: string; code: string } | null;
}

interface ToastItem {
  id: string;
  alert: AnomalyItem;
  createdAt: number;
}

interface NotificationContextValue {
  activeAlerts: AnomalyItem[];
  allAlerts: AnomalyItem[];
  alertSettings: AlertSettingsConfig;
  unreadIds: Set<string>;
  unreadCount: number;
  activeCount: number;
  highSeverityCount: number;
  loading: boolean;
  soundEnabled: boolean;
  toastEnabled: boolean;
  desktopEnabled: boolean;
  setSoundEnabled: (v: boolean) => void;
  setToastEnabled: (v: boolean) => void;
  setDesktopEnabled: (v: boolean) => void;
  updateAlertSettings: (
    updates: Partial<AlertSettingsConfig>
  ) => Promise<AlertSettingsConfig | null>;
  playAlertSound: (severity?: "HIGH" | "MEDIUM" | "LOW") => void;
  refreshAlerts: (sync?: boolean) => Promise<void>;
  resolveAlert: (anomalyId: string) => Promise<void>;
  resolveAllAlerts: (roomId?: string) => Promise<void>;
  deleteAlert: (anomalyId: string) => Promise<void>;
  updateAlert: (
    anomalyId: string,
    updates: {
      type?: string;
      room_id?: string | null;
      severity?: "LOW" | "MEDIUM" | "HIGH";
      message?: string;
      threshold_value?: number | null;
      measured_value?: number | null;
      unit?: string | null;
      is_active?: boolean;
    }
  ) => Promise<AnomalyItem | null>;
  triggerManualAlert: (input: {
    type: string;
    severity: "LOW" | "MEDIUM" | "HIGH";
    room_id?: string | null;
    message: string;
    threshold_value?: number | null;
    measured_value?: number | null;
    unit?: string | null;
    save_threshold_to_settings?: boolean;
  }) => Promise<AnomalyItem | null>;
  markRead: (anomalyId: string) => void;
  markAllRead: () => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error("useNotifications must be used within NotificationProvider");
  }
  return ctx;
}

export function getAlertMeta(type: string) {
  switch (type) {
    case "GHOST_COOLING":
      return {
        label: "Ghost Cooling / Energy Waste",
        shortLabel: "Ghost Cooling",
        icon: Ghost,
        color: "#f59e0b",
        bg: "rgba(245, 158, 11, 0.14)",
        unit: "°C",
      };
    case "HIGH_TEMP":
      return {
        label: "High Temperature",
        shortLabel: "High Temp",
        icon: Thermometer,
        color: "#ef5350",
        bg: "rgba(239, 83, 80, 0.14)",
        unit: "°C",
      };
    case "HIGH_NOISE":
      return {
        label: "Excessive Noise Level",
        shortLabel: "High Noise",
        icon: Volume2,
        color: "#a855f7",
        bg: "rgba(168, 85, 247, 0.14)",
        unit: "dB",
      };
    case "HIGH_HUMIDITY":
      return {
        label: "High Humidity",
        shortLabel: "Humidity",
        icon: Droplets,
        color: "#00ADB5",
        bg: "rgba(0, 173, 181, 0.14)",
        unit: "%",
      };
    case "SENSOR_OFFLINE":
      return {
        label: "Sensor Node Offline",
        shortLabel: "Sensor Offline",
        icon: Radio,
        color: "#ef5350",
        bg: "rgba(239, 83, 80, 0.14)",
        unit: "min",
      };
    default:
      return {
        label: type.replace(/_/g, " "),
        shortLabel: type.replace(/_/g, " "),
        icon: AlertTriangle,
        color: "#00ADB5",
        bg: "rgba(0, 173, 181, 0.14)",
        unit: "",
      };
  }
}

export function formatValueWithUnit(
  value: number | string | null | undefined,
  unit?: string | null
): string {
  if (value == null || value === "") return "—";
  const u = (unit || "").trim();
  if (!u) return String(value);
  // No space before °C, °F, or %; include space before word units (dB, min, hr, lux)
  const noSpace = u.startsWith("°") || u === "%";
  return noSpace ? `${value}${u}` : `${value} ${u}`;
}

export function formatRelativeTime(isoDate: string): string {
  if (!isoDate) return "—";
  const diffSec = Math.max(
    0,
    Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000)
  );
  if (diffSec < 15) return "Just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d ago`;
}

export default function NotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [allAlerts, setAllAlerts] = useState<AnomalyItem[]>([]);
  const [alertSettings, setAlertSettings] = useState<AlertSettingsConfig>(
    INITIAL_ALERT_SETTINGS
  );
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  const knownActiveIdsRef = useRef<Set<string> | null>(null);
  const settingsRef = useRef<AlertSettingsConfig>(INITIAL_ALERT_SETTINGS);

  useEffect(() => {
    const savedRead = localStorage.getItem("navsense-read-alerts");
    if (savedRead) {
      try {
        const parsed = JSON.parse(savedRead);
        if (Array.isArray(parsed)) setReadIds(new Set(parsed));
      } catch {
        // ignore invalid json
      }
    }
  }, []);

  const updateAlertSettings = useCallback(
    async (
      updates: Partial<AlertSettingsConfig>
    ): Promise<AlertSettingsConfig | null> => {
      // Optimistically update local state
      const optimistic = { ...settingsRef.current, ...updates };
      settingsRef.current = optimistic;
      setAlertSettings(optimistic);

      try {
        const token = localStorage.getItem("token");
        const headers: HeadersInit = {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };
        const res = await fetch("/api/alerts/settings", {
          method: "PUT",
          headers,
          body: JSON.stringify(updates),
        });
        if (!res.ok) return null;
        const saved: AlertSettingsConfig = await res.json();
        settingsRef.current = saved;
        setAlertSettings(saved);
        return saved;
      } catch (err) {
        console.error("Failed to save alert settings to DB:", err);
        return null;
      }
    },
    []
  );

  const setSoundEnabled = useCallback(
    (v: boolean) => {
      updateAlertSettings({ sound_enabled: v });
    },
    [updateAlertSettings]
  );

  const setToastEnabled = useCallback(
    (v: boolean) => {
      updateAlertSettings({ toast_enabled: v });
    },
    [updateAlertSettings]
  );

  const setDesktopEnabled = useCallback(
    async (v: boolean) => {
      if (v && typeof window !== "undefined" && "Notification" in window) {
        if (Notification.permission === "default") {
          const perm = await Notification.requestPermission();
          if (perm !== "granted") {
            updateAlertSettings({ desktop_enabled: false });
            return;
          }
        }
      }
      updateAlertSettings({ desktop_enabled: v });
    },
    [updateAlertSettings]
  );

  const playAlertSound = useCallback(
    (severity: "HIGH" | "MEDIUM" | "LOW" = "HIGH") => {
      if (typeof window === "undefined") return;
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const now = ctx.currentTime;

        const playTone = (
          freq: number,
          startOffset: number,
          duration: number,
          peakGain: number,
          type: OscillatorType = "sine"
        ) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = type;
          osc.frequency.setValueAtTime(freq, now + startOffset);
          gain.gain.setValueAtTime(0.0001, now + startOffset);
          gain.gain.exponentialRampToValueAtTime(
            peakGain,
            now + startOffset + 0.02
          );
          gain.gain.exponentialRampToValueAtTime(
            0.0001,
            now + startOffset + duration
          );
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + startOffset);
          osc.stop(now + startOffset + duration + 0.02);
        };

        if (severity === "HIGH") {
          playTone(880, 0, 0.16, 0.18, "triangle");
          playTone(1318.5, 0.14, 0.18, 0.2, "triangle");
          playTone(1760, 0.3, 0.28, 0.22, "sine");
        } else {
          playTone(587.33, 0, 0.15, 0.14, "sine");
          playTone(880, 0.12, 0.24, 0.16, "sine");
        }
      } catch {
        // Ignore audio autoplay restrictions if user hasn't interacted yet
      }
    },
    []
  );

  const enqueueToast = useCallback(
    (alert: AnomalyItem) => {
      if (settingsRef.current.toast_enabled) {
        const id = `${alert.anomaly_id}-${Date.now()}`;
        setToasts((prev) =>
          [{ id, alert, createdAt: Date.now() }, ...prev].slice(0, 4)
        );
      }
      if (settingsRef.current.sound_enabled) {
        playAlertSound(alert.severity);
      }
      if (
        settingsRef.current.desktop_enabled &&
        typeof window !== "undefined" &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        try {
          const meta = getAlertMeta(alert.type);
          new Notification(`NavSense Alert: ${meta.shortLabel}`, {
            body: alert.message,
          });
        } catch {
          // ignore
        }
      }
    },
    [playAlertSound]
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setInterval(() => {
      const now = Date.now();
      setToasts((prev) =>
        prev.filter((t) => {
          const ttl = t.alert.severity === "HIGH" ? 12000 : 8000;
          return now - t.createdAt < ttl;
        })
      );
    }, 1000);
    return () => clearInterval(timer);
  }, [toasts.length]);

  const refreshAlerts = useCallback(
    async (sync = true) => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return;
        const headers: HeadersInit = { Authorization: `Bearer ${token}` };

        const res = await fetch(
          `/api/alerts?status=all&include_settings=true&sync=${
            sync ? "true" : "false"
          }`,
          { headers, cache: "no-store" }
        );
        if (!res.ok) return;
        const payload = await res.json();
        const data: AnomalyItem[] = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.alerts)
            ? payload.alerts
            : [];

        if (payload?.settings) {
          settingsRef.current = payload.settings;
          setAlertSettings(payload.settings);
        }

        const currentActive = data.filter((a) => a.is_active);
        const currentActiveIds = new Set(currentActive.map((a) => a.anomaly_id));

        if (knownActiveIdsRef.current !== null) {
          for (const alert of currentActive) {
            if (!knownActiveIdsRef.current.has(alert.anomaly_id)) {
              enqueueToast(alert);
            }
          }
        }
        knownActiveIdsRef.current = currentActiveIds;
        setAllAlerts(data);
      } catch (err) {
        console.error("Failed to refresh alerts:", err);
      } finally {
        setLoading(false);
      }
    },
    [enqueueToast]
  );

  useEffect(() => {
    refreshAlerts(true);
    const interval = setInterval(() => {
      refreshAlerts(true);
    }, 15000);
    return () => clearInterval(interval);
  }, [refreshAlerts]);

  useRealtime({ table: "sensor_readings", event: "INSERT" }, () => {
    refreshAlerts(true);
  });

  useRealtime({ table: "readings", event: "INSERT" }, () => {
    refreshAlerts(true);
  });

  useRealtime({ table: "anomalies", event: "*" }, () => {
    refreshAlerts(false);
  });

  const markRead = useCallback((anomalyId: string) => {
    setReadIds((prev) => {
      if (prev.has(anomalyId)) return prev;
      const next = new Set(prev);
      next.add(anomalyId);
      localStorage.setItem(
        "navsense-read-alerts",
        JSON.stringify(Array.from(next).slice(-300))
      );
      return next;
    });
  }, []);

  const markAllRead = useCallback(() => {
    setReadIds((prev) => {
      const next = new Set(prev);
      for (const a of allAlerts) {
        if (a.is_active) next.add(a.anomaly_id);
      }
      localStorage.setItem(
        "navsense-read-alerts",
        JSON.stringify(Array.from(next).slice(-300))
      );
      return next;
    });
  }, [allAlerts]);

  const resolveAlert = useCallback(async (anomalyId: string) => {
    try {
      const token = localStorage.getItem("token");
      const headers: HeadersInit = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };
      const res = await fetch(`/api/alerts/${anomalyId}/resolve`, {
        method: "PUT",
        headers,
      });
      if (res.ok) {
        const nowIso = new Date().toISOString();
        setAllAlerts((prev) =>
          prev.map((a) =>
            a.anomaly_id === anomalyId
              ? { ...a, is_active: false, end_at: nowIso }
              : a
          )
        );
        setToasts((prev) =>
          prev.filter((t) => t.alert.anomaly_id !== anomalyId)
        );
        knownActiveIdsRef.current?.delete(anomalyId);
      }
    } catch (err) {
      console.error("Failed to resolve alert:", err);
    }
  }, []);

  const resolveAllAlerts = useCallback(async (roomId?: string) => {
    try {
      const token = localStorage.getItem("token");
      const headers: HeadersInit = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "resolve_all", room_id: roomId }),
      });
      if (res.ok) {
        const nowIso = new Date().toISOString();
        setAllAlerts((prev) =>
          prev.map((a) =>
            a.is_active && (!roomId || a.room_id === roomId)
              ? { ...a, is_active: false, end_at: nowIso }
              : a
          )
        );
        setToasts((prev) =>
          roomId ? prev.filter((t) => t.alert.room_id !== roomId) : []
        );
      }
    } catch (err) {
      console.error("Failed to resolve all alerts:", err);
    }
  }, []);

  const deleteAlert = useCallback(async (anomalyId: string) => {
    try {
      const token = localStorage.getItem("token");
      const headers: HeadersInit = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "delete", anomaly_id: anomalyId }),
      });
      if (res.ok) {
        setAllAlerts((prev) => prev.filter((a) => a.anomaly_id !== anomalyId));
        setToasts((prev) =>
          prev.filter((t) => t.alert.anomaly_id !== anomalyId)
        );
      }
    } catch (err) {
      console.error("Failed to delete alert:", err);
    }
  }, []);

  const updateAlert = useCallback(
    async (
      anomalyId: string,
      updates: {
        type?: string;
        room_id?: string | null;
        severity?: "LOW" | "MEDIUM" | "HIGH";
        message?: string;
        threshold_value?: number | null;
        measured_value?: number | null;
        unit?: string | null;
        is_active?: boolean;
      }
    ): Promise<AnomalyItem | null> => {
      try {
        const token = localStorage.getItem("token");
        const headers: HeadersInit = {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };
        const res = await fetch("/api/alerts", {
          method: "POST",
          headers,
          body: JSON.stringify({
            action: "update",
            anomaly_id: anomalyId,
            ...updates,
          }),
        });
        if (!res.ok) return null;
        const updated: AnomalyItem = await res.json();
        setAllAlerts((prev) =>
          prev.map((a) => (a.anomaly_id === anomalyId ? updated : a))
        );
        return updated;
      } catch (err) {
        console.error("Failed to update alert:", err);
        return null;
      }
    },
    []
  );

  const triggerManualAlert = useCallback(
    async (input: {
      type: string;
      severity: "LOW" | "MEDIUM" | "HIGH";
      room_id?: string | null;
      message: string;
      threshold_value?: number | null;
      measured_value?: number | null;
      unit?: string | null;
      save_threshold_to_settings?: boolean;
    }): Promise<AnomalyItem | null> => {
      try {
        const token = localStorage.getItem("token");
        const headers: HeadersInit = {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };
        const res = await fetch("/api/alerts", {
          method: "POST",
          headers,
          body: JSON.stringify(input),
        });
        if (!res.ok) return null;
        const created: AnomalyItem = await res.json();
        knownActiveIdsRef.current?.add(created.anomaly_id);
        setAllAlerts((prev) => [created, ...prev]);
        enqueueToast(created);
        if (input.save_threshold_to_settings) {
          refreshAlerts(false);
        }
        return created;
      } catch (err) {
        console.error("Failed to trigger alert:", err);
        return null;
      }
    },
    [enqueueToast, refreshAlerts]
  );

  const activeAlerts = allAlerts.filter((a) => a.is_active);
  const unreadIds = new Set(
    activeAlerts
      .filter((a) => !readIds.has(a.anomaly_id))
      .map((a) => a.anomaly_id)
  );
  const unreadCount = unreadIds.size;
  const activeCount = activeAlerts.length;
  const highSeverityCount = activeAlerts.filter(
    (a) => a.severity === "HIGH"
  ).length;

  return (
    <NotificationContext.Provider
      value={{
        activeAlerts,
        allAlerts,
        alertSettings,
        unreadIds,
        unreadCount,
        activeCount,
        highSeverityCount,
        loading,
        soundEnabled: alertSettings.sound_enabled,
        toastEnabled: alertSettings.toast_enabled,
        desktopEnabled: alertSettings.desktop_enabled,
        setSoundEnabled,
        setToastEnabled,
        setDesktopEnabled,
        updateAlertSettings,
        playAlertSound,
        refreshAlerts,
        resolveAlert,
        resolveAllAlerts,
        deleteAlert,
        updateAlert,
        triggerManualAlert,
        markRead,
        markAllRead,
      }}
    >
      {children}

      {/* Floating Real-Time Toast Notification Stack */}
      {toasts.length > 0 && (
        <div
          className="alert-toast-stack"
          role="region"
          aria-label="Live system notifications"
        >
          {toasts.map((item) => {
            const { alert } = item;
            const meta = getAlertMeta(alert.type);
            const Icon = meta.icon;
            const isHigh = alert.severity === "HIGH";
            const isMed = alert.severity === "MEDIUM";
            const accentColor = isHigh
              ? "var(--accent-red)"
              : isMed
                ? "var(--accent-amber)"
                : "var(--accent-blue)";
            const unitStr = alert.unit ?? meta.unit ?? "";

            return (
              <div
                key={item.id}
                className={`alert-toast ${isHigh ? "alert-toast-high" : ""}`}
                style={{ borderLeftColor: accentColor }}
              >
                <div
                  className="alert-toast-icon"
                  style={{ background: meta.bg, color: meta.color }}
                >
                  <Icon size={20} />
                </div>

                <div className="alert-toast-body">
                  <div className="alert-toast-top">
                    <span className="alert-toast-title">{meta.shortLabel}</span>
                    <span
                      className={`badge ${
                        isHigh ? "red" : isMed ? "amber" : "blue"
                      }`}
                      style={{ padding: "2px 8px", fontSize: 10 }}
                    >
                      {alert.severity}
                    </span>
                    {alert.rooms?.name && (
                      <span className="alert-toast-room">
                        {alert.rooms.name}
                      </span>
                    )}
                  </div>

                  <p className="alert-toast-msg">{alert.message}</p>

                  {(alert.threshold_value != null ||
                    alert.measured_value != null) && (
                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        marginBottom: 8,
                        fontSize: 11,
                        color: "var(--text-muted)",
                      }}
                    >
                      {alert.measured_value != null && (
                        <span>
                          Value:{" "}
                          <strong style={{ color: "var(--text-primary)" }}>
                            {formatValueWithUnit(alert.measured_value, unitStr)}
                          </strong>
                        </span>
                      )}
                      {alert.threshold_value != null && (
                        <span>
                          Threshold:{" "}
                          <strong style={{ color: "var(--accent-amber)" }}>
                            {formatValueWithUnit(alert.threshold_value, unitStr)}
                          </strong>
                        </span>
                      )}
                    </div>
                  )}

                  <div className="alert-toast-actions">
                    <button
                      type="button"
                      className="alert-toast-btn alert-toast-btn-resolve"
                      onClick={() => resolveAlert(alert.anomaly_id)}
                    >
                      <Check size={13} />
                      Resolve
                    </button>
                    {alert.room_id && (
                      <button
                        type="button"
                        className="alert-toast-btn"
                        onClick={() => {
                          markRead(alert.anomaly_id);
                          dismissToast(item.id);
                          router.push(`/rooms/${alert.room_id}`);
                        }}
                      >
                        <ExternalLink size={13} />
                        View Room
                      </button>
                    )}
                    <button
                      type="button"
                      className="alert-toast-btn"
                      onClick={() => {
                        markRead(alert.anomaly_id);
                        dismissToast(item.id);
                        router.push("/alerts");
                      }}
                    >
                      <Bell size={13} />
                      Alerts Center
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  className="alert-toast-close"
                  onClick={() => dismissToast(item.id)}
                  title="Dismiss notification"
                >
                  <X size={16} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </NotificationContext.Provider>
  );
}
