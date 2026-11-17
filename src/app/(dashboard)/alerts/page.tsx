  "use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Check,
  CheckCheck,
  CircleCheck,
  Clock,
  DoorOpen,
  Droplets,
  ExternalLink,
  Ghost,
  Info,
  Plus,
  Radio,
  RefreshCw,
  Save,
  Search,
  SlidersHorizontal,
  SquarePen,
  Thermometer,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import StatCard from "@/components/StatCard";
import {
  formatRelativeTime,
  formatValueWithUnit,
  getAlertMeta,
  useNotifications,
  type AlertSettingsConfig,
  type AnomalyItem,
} from "@/components/NotificationProvider";

interface RoomOption {
  room_id: string;
  name: string;
  code: string;
}

const ALERT_TYPE_OPTIONS = [
  {
    type: "GHOST_COOLING",
    label: "Ghost Cooling / Energy Waste",
    unit: "°C",
    defaultSeverity: "MEDIUM" as const,
  },
  {
    type: "HIGH_TEMP",
    label: "High Temperature",
    unit: "°C",
    defaultSeverity: "HIGH" as const,
  },
  {
    type: "HIGH_NOISE",
    label: "Excessive Noise Level",
    unit: "dB",
    defaultSeverity: "MEDIUM" as const,
  },
  {
    type: "HIGH_HUMIDITY",
    label: "High Humidity",
    unit: "%",
    defaultSeverity: "MEDIUM" as const,
  },
  {
    type: "SENSOR_OFFLINE",
    label: "Sensor Node Offline",
    unit: "min",
    defaultSeverity: "HIGH" as const,
  },
];

function getUnitOptionsForType(
  type: string
): { value: string; label: string }[] {
  switch (type) {
    case "HIGH_TEMP":
    case "GHOST_COOLING":
      return [
        { value: "°C", label: "°C (Celsius)" },
        { value: "°F", label: "°F (Fahrenheit)" },
      ];
    case "HIGH_NOISE":
      return [{ value: "dB", label: "dB (Decibels)" }];
    case "HIGH_HUMIDITY":
      return [{ value: "%", label: "% (Percent)" }];
    case "SENSOR_OFFLINE":
      return [
        { value: "min", label: "min (Minutes)" },
        { value: "hr", label: "hr (Hours)" },
      ];
    default:
      return [{ value: "°C", label: "°C" }];
  }
}

function normalizeUnitForType(
  type: string,
  rawUnit?: string | null
): string {
  const options = getUnitOptionsForType(type);
  const fallback = options[0].value;
  if (!rawUnit) return fallback;
  const u = rawUnit.trim().toLowerCase();

  if (type === "HIGH_TEMP" || type === "GHOST_COOLING") {
    if (u === "°f" || u === "f") return "°F";
    return "°C";
  }
  if (type === "HIGH_NOISE") return "dB";
  if (type === "HIGH_HUMIDITY") return "%";
  if (type === "SENSOR_OFFLINE") {
    if (u === "hr" || u === "hrs" || u === "h" || u === "hour" || u === "hours") {
      return "hr";
    }
    return "min";
  }
  return fallback;
}

function convertValueBetweenUnits(
  rawValue: string,
  fromUnit: string,
  toUnit: string
): string {
  if (!rawValue || fromUnit === toUnit) return rawValue;
  const num = Number(rawValue);
  if (Number.isNaN(num)) return rawValue;

  if (fromUnit === "°C" && toUnit === "°F") {
    return String(Number(((num * 9) / 5 + 32).toFixed(1)));
  }
  if (fromUnit === "°F" && toUnit === "°C") {
    return String(Number((((num - 32) * 5) / 9).toFixed(1)));
  }
  if (fromUnit === "min" && toUnit === "hr") {
    return String(Number((num / 60).toFixed(2)));
  }
  if (fromUnit === "hr" && toUnit === "min") {
    return String(Math.round(num * 60));
  }
  return rawValue;
}

function getThresholdAndSampleFromSettings(
  type: string,
  severity: "LOW" | "MEDIUM" | "HIGH",
  settings: AlertSettingsConfig
): { threshold: number; sampleMeasured: number; unit: string } {
  switch (type) {
    case "HIGH_TEMP": {
      const th =
        severity === "HIGH"
          ? settings.temp_critical_c
          : settings.temp_warning_c;
      return {
        threshold: th,
        sampleMeasured: +(th + 2.4).toFixed(1),
        unit: "°C",
      };
    }
    case "GHOST_COOLING": {
      const th = settings.ghost_cooling_temp_c;
      return {
        threshold: th,
        sampleMeasured: +(th - 1.5).toFixed(1),
        unit: "°C",
      };
    }
    case "HIGH_NOISE": {
      const th =
        severity === "HIGH"
          ? settings.noise_critical_db
          : settings.noise_warning_db;
      return {
        threshold: th,
        sampleMeasured: Math.round(th + 8),
        unit: "dB",
      };
    }
    case "HIGH_HUMIDITY": {
      const th =
        severity === "HIGH"
          ? settings.humidity_critical_pct
          : settings.humidity_warning_pct;
      return {
        threshold: th,
        sampleMeasured: Math.min(99, Math.round(th + 5)),
        unit: "%",
      };
    }
    case "SENSOR_OFFLINE": {
      const th =
        severity === "HIGH"
          ? settings.offline_critical_min
          : settings.offline_warning_min;
      return {
        threshold: th,
        sampleMeasured: th + 10,
        unit: "min",
      };
    }
    default:
      return { threshold: 0, sampleMeasured: 0, unit: "" };
  }
}

function buildAutoMessage(
  type: string,
  roomLabel: string,
  threshold: number | string,
  measured: number | string,
  unit: string
): string {
  const measStr = formatValueWithUnit(measured, unit);
  const thStr = formatValueWithUnit(threshold, unit);
  switch (type) {
    case "GHOST_COOLING":
      return `Energy waste in ${roomLabel}: Room is vacant while AC/lights are active at ${measStr} (threshold: ${thStr})`;
    case "HIGH_TEMP":
      return `High temperature (${measStr}) detected in ${roomLabel} (threshold: ${thStr})`;
    case "HIGH_NOISE":
      return `Excessive noise level (${measStr}) detected in ${roomLabel} (threshold: ${thStr})`;
    case "HIGH_HUMIDITY":
      return `High humidity (${measStr}) detected in ${roomLabel} (threshold: ${thStr})`;
    case "SENSOR_OFFLINE":
      return `Sensor node in ${roomLabel} offline for ${measStr} (threshold: ${thStr})`;
    default:
      return `Anomaly detected in ${roomLabel}`;
  }
}

export default function AlertsPage() {
  const router = useRouter();
  const {
    activeAlerts,
    allAlerts,
    alertSettings,
    loading,
    soundEnabled,
    setSoundEnabled,
    updateAlertSettings,
    playAlertSound,
    refreshAlerts,
    resolveAlert,
    resolveAllAlerts,
    deleteAlert,
    updateAlert,
    triggerManualAlert,
  } = useNotifications();

  const [statusTab, setStatusTab] = useState<"active" | "resolved" | "all">(
    "active"
  );
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [scanning, setScanning] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  // Rooms list for dropdowns
  const [rooms, setRooms] = useState<RoomOption[]>([]);

  // 1. Trigger / Simulate Alert Modal state
  const [isTriggerModalOpen, setIsTriggerModalOpen] = useState(false);
  const [formType, setFormType] = useState("HIGH_TEMP");
  const [formSeverity, setFormSeverity] = useState<"LOW" | "MEDIUM" | "HIGH">(
    "HIGH"
  );
  const [formRoomId, setFormRoomId] = useState<string>("");
  const [formThreshold, setFormThreshold] = useState<string>("30");
  const [formMeasured, setFormMeasured] = useState<string>("32.4");
  const [formUnit, setFormUnit] = useState<string>("°C");
  const [formMessage, setFormMessage] = useState<string>("");
  const [saveThresholdAsDefault, setSaveThresholdAsDefault] = useState(true);
  const [submittingTrigger, setSubmittingTrigger] = useState(false);

  // 2. Edit Existing Alert Modal state
  const [editingAlert, setEditingAlert] = useState<AnomalyItem | null>(null);
  const [editType, setEditType] = useState("HIGH_TEMP");
  const [editSeverity, setEditSeverity] = useState<"LOW" | "MEDIUM" | "HIGH">(
    "HIGH"
  );
  const [editRoomId, setEditRoomId] = useState<string>("");
  const [editThreshold, setEditThreshold] = useState<string>("");
  const [editMeasured, setEditMeasured] = useState<string>("");
  const [editUnit, setEditUnit] = useState<string>("°C");
  const [editMessage, setEditMessage] = useState<string>("");
  const [editIsActive, setEditIsActive] = useState<boolean>(true);
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // 3. Threshold & Notification Settings Modal state
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [settingsDraft, setSettingsDraft] =
    useState<AlertSettingsConfig>(alertSettings);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSavedBanner, setSettingsSavedBanner] = useState<string | null>(
    null
  );

  useEffect(() => {
    setSettingsDraft(alertSettings);
  }, [alertSettings]);

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const token = localStorage.getItem("token");
        const headers: HeadersInit = token
          ? { Authorization: `Bearer ${token}` }
          : {};
        const res = await fetch("/api/rooms", { headers });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setRooms(data);
            if (data.length > 0) {
              setFormRoomId(data[0].room_id);
            }
          }
        }
      } catch {
        // ignore
      }
    };
    fetchRooms();
  }, []);

  // Sync Trigger Modal fields when category or severity changes
  const applyPresetDefaults = (
    nextType: string,
    nextSeverity: "LOW" | "MEDIUM" | "HIGH",
    nextRoomId: string
  ) => {
    const { threshold, sampleMeasured, unit } =
      getThresholdAndSampleFromSettings(nextType, nextSeverity, alertSettings);
    const selectedRoom = rooms.find((r) => r.room_id === nextRoomId);
    const roomLabel = selectedRoom?.name || selectedRoom?.code || "Campus Room";

    setFormThreshold(String(threshold));
    setFormMeasured(String(sampleMeasured));
    setFormUnit(unit);
    setFormMessage(
      buildAutoMessage(nextType, roomLabel, threshold, sampleMeasured, unit)
    );
  };

  const openTriggerModal = () => {
    const defaultType = "HIGH_TEMP";
    const defaultSev = "HIGH";
    const defaultRoom = rooms[0]?.room_id || "";
    setFormType(defaultType);
    setFormSeverity(defaultSev);
    setFormRoomId(defaultRoom);
    applyPresetDefaults(defaultType, defaultSev, defaultRoom);
    setIsTriggerModalOpen(true);
  };

  const openEditModal = (alert: AnomalyItem) => {
    const meta = getAlertMeta(alert.type);
    const fallbackDef = getThresholdAndSampleFromSettings(
      alert.type,
      alert.severity,
      alertSettings
    );
    const normalizedUnit = normalizeUnitForType(
      alert.type,
      alert.unit || meta.unit || fallbackDef.unit
    );
    setEditingAlert(alert);
    setEditType(alert.type);
    setEditSeverity(alert.severity);
    setEditRoomId(alert.room_id || "");
    setEditThreshold(
      alert.threshold_value != null
        ? String(alert.threshold_value)
        : String(fallbackDef.threshold)
    );
    setEditMeasured(
      alert.measured_value != null ? String(alert.measured_value) : ""
    );
    setEditUnit(normalizedUnit);
    setEditMessage(alert.message);
    setEditIsActive(alert.is_active);
  };

  const handleScanNow = async () => {
    setScanning(true);
    try {
      await refreshAlerts(true);
    } finally {
      setTimeout(() => setScanning(false), 500);
    }
  };

  const handleResolveOne = async (id: string) => {
    setResolvingId(id);
    try {
      await resolveAlert(id);
    } finally {
      setResolvingId(null);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formMessage.trim()) return;
    setSubmittingTrigger(true);
    try {
      await triggerManualAlert({
        type: formType,
        severity: formSeverity,
        room_id: formRoomId || null,
        message: formMessage.trim(),
        threshold_value:
          formThreshold !== "" ? Number(formThreshold) : null,
        measured_value:
          formMeasured !== "" ? Number(formMeasured) : null,
        unit: formUnit || null,
        save_threshold_to_settings: saveThresholdAsDefault,
      });
      setIsTriggerModalOpen(false);
    } finally {
      setSubmittingTrigger(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAlert || !editMessage.trim()) return;
    setSubmittingEdit(true);
    try {
      await updateAlert(editingAlert.anomaly_id, {
        type: editType,
        room_id: editRoomId || null,
        severity: editSeverity,
        message: editMessage.trim(),
        threshold_value:
          editThreshold !== "" ? Number(editThreshold) : null,
        measured_value:
          editMeasured !== "" ? Number(editMeasured) : null,
        unit: editUnit || null,
        is_active: editIsActive,
      });
      setEditingAlert(null);
    } finally {
      setSubmittingEdit(false);
    }
  };

  const handleSaveSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsSavedBanner(null);
    try {
      const saved = await updateAlertSettings(settingsDraft);
      if (saved) {
        await refreshAlerts(true);
        setSettingsSavedBanner(
          "Alert thresholds & notification settings saved to database!"
        );
        setTimeout(() => {
          setSettingsSavedBanner(null);
          setIsSettingsModalOpen(false);
        }, 1200);
      }
    } finally {
      setSavingSettings(false);
    }
  };

  // KPI metrics
  const resolvedAlerts = allAlerts.filter((a) => !a.is_active);
  const ghostCoolingCount = activeAlerts.filter(
    (a) => a.type === "GHOST_COOLING"
  ).length;
  const envAlertsCount = activeAlerts.filter(
    (a) =>
      a.type === "HIGH_TEMP" ||
      a.type === "HIGH_NOISE" ||
      a.type === "HIGH_HUMIDITY"
  ).length;
  const offlineCount = activeAlerts.filter(
    (a) => a.type === "SENSOR_OFFLINE"
  ).length;
  const criticalCount = activeAlerts.filter(
    (a) => a.severity === "HIGH"
  ).length;

  // Filter alerts
  const baseList =
    statusTab === "active"
      ? activeAlerts
      : statusTab === "resolved"
        ? resolvedAlerts
        : allAlerts;

  const filteredAlerts = baseList.filter((a) => {
    if (typeFilter !== "ALL" && a.type !== typeFilter) return false;
    if (severityFilter !== "ALL" && a.severity !== severityFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchMsg = a.message?.toLowerCase().includes(q);
      const matchRoom =
        a.rooms?.name?.toLowerCase().includes(q) ||
        a.rooms?.code?.toLowerCase().includes(q);
      const matchType = a.type?.toLowerCase().includes(q);
      if (!matchMsg && !matchRoom && !matchType) return false;
    }
    return true;
  });

  if (loading) {
    return (
      <div className="loading">
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <div>
      {/* Page Header */}
      <div
        className="page-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div>
          <h2>Alerts &amp; Notification Center</h2>
          <p>
            Real-time IoT anomaly monitoring, configurable database thresholds,
            and automated campus notifications
          </p>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              const next = !soundEnabled;
              setSoundEnabled(next);
              if (next) playAlertSound("LOW");
            }}
            title={
              soundEnabled
                ? "Alert sound enabled in DB (click to mute)"
                : "Alert sound muted in DB (click to enable)"
            }
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            {soundEnabled ? "Sound On" : "Muted"}
          </button>

          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setSettingsDraft(alertSettings);
              setSettingsSavedBanner(null);
              setIsSettingsModalOpen(true);
            }}
          >
            <SlidersHorizontal size={15} />
            Threshold Settings
          </button>

          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={handleScanNow}
            disabled={scanning}
          >
            <RefreshCw
              size={15}
              style={{
                animation: scanning ? "spin 0.8s linear infinite" : "none",
              }}
            />
            {scanning ? "Scanning..." : "Scan Campus"}
          </button>

          {activeAlerts.length > 0 && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => resolveAllAlerts()}
            >
              <CheckCheck size={16} />
              Resolve All ({activeAlerts.length})
            </button>
          )}

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={openTriggerModal}
          >
            <Plus size={16} />
            Trigger / Simulate Alert
          </button>
        </div>
      </div>

      {/* Active Database Threshold Summary Strip */}
      <div
        className="card"
        style={{
          padding: "12px 18px",
          marginBottom: 24,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          background: "rgba(0, 173, 181, 0.05)",
          borderColor: "rgba(0, 173, 181, 0.25)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
            fontSize: 12,
          }}
        >
          <span
            style={{
              fontWeight: 700,
              color: "var(--accent-blue)",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <SlidersHorizontal size={14} />
            Active DB Thresholds:
          </span>

          <span style={{ color: "var(--text-secondary)" }}>
            <strong style={{ color: "var(--text-primary)" }}>Temp:</strong>{" "}
            {alertSettings.temp_enabled
              ? `${alertSettings.temp_warning_c}°C (Warn) / ${alertSettings.temp_critical_c}°C (Crit)`
              : "Off"}
          </span>

          <span style={{ color: "var(--text-secondary)" }}>
            <strong style={{ color: "var(--text-primary)" }}>
              Ghost Cooling:
            </strong>{" "}
            {alertSettings.ghost_cooling_enabled
              ? `< ${alertSettings.ghost_cooling_temp_c}°C${
                  alertSettings.ghost_cooling_light_check ? " or Lights ON" : ""
                }`
              : "Off"}
          </span>

          <span style={{ color: "var(--text-secondary)" }}>
            <strong style={{ color: "var(--text-primary)" }}>Noise:</strong>{" "}
            {alertSettings.noise_enabled
              ? `${alertSettings.noise_warning_db} dB / ${alertSettings.noise_critical_db} dB`
              : "Off"}
          </span>

          <span style={{ color: "var(--text-secondary)" }}>
            <strong style={{ color: "var(--text-primary)" }}>Humidity:</strong>{" "}
            {alertSettings.humidity_enabled
              ? `${alertSettings.humidity_warning_pct}% / ${alertSettings.humidity_critical_pct}%`
              : "Off"}
          </span>

          <span style={{ color: "var(--text-secondary)" }}>
            <strong style={{ color: "var(--text-primary)" }}>Offline:</strong>{" "}
            {alertSettings.offline_enabled
              ? `${alertSettings.offline_warning_min} min / ${alertSettings.offline_critical_min} min`
              : "Off"}
          </span>
        </div>

        <button
          type="button"
          className="notif-text-action"
          onClick={() => {
            setSettingsDraft(alertSettings);
            setSettingsSavedBanner(null);
            setIsSettingsModalOpen(true);
          }}
        >
          <SquarePen size={12} />
          Adjust Thresholds
        </button>
      </div>

      {/* KPI Summary Cards */}
      <div className="card-grid" style={{ marginBottom: 28 }}>
        <StatCard
          icon={<Bell size={22} />}
          label="Active Alerts"
          value={activeAlerts.length}
          sub={
            criticalCount > 0
              ? `${criticalCount} critical high-severity`
              : "All high-priority clear"
          }
          color={criticalCount > 0 ? "red" : "blue"}
        />
        <StatCard
          icon={<Ghost size={22} />}
          label="Ghost Cooling / Waste"
          value={ghostCoolingCount}
          sub="Vacant rooms with utilities ON"
          color="amber"
        />
        <StatCard
          icon={<Thermometer size={22} />}
          label="Environmental Alerts"
          value={envAlertsCount}
          sub="Temp, noise & humidity breaches"
          color="purple"
        />
        <StatCard
          icon={<Radio size={22} />}
          label="Offline Sensors"
          value={offlineCount}
          sub="Nodes with stale telemetry"
          color={offlineCount > 0 ? "red" : "green"}
        />
      </div>

      {/* Filter & Status Bar */}
      <div
        className="alerts-toolbar card"
        style={{ marginBottom: 24, padding: 18 }}
      >
        <div className="alerts-toolbar-top">
          {/* Status Tabs */}
          <div className="report-time-pills">
            <button
              type="button"
              className={`report-pill ${
                statusTab === "active" ? "report-pill-active" : ""
              }`}
              onClick={() => setStatusTab("active")}
            >
              Active ({activeAlerts.length})
            </button>
            <button
              type="button"
              className={`report-pill ${
                statusTab === "resolved" ? "report-pill-active" : ""
              }`}
              onClick={() => setStatusTab("resolved")}
            >
              Resolved ({resolvedAlerts.length})
            </button>
            <button
              type="button"
              className={`report-pill ${
                statusTab === "all" ? "report-pill-active" : ""
              }`}
              onClick={() => setStatusTab("all")}
            >
              All History ({allAlerts.length})
            </button>
          </div>

          {/* Search Box */}
          <div
            className="top-navbar-search"
            style={{ maxWidth: 280, minWidth: 200 }}
          >
            <Search size={15} />
            <input
              type="text"
              placeholder="Filter by room or message..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  display: "flex",
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Severity Filter */}
          <select
            className="report-select"
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            style={{ minWidth: 140 }}
          >
            <option value="ALL">All Severities</option>
            <option value="HIGH">High (Critical)</option>
            <option value="MEDIUM">Medium (Warning)</option>
            <option value="LOW">Low (Info)</option>
          </select>
        </div>

        {/* Category Filter Pills */}
        <div className="alerts-type-pills">
          {[
            { key: "ALL", label: "All Categories", icon: Bell },
            { key: "GHOST_COOLING", label: "Ghost Cooling", icon: Ghost },
            { key: "HIGH_TEMP", label: "High Temp", icon: Thermometer },
            { key: "HIGH_NOISE", label: "High Noise", icon: Volume2 },
            { key: "HIGH_HUMIDITY", label: "Humidity", icon: Droplets },
            { key: "SENSOR_OFFLINE", label: "Sensor Offline", icon: Radio },
          ].map((item) => {
            const Icon = item.icon;
            const active = typeFilter === item.key;
            return (
              <button
                key={item.key}
                type="button"
                className={`alerts-type-pill ${active ? "active" : ""}`}
                onClick={() => setTypeFilter(item.key)}
              >
                <Icon size={14} />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Alerts List */}
      {filteredAlerts.length === 0 ? (
        <div className="empty-state card">
          <div
            className="empty-state-icon"
            style={{ color: "var(--accent-green)", opacity: 0.85 }}
          >
            <CircleCheck size={52} strokeWidth={1.5} />
          </div>
          <h3>
            {statusTab === "active"
              ? "All Clear — Campus Running Smoothly"
              : "No Matching Alerts Found"}
          </h3>
          <p style={{ maxWidth: 460, margin: "8px auto 0" }}>
            {statusTab === "active"
              ? "No active anomalies detected across monitored rooms. Live ESP32 telemetry will automatically trigger alerts when configured database thresholds are exceeded."
              : "Try adjusting your category, severity, or search filters."}
          </p>
        </div>
      ) : (
        <div className="alerts-card-list animate-in">
          {filteredAlerts.map((a) => {
            const meta = getAlertMeta(a.type);
            const Icon = meta.icon;
            const sevClass =
              a.severity === "HIGH"
                ? "red"
                : a.severity === "MEDIUM"
                  ? "amber"
                  : "blue";
            const unitStr = a.unit ?? meta.unit ?? "";

            return (
              <div
                key={a.anomaly_id}
                className={`alert-row-card ${
                  a.is_active && a.severity === "HIGH"
                    ? "alert-row-card-critical"
                    : ""
                } ${!a.is_active ? "alert-row-card-resolved" : ""}`}
              >
                <div
                  className="alert-row-icon"
                  style={{ background: meta.bg, color: meta.color }}
                >
                  <Icon size={22} />
                </div>

                <div className="alert-row-main">
                  <div className="alert-row-header">
                    <span className="alert-row-title">{meta.label}</span>

                    <span className={`badge ${sevClass}`}>
                      <span className="badge-dot" />
                      {a.severity}
                    </span>

                    <span
                      className={`badge ${a.is_active ? "red" : "green"}`}
                      style={{ fontSize: 11 }}
                    >
                      {a.is_active ? "Active" : "Resolved"}
                    </span>

                    {a.threshold_value != null && (
                      <span
                        className="badge amber"
                        style={{
                          fontSize: 11,
                          background: "rgba(245, 183, 49, 0.12)",
                          border: "1px solid rgba(245, 183, 49, 0.3)",
                        }}
                      >
                        Threshold: {formatValueWithUnit(a.threshold_value, unitStr)}
                      </span>
                    )}

                    {a.measured_value != null && (
                      <span
                        className="badge blue"
                        style={{
                          fontSize: 11,
                          background: "rgba(0, 173, 181, 0.12)",
                          border: "1px solid rgba(0, 173, 181, 0.3)",
                        }}
                      >
                        Measured: {formatValueWithUnit(a.measured_value, unitStr)}
                      </span>
                    )}

                    {a.rooms?.name || a.room_id ? (
                      <button
                        type="button"
                        className="alert-room-chip"
                        onClick={() =>
                          a.room_id && router.push(`/rooms/${a.room_id}`)
                        }
                        title="Open room IoT dashboard"
                      >
                        <DoorOpen size={13} />
                        {a.rooms?.name || `Room ${a.room_id?.slice(0, 8)}`}
                        {a.rooms?.code ? ` (${a.rooms.code})` : ""}
                        {a.room_id && <ExternalLink size={11} />}
                      </button>
                    ) : null}
                  </div>

                  <p className="alert-row-message">{a.message}</p>

                  {a.is_active && a.recommendation && (
                    <div className="alert-row-recommendation">
                      <Info size={14} style={{ flexShrink: 0 }} />
                      <span>{a.recommendation}</span>
                    </div>
                  )}

                  <div className="alert-row-meta">
                    <span className="alert-meta-item">
                      <Clock size={13} />
                      Started {formatRelativeTime(a.start_at)} (
                      {new Date(a.start_at).toLocaleString()})
                    </span>
                    {!a.is_active && a.end_at && (
                      <span
                        className="alert-meta-item"
                        style={{ color: "var(--accent-green)" }}
                      >
                        <Check size={13} />
                        Resolved {formatRelativeTime(a.end_at)} (
                        {new Date(a.end_at).toLocaleString()})
                      </span>
                    )}
                  </div>
                </div>

                <div className="alert-row-actions">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => openEditModal(a)}
                    title="Edit alert threshold, severity, or message"
                  >
                    <SquarePen size={14} />
                    Edit
                  </button>

                  {a.room_id && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => router.push(`/rooms/${a.room_id}`)}
                    >
                      <ExternalLink size={14} />
                      Room
                    </button>
                  )}

                  {a.is_active ? (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={resolvingId === a.anomaly_id}
                      onClick={() => handleResolveOne(a.anomaly_id)}
                    >
                      <Check size={14} />
                      {resolvingId === a.anomaly_id
                        ? "Resolving..."
                        : "Resolve"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => deleteAlert(a.anomaly_id)}
                      title="Delete from history"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          1. TRIGGER / SIMULATE ALERT MODAL (with Threshold Level Input)
         ════════════════════════════════════════════════════════════════ */}
      {isTriggerModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.68)",
            backdropFilter: "blur(4px)",
          }}
          onClick={() => setIsTriggerModalOpen(false)}
        >
          <div
            className="card animate-in"
            style={{
              width: "100%",
              maxWidth: 520,
              margin: 20,
              zIndex: 101,
              maxHeight: "90vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 20,
              }}
            >
              <div>
                <h3 style={{ fontSize: 19, fontWeight: 700 }}>
                  Trigger / Simulate Campus Alert
                </h3>
                <p
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    marginTop: 2,
                  }}
                >
                  Configure threshold level &amp; simulated value and save to
                  database
                </p>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ padding: 6 }}
                onClick={() => setIsTriggerModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit}>
              <div className="form-group">
                <label className="form-label">Alert Category</label>
                <select
                  className="form-input"
                  value={formType}
                  onChange={(e) => {
                    const nextType = e.target.value;
                    const opt = ALERT_TYPE_OPTIONS.find(
                      (o) => o.type === nextType
                    );
                    const nextSev = opt?.defaultSeverity || formSeverity;
                    setFormType(nextType);
                    setFormSeverity(nextSev);
                    applyPresetDefaults(nextType, nextSev, formRoomId);
                  }}
                >
                  {ALERT_TYPE_OPTIONS.map((p) => (
                    <option key={p.type} value={p.type}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "flex", gap: 14 }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Target Room</label>
                  <select
                    className="form-input"
                    value={formRoomId}
                    onChange={(e) => {
                      const nextRoomId = e.target.value;
                      setFormRoomId(nextRoomId);
                      const selectedRoom = rooms.find(
                        (r) => r.room_id === nextRoomId
                      );
                      const roomLabel =
                        selectedRoom?.name ||
                        selectedRoom?.code ||
                        "Campus Room";
                      setFormMessage(
                        buildAutoMessage(
                          formType,
                          roomLabel,
                          formThreshold,
                          formMeasured,
                          formUnit
                        )
                      );
                    }}
                  >
                    <option value="">Campus-wide / Unassigned</option>
                    {rooms.map((r) => (
                      <option key={r.room_id} value={r.room_id}>
                        {r.name} {r.code ? `(${r.code})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ width: 165 }}>
                  <label className="form-label">Severity</label>
                  <select
                    className="form-input"
                    value={formSeverity}
                    onChange={(e) => {
                      const nextSev = e.target.value as
                        | "LOW"
                        | "MEDIUM"
                        | "HIGH";
                      setFormSeverity(nextSev);
                      applyPresetDefaults(formType, nextSev, formRoomId);
                    }}
                  >
                    <option value="HIGH">HIGH (Critical)</option>
                    <option value="MEDIUM">MEDIUM (Warning)</option>
                    <option value="LOW">LOW (Info)</option>
                  </select>
                </div>
              </div>

              {/* Threshold Level & Measured Value Inputs */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 140px",
                  gap: 12,
                  padding: 14,
                  background: "var(--bg-surface)",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-color)",
                  marginBottom: 16,
                }}
              >
                <div>
                  <label className="form-label" style={{ marginBottom: 4 }}>
                    Threshold Level
                  </label>
                  <div className="unit-input-wrap">
                    <input
                      type="number"
                      step="any"
                      value={formThreshold}
                      onChange={(e) => {
                        const nextTh = e.target.value;
                        setFormThreshold(nextTh);
                        const selectedRoom = rooms.find(
                          (r) => r.room_id === formRoomId
                        );
                        const roomLabel =
                          selectedRoom?.name ||
                          selectedRoom?.code ||
                          "Campus Room";
                        setFormMessage(
                          buildAutoMessage(
                            formType,
                            roomLabel,
                            nextTh,
                            formMeasured,
                            formUnit
                          )
                        );
                      }}
                      placeholder="e.g. 30"
                      required
                    />
                    <span className="unit-input-badge">{formUnit}</span>
                  </div>
                </div>

                <div>
                  <label className="form-label" style={{ marginBottom: 4 }}>
                    Measured Value
                  </label>
                  <div className="unit-input-wrap">
                    <input
                      type="number"
                      step="any"
                      value={formMeasured}
                      onChange={(e) => {
                        const nextVal = e.target.value;
                        setFormMeasured(nextVal);
                        const selectedRoom = rooms.find(
                          (r) => r.room_id === formRoomId
                        );
                        const roomLabel =
                          selectedRoom?.name ||
                          selectedRoom?.code ||
                          "Campus Room";
                        setFormMessage(
                          buildAutoMessage(
                            formType,
                            roomLabel,
                            formThreshold,
                            nextVal,
                            formUnit
                          )
                        );
                      }}
                      placeholder="e.g. 32.5"
                    />
                    <span className="unit-input-badge">{formUnit}</span>
                  </div>
                </div>

                <div>
                  <label className="form-label" style={{ marginBottom: 4 }}>
                    Unit
                  </label>
                  <select
                    className="form-input"
                    style={{ padding: "11px 10px" }}
                    value={formUnit}
                    onChange={(e) => {
                      const nextUnit = e.target.value;
                      const prevUnit = formUnit;
                      const nextTh = convertValueBetweenUnits(
                        formThreshold,
                        prevUnit,
                        nextUnit
                      );
                      const nextVal = convertValueBetweenUnits(
                        formMeasured,
                        prevUnit,
                        nextUnit
                      );
                      setFormUnit(nextUnit);
                      setFormThreshold(nextTh);
                      setFormMeasured(nextVal);
                      const selectedRoom = rooms.find(
                        (r) => r.room_id === formRoomId
                      );
                      const roomLabel =
                        selectedRoom?.name ||
                        selectedRoom?.code ||
                        "Campus Room";
                      setFormMessage(
                        buildAutoMessage(
                          formType,
                          roomLabel,
                          nextTh,
                          nextVal,
                          nextUnit
                        )
                      );
                    }}
                  >
                    {getUnitOptionsForType(formType).map((u) => (
                      <option key={u.value} value={u.value}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                </div>

                <label
                  style={{
                    gridColumn: "1 / -1",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 12,
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                    marginTop: 4,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={saveThresholdAsDefault}
                    onChange={(e) =>
                      setSaveThresholdAsDefault(e.target.checked)
                    }
                    style={{ width: 15, height: 15, cursor: "pointer" }}
                  />
                  Also save this threshold (
                  {formatValueWithUnit(formThreshold, formUnit)}) as the default
                  rule in database settings
                </label>
              </div>

              <div className="form-group">
                <label className="form-label">Alert Notification Message</label>
                <input
                  type="text"
                  className="form-input"
                  value={formMessage}
                  onChange={(e) => setFormMessage(e.target.value)}
                  placeholder="Describe the anomaly..."
                  required
                />
              </div>

              <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ flex: 1, justifyContent: "center" }}
                  onClick={() => setIsTriggerModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1, justifyContent: "center" }}
                  disabled={submittingTrigger}
                >
                  <Bell size={16} />
                  {submittingTrigger
                    ? "Saving & Triggering..."
                    : "Trigger & Save Alert"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          2. EDIT EXISTING ALERT MODAL ("Adjust Already Put Alert")
         ════════════════════════════════════════════════════════════════ */}
      {editingAlert && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.68)",
            backdropFilter: "blur(4px)",
          }}
          onClick={() => setEditingAlert(null)}
        >
          <div
            className="card animate-in"
            style={{
              width: "100%",
              maxWidth: 520,
              margin: 20,
              zIndex: 101,
              maxHeight: "90vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 20,
              }}
            >
              <div>
                <h3 style={{ fontSize: 19, fontWeight: 700 }}>
                  Edit / Adjust Alert
                </h3>
                <p
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    marginTop: 2,
                  }}
                >
                  Modify threshold level, severity, status, or message in the
                  database
                </p>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ padding: 6 }}
                onClick={() => setEditingAlert(null)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit}>
              <div style={{ display: "flex", gap: 14 }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Alert Category</label>
                  <select
                    className="form-input"
                    value={editType}
                    onChange={(e) => {
                      const nextType = e.target.value;
                      const def = getThresholdAndSampleFromSettings(
                        nextType,
                        editSeverity,
                        alertSettings
                      );
                      const nextUnit = def.unit;
                      setEditType(nextType);
                      setEditUnit(nextUnit);
                      setEditThreshold(String(def.threshold));
                      if (!editMeasured) {
                        setEditMeasured(String(def.sampleMeasured));
                      }
                      const selectedRoom = rooms.find(
                        (r) => r.room_id === editRoomId
                      );
                      const roomLabel =
                        selectedRoom?.name ||
                        selectedRoom?.code ||
                        "Campus Room";
                      setEditMessage(
                        buildAutoMessage(
                          nextType,
                          roomLabel,
                          def.threshold,
                          editMeasured || def.sampleMeasured,
                          nextUnit
                        )
                      );
                    }}
                  >
                    {ALERT_TYPE_OPTIONS.map((p) => (
                      <option key={p.type} value={p.type}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ width: 155 }}>
                  <label className="form-label">Status</label>
                  <select
                    className="form-input"
                    value={editIsActive ? "active" : "resolved"}
                    onChange={(e) =>
                      setEditIsActive(e.target.value === "active")
                    }
                  >
                    <option value="active">Active</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "flex", gap: 14 }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Target Room</label>
                  <select
                    className="form-input"
                    value={editRoomId}
                    onChange={(e) => setEditRoomId(e.target.value)}
                  >
                    <option value="">Campus-wide / Unassigned</option>
                    {rooms.map((r) => (
                      <option key={r.room_id} value={r.room_id}>
                        {r.name} {r.code ? `(${r.code})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ width: 165 }}>
                  <label className="form-label">Severity</label>
                  <select
                    className="form-input"
                    value={editSeverity}
                    onChange={(e) =>
                      setEditSeverity(
                        e.target.value as "LOW" | "MEDIUM" | "HIGH"
                      )
                    }
                  >
                    <option value="HIGH">HIGH (Critical)</option>
                    <option value="MEDIUM">MEDIUM (Warning)</option>
                    <option value="LOW">LOW (Info)</option>
                  </select>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 140px",
                  gap: 12,
                  padding: 14,
                  background: "var(--bg-surface)",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-color)",
                  marginBottom: 16,
                }}
              >
                <div>
                  <label className="form-label" style={{ marginBottom: 4 }}>
                    Threshold Level
                  </label>
                  <div className="unit-input-wrap">
                    <input
                      type="number"
                      step="any"
                      value={editThreshold}
                      onChange={(e) => setEditThreshold(e.target.value)}
                      placeholder="e.g. 30"
                    />
                    <span className="unit-input-badge">{editUnit}</span>
                  </div>
                </div>

                <div>
                  <label className="form-label" style={{ marginBottom: 4 }}>
                    Measured Value
                  </label>
                  <div className="unit-input-wrap">
                    <input
                      type="number"
                      step="any"
                      value={editMeasured}
                      onChange={(e) => setEditMeasured(e.target.value)}
                      placeholder="e.g. 32.5"
                    />
                    <span className="unit-input-badge">{editUnit}</span>
                  </div>
                </div>

                <div>
                  <label className="form-label" style={{ marginBottom: 4 }}>
                    Unit
                  </label>
                  <select
                    className="form-input"
                    style={{ padding: "11px 10px" }}
                    value={editUnit}
                    onChange={(e) => {
                      const nextUnit = e.target.value;
                      const prevUnit = editUnit;
                      const nextTh = convertValueBetweenUnits(
                        editThreshold,
                        prevUnit,
                        nextUnit
                      );
                      const nextVal = convertValueBetweenUnits(
                        editMeasured,
                        prevUnit,
                        nextUnit
                      );
                      setEditUnit(nextUnit);
                      setEditThreshold(nextTh);
                      setEditMeasured(nextVal);
                      const selectedRoom = rooms.find(
                        (r) => r.room_id === editRoomId
                      );
                      const roomLabel =
                        selectedRoom?.name ||
                        selectedRoom?.code ||
                        "Campus Room";
                      setEditMessage(
                        buildAutoMessage(
                          editType,
                          roomLabel,
                          nextTh,
                          nextVal || nextTh,
                          nextUnit
                        )
                      );
                    }}
                  >
                    {getUnitOptionsForType(editType).map((u) => (
                      <option key={u.value} value={u.value}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 6,
                  }}
                >
                  <label className="form-label" style={{ marginBottom: 0 }}>
                    Alert Message
                  </label>
                  <button
                    type="button"
                    className="notif-text-action"
                    onClick={() => {
                      const selectedRoom = rooms.find(
                        (r) => r.room_id === editRoomId
                      );
                      const roomLabel =
                        selectedRoom?.name ||
                        selectedRoom?.code ||
                        "Campus Room";
                      setEditMessage(
                        buildAutoMessage(
                          editType,
                          roomLabel,
                          editThreshold || "0",
                          editMeasured || editThreshold || "0",
                          editUnit
                        )
                      );
                    }}
                    title="Regenerate message using current room, values, and unit"
                  >
                    <RefreshCw size={11} />
                    Sync message
                  </button>
                </div>
                <input
                  type="text"
                  className="form-input"
                  value={editMessage}
                  onChange={(e) => setEditMessage(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ flex: 1, justifyContent: "center" }}
                  onClick={() => setEditingAlert(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1, justifyContent: "center" }}
                  disabled={submittingEdit}
                >
                  <Save size={16} />
                  {submittingEdit ? "Saving..." : "Save Changes to DB"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          3. DATABASE ALERT THRESHOLD & NOTIFICATION SETTINGS MODAL
         ════════════════════════════════════════════════════════════════ */}
      {isSettingsModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.68)",
            backdropFilter: "blur(4px)",
          }}
          onClick={() => setIsSettingsModalOpen(false)}
        >
          <div
            className="card animate-in"
            style={{
              width: "100%",
              maxWidth: 640,
              margin: 20,
              zIndex: 101,
              maxHeight: "90vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 18,
              }}
            >
              <div>
                <h3 style={{ fontSize: 19, fontWeight: 700 }}>
                  Campus Alert Threshold &amp; Notification Settings
                </h3>
                <p
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    marginTop: 2,
                  }}
                >
                  All threshold rules and notification preferences are stored in
                  the Supabase database
                </p>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ padding: 6 }}
                onClick={() => setIsSettingsModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            {settingsSavedBanner && (
              <div className="settings-msg settings-msg-success">
                {settingsSavedBanner}
              </div>
            )}

            <form onSubmit={handleSaveSettingsSubmit}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                }}
              >
                {/* Temperature Rule */}
                <div
                  style={{
                    padding: 16,
                    background: "var(--bg-surface)",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-color)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 12,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontWeight: 600,
                      }}
                    >
                      <Thermometer
                        size={17}
                        style={{ color: "var(--accent-red)" }}
                      />
                      High Temperature Thresholds (°C)
                    </div>
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={settingsDraft.temp_enabled}
                        onChange={(e) =>
                          setSettingsDraft({
                            ...settingsDraft,
                            temp_enabled: e.target.checked,
                          })
                        }
                      />
                      Enabled
                    </label>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 12,
                    }}
                  >
                    <div>
                      <label className="form-label">
                        Warning Threshold (MEDIUM)
                      </label>
                      <div className="unit-input-wrap">
                        <input
                          type="number"
                          step="0.5"
                          value={settingsDraft.temp_warning_c}
                          onChange={(e) =>
                            setSettingsDraft({
                              ...settingsDraft,
                              temp_warning_c: Number(e.target.value),
                            })
                          }
                        />
                        <span className="unit-input-badge">°C</span>
                      </div>
                    </div>
                    <div>
                      <label className="form-label">
                        Critical Threshold (HIGH)
                      </label>
                      <div className="unit-input-wrap">
                        <input
                          type="number"
                          step="0.5"
                          value={settingsDraft.temp_critical_c}
                          onChange={(e) =>
                            setSettingsDraft({
                              ...settingsDraft,
                              temp_critical_c: Number(e.target.value),
                            })
                          }
                        />
                        <span className="unit-input-badge">°C</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Ghost Cooling Rule */}
                <div
                  style={{
                    padding: 16,
                    background: "var(--bg-surface)",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-color)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 12,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontWeight: 600,
                      }}
                    >
                      <Ghost
                        size={17}
                        style={{ color: "var(--accent-amber)" }}
                      />
                      Ghost Cooling / Energy Waste Rule
                    </div>
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={settingsDraft.ghost_cooling_enabled}
                        onChange={(e) =>
                          setSettingsDraft({
                            ...settingsDraft,
                            ghost_cooling_enabled: e.target.checked,
                          })
                        }
                      />
                      Enabled
                    </label>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 12,
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <label className="form-label">
                        Vacant Over-Cooling Temp (Below)
                      </label>
                      <div className="unit-input-wrap">
                        <input
                          type="number"
                          step="0.5"
                          value={settingsDraft.ghost_cooling_temp_c}
                          onChange={(e) =>
                            setSettingsDraft({
                              ...settingsDraft,
                              ghost_cooling_temp_c: Number(e.target.value),
                            })
                          }
                        />
                        <span className="unit-input-badge">°C</span>
                      </div>
                    </div>
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 13,
                        color: "var(--text-secondary)",
                        cursor: "pointer",
                        marginTop: 18,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={settingsDraft.ghost_cooling_light_check}
                        onChange={(e) =>
                          setSettingsDraft({
                            ...settingsDraft,
                            ghost_cooling_light_check: e.target.checked,
                          })
                        }
                      />
                      Alert when Vacant &amp; Lights ON
                    </label>
                  </div>
                </div>

                {/* Noise Rule */}
                <div
                  style={{
                    padding: 16,
                    background: "var(--bg-surface)",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-color)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 12,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontWeight: 600,
                      }}
                    >
                      <Volume2 size={17} style={{ color: "#a855f7" }} />
                      Acoustic Noise Thresholds (dB)
                    </div>
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={settingsDraft.noise_enabled}
                        onChange={(e) =>
                          setSettingsDraft({
                            ...settingsDraft,
                            noise_enabled: e.target.checked,
                          })
                        }
                      />
                      Enabled
                    </label>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 12,
                    }}
                  >
                    <div>
                      <label className="form-label">
                        Warning Threshold (MEDIUM)
                      </label>
                      <div className="unit-input-wrap">
                        <input
                          type="number"
                          value={settingsDraft.noise_warning_db}
                          onChange={(e) =>
                            setSettingsDraft({
                              ...settingsDraft,
                              noise_warning_db: Number(e.target.value),
                            })
                          }
                        />
                        <span className="unit-input-badge">dB</span>
                      </div>
                    </div>
                    <div>
                      <label className="form-label">
                        Critical Threshold (HIGH)
                      </label>
                      <div className="unit-input-wrap">
                        <input
                          type="number"
                          value={settingsDraft.noise_critical_db}
                          onChange={(e) =>
                            setSettingsDraft({
                              ...settingsDraft,
                              noise_critical_db: Number(e.target.value),
                            })
                          }
                        />
                        <span className="unit-input-badge">dB</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Humidity & Offline Rules */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 14,
                  }}
                >
                  <div
                    style={{
                      padding: 16,
                      background: "var(--bg-surface)",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border-color)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 10,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          fontWeight: 600,
                          fontSize: 13,
                        }}
                      >
                        <Droplets
                          size={15}
                          style={{ color: "var(--accent-blue)" }}
                        />
                        Humidity (%)
                      </div>
                      <input
                        type="checkbox"
                        checked={settingsDraft.humidity_enabled}
                        onChange={(e) =>
                          setSettingsDraft({
                            ...settingsDraft,
                            humidity_enabled: e.target.checked,
                          })
                        }
                      />
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <label className="form-label">Warning</label>
                        <div className="unit-input-wrap">
                          <input
                            type="number"
                            value={settingsDraft.humidity_warning_pct}
                            onChange={(e) =>
                              setSettingsDraft({
                                ...settingsDraft,
                                humidity_warning_pct: Number(e.target.value),
                              })
                            }
                          />
                          <span className="unit-input-badge">%</span>
                        </div>
                      </div>
                      <div style={{ flex: 1 }}>
                        <label className="form-label">Critical</label>
                        <div className="unit-input-wrap">
                          <input
                            type="number"
                            value={settingsDraft.humidity_critical_pct}
                            onChange={(e) =>
                              setSettingsDraft({
                                ...settingsDraft,
                                humidity_critical_pct: Number(e.target.value),
                              })
                            }
                          />
                          <span className="unit-input-badge">%</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      padding: 16,
                      background: "var(--bg-surface)",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border-color)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 10,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          fontWeight: 600,
                          fontSize: 13,
                        }}
                      >
                        <Radio
                          size={15}
                          style={{ color: "var(--accent-red)" }}
                        />
                        Offline (min)
                      </div>
                      <input
                        type="checkbox"
                        checked={settingsDraft.offline_enabled}
                        onChange={(e) =>
                          setSettingsDraft({
                            ...settingsDraft,
                            offline_enabled: e.target.checked,
                          })
                        }
                      />
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <label className="form-label">Warning</label>
                        <div className="unit-input-wrap">
                          <input
                            type="number"
                            value={settingsDraft.offline_warning_min}
                            onChange={(e) =>
                              setSettingsDraft({
                                ...settingsDraft,
                                offline_warning_min: Number(e.target.value),
                              })
                            }
                          />
                          <span className="unit-input-badge">min</span>
                        </div>
                      </div>
                      <div style={{ flex: 1 }}>
                        <label className="form-label">Critical</label>
                        <div className="unit-input-wrap">
                          <input
                            type="number"
                            value={settingsDraft.offline_critical_min}
                            onChange={(e) =>
                              setSettingsDraft({
                                ...settingsDraft,
                                offline_critical_min: Number(e.target.value),
                              })
                            }
                          />
                          <span className="unit-input-badge">min</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Notification Delivery & Auto-Resolve Options */}
                <div
                  style={{
                    padding: 16,
                    background: "var(--bg-surface)",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-color)",
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 10,
                  }}
                >
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={settingsDraft.sound_enabled}
                      onChange={(e) =>
                        setSettingsDraft({
                          ...settingsDraft,
                          sound_enabled: e.target.checked,
                        })
                      }
                    />
                    Enable Audio Alert Chime
                  </label>

                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={settingsDraft.toast_enabled}
                      onChange={(e) =>
                        setSettingsDraft({
                          ...settingsDraft,
                          toast_enabled: e.target.checked,
                        })
                      }
                    />
                    Enable Live Popup Toasts
                  </label>

                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={settingsDraft.auto_resolve}
                      onChange={(e) =>
                        setSettingsDraft({
                          ...settingsDraft,
                          auto_resolve: e.target.checked,
                        })
                      }
                    />
                    Auto-Resolve When Normal
                  </label>

                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={settingsDraft.desktop_enabled}
                      onChange={(e) =>
                        setSettingsDraft({
                          ...settingsDraft,
                          desktop_enabled: e.target.checked,
                        })
                      }
                    />
                    Browser Desktop Notifications
                  </label>
                </div>
              </div>

              <div style={{ display: "flex", gap: 12, marginTop: 22 }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ flex: 1, justifyContent: "center" }}
                  onClick={() => setIsSettingsModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1, justifyContent: "center" }}
                  disabled={savingSettings}
                >
                  <Save size={16} />
                  {savingSettings
                    ? "Saving to Database..."
                    : "Save Settings to Database"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
