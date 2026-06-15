"use client";

import { useState, useEffect, useCallback } from "react";

/* ── Types ── */
interface Building {
  building_id: string;
  name: string;
  address: string;
  floors: any[];
  rooms: any[];
  created_at: string;
}

interface RoomReport {
  room_id: string;
  name: string;
  code: string;
  type: string;
  building_id: string;
  room_status: any[];
  sensor_nodes: any[];
  stats: {
    totalReadings: number;
    avgTemperature: number | null;
    occupancyRate: number | null;
  };
}

interface AlertReport {
  anomaly_id: string;
  type: string;
  severity: string;
  message: string;
  is_active: boolean;
  start_at: string;
  end_at: string | null;
  rooms: { name: string; code: string } | null;
}

interface SensorReport {
  node_id: string;
  device_name: string;
  is_active: boolean;
  firmware_version: string;
  last_seen_at: string | null;
  rooms: { name: string; code: string; building_id: string } | null;
}

type ReportCategory = "buildings" | "rooms" | "alerts" | "sensors";

const CATEGORIES: { key: ReportCategory; label: string; icon: string; desc: string }[] = [
  { key: "buildings", label: "Buildings", icon: "🏢", desc: "Building-wise overview with floor & room counts" },
  { key: "rooms", label: "Rooms", icon: "🚪", desc: "Room-wise occupancy, temperature & sensor data" },
  { key: "alerts", label: "Alerts & Anomalies", icon: "🔔", desc: "Active and resolved anomaly history" },
  { key: "sensors", label: "Sensor Nodes", icon: "📡", desc: "IoT device inventory and health status" },
];

const TIME_RANGES = [
  { label: "All Time", value: "all" },
  { label: "Past 24h", value: "24h" },
  { label: "Past 7 Days", value: "7d" },
  { label: "Past 30 Days", value: "30d" },
];

const ROOM_TYPES = [
  { label: "All Types", value: "" },
  { label: "Hall", value: "HALL" },
  { label: "Lab", value: "LAB" },
  { label: "Office", value: "OFFICE" },
];

export default function ReportsPage() {
  /* ── State ── */
  const [activeCategory, setActiveCategory] = useState<ReportCategory>("buildings");
  const [timeRange, setTimeRange] = useState("all");
  const [roomType, setRoomType] = useState("");
  const [buildingFilter, setBuildingFilter] = useState("");
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [downloadingFormat, setDownloadingFormat] = useState<string | null>(null);
  const [allBuildings, setAllBuildings] = useState<{ building_id: string; name: string }[]>([]);

  /* ── Fetch building list for filter dropdown ── */
  useEffect(() => {
    const fetchBuildings = async () => {
      try {
        const token = localStorage.getItem("token");
        const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch("/api/buildings", { headers });
        if (res.ok) {
          const data = await res.json();
          setAllBuildings(data);
        }
      } catch (err) {
        console.error("Failed to fetch buildings list:", err);
      }
    };
    fetchBuildings();
  }, []);

  /* ── Generate report ── */
  const generateReport = useCallback(async () => {
    setLoading(true);
    setReportData(null);
    try {
      const token = localStorage.getItem("token");
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

      const params = new URLSearchParams({
        category: activeCategory,
        range: timeRange,
        format: "json",
      });
      if (buildingFilter) params.set("building_id", buildingFilter);
      if (roomType) params.set("room_type", roomType);

      const res = await fetch(`/api/reports?${params}`, { headers });
      if (!res.ok) throw new Error("Failed to fetch report");
      const data = await res.json();
      setReportData(data);
    } catch (err) {
      console.error("Failed to generate report:", err);
    } finally {
      setLoading(false);
    }
  }, [activeCategory, timeRange, buildingFilter, roomType]);

  /* ── Auto-generate on filter change ── */
  useEffect(() => {
    generateReport();
  }, [generateReport]);

  /* ── Download handler ── */
  const handleDownload = async (format: "json" | "csv") => {
    try {
      setDownloadingFormat(format);
      const token = localStorage.getItem("token");
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

      const params = new URLSearchParams({
        category: activeCategory,
        range: timeRange,
        format,
      });
      if (buildingFilter) params.set("building_id", buildingFilter);
      if (roomType) params.set("room_type", roomType);

      const res = await fetch(`/api/reports?${params}`, { headers });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `navsense-${activeCategory}-report-${new Date().toISOString().split("T")[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error(`Failed to download ${format} report:`, err);
    } finally {
      setDownloadingFormat(null);
    }
  };

  /* ── Helpers ── */
  const getBuildingName = (id: string) => allBuildings.find(b => b.building_id === id)?.name || id?.slice(0, 8);
  const formatDate = (d: string) => d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—";
  const formatDateTime = (d: string) => d ? new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

  return (
    <div>
      <div className="page-header">
        <h2>Reports</h2>
        <p>Generate customized, categorized reports for your smart campus</p>
      </div>

      {/* ── Category Tabs ── */}
      <div className="report-tabs">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            className={`report-tab ${activeCategory === cat.key ? "report-tab-active" : ""}`}
            onClick={() => setActiveCategory(cat.key)}
          >
            <span className="report-tab-icon">{cat.icon}</span>
            <span className="report-tab-label">{cat.label}</span>
          </button>
        ))}
      </div>

      {/* ── Active category description ── */}
      <div className="report-category-desc">
        {CATEGORIES.find(c => c.key === activeCategory)?.desc}
      </div>

      {/* ── Filters Bar ── */}
      <div className="report-filters">
        <div className="report-filter-group">
          <label className="report-filter-label">Building</label>
          <select
            className="report-select"
            value={buildingFilter}
            onChange={(e) => setBuildingFilter(e.target.value)}
          >
            <option value="">All Buildings</option>
            {allBuildings.map((b) => (
              <option key={b.building_id} value={b.building_id}>
                {b.name || b.building_id.slice(0, 8)}
              </option>
            ))}
          </select>
        </div>

        {(activeCategory === "rooms") && (
          <div className="report-filter-group">
            <label className="report-filter-label">Room Type</label>
            <select
              className="report-select"
              value={roomType}
              onChange={(e) => setRoomType(e.target.value)}
            >
              {ROOM_TYPES.map((rt) => (
                <option key={rt.value} value={rt.value}>{rt.label}</option>
              ))}
            </select>
          </div>
        )}

        {(activeCategory === "alerts" || activeCategory === "rooms") && (
          <div className="report-filter-group">
            <label className="report-filter-label">Time Range</label>
            <div className="report-time-pills">
              {TIME_RANGES.map((tr) => (
                <button
                  key={tr.value}
                  className={`report-pill ${timeRange === tr.value ? "report-pill-active" : ""}`}
                  onClick={() => setTimeRange(tr.value)}
                >
                  {tr.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="report-filter-actions">
          <button
            className="btn btn-primary btn-sm"
            onClick={() => handleDownload("csv")}
            disabled={downloadingFormat === "csv" || loading}
          >
            {downloadingFormat === "csv" ? "⏳" : "📥"} CSV
          </button>
        </div>
      </div>

      {/* ── Report Content ── */}
      {loading ? (
        <div className="loading" style={{ padding: 60 }}>
          <div className="loading-spinner" />
        </div>
      ) : (
        <div className="report-content animate-in">
          {activeCategory === "buildings" && renderBuildingsReport(reportData, formatDate)}
          {activeCategory === "rooms" && renderRoomsReport(reportData, getBuildingName)}
          {activeCategory === "alerts" && renderAlertsReport(reportData, formatDateTime)}
          {activeCategory === "sensors" && renderSensorsReport(reportData, formatDateTime)}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════
   BUILDINGS REPORT
   ════════════════════════════════════════════════ */
function renderBuildingsReport(data: any, formatDate: (d: string) => string) {
  const buildings: Building[] = data?.buildings || [];
  if (buildings.length === 0) {
    return <EmptyReport icon="🏢" title="No buildings found" subtitle="Adjust your filters or add buildings to the system." />;
  }

  return (
    <>
      {/* Summary Cards */}
      <div className="report-summary-row">
        <div className="report-summary-card">
          <span className="report-summary-value">{buildings.length}</span>
          <span className="report-summary-label">Total Buildings</span>
        </div>
        <div className="report-summary-card">
          <span className="report-summary-value">
            {buildings.reduce((sum, b) => sum + (b.floors?.length || 0), 0)}
          </span>
          <span className="report-summary-label">Total Floors</span>
        </div>
        <div className="report-summary-card">
          <span className="report-summary-value">
            {buildings.reduce((sum, b) => sum + (b.rooms?.length || 0), 0)}
          </span>
          <span className="report-summary-label">Total Rooms</span>
        </div>
      </div>

      {/* Building-wise detail */}
      {buildings.map((b, i) => (
        <div key={b.building_id} className="report-section" style={{ animationDelay: `${i * 0.05}s` }}>
          <div className="report-section-header">
            <div className="report-section-icon">🏢</div>
            <div>
              <h3>{b.name || "Unnamed Building"}</h3>
              <p>{b.address || "No address"}</p>
            </div>
            <div className="report-section-meta">
              <span className="badge blue">{b.floors?.length || 0} Floors</span>
              <span className="badge green">{b.rooms?.length || 0} Rooms</span>
            </div>
          </div>
          {b.rooms && b.rooms.length > 0 && (
            <div className="report-section-body">
              <table>
                <thead>
                  <tr>
                    <th>Room</th>
                    <th>Code</th>
                    <th>Type</th>
                  </tr>
                </thead>
                <tbody>
                  {b.rooms.map((r: any) => (
                    <tr key={r.room_id}>
                      <td style={{ fontWeight: 500, color: "var(--text-primary)" }}>{r.name || "—"}</td>
                      <td>{r.code || "—"}</td>
                      <td><span className={`badge ${r.type === "LAB" ? "blue" : r.type === "HALL" ? "green" : "amber"}`}>{r.type || "—"}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </>
  );
}

/* ════════════════════════════════════════════════
   ROOMS REPORT
   ════════════════════════════════════════════════ */
function renderRoomsReport(data: any, getBuildingName: (id: string) => string) {
  const rooms: RoomReport[] = data?.rooms || [];
  if (rooms.length === 0) {
    return <EmptyReport icon="🚪" title="No rooms found" subtitle="Adjust your filters or add rooms to the system." />;
  }

  // Group rooms by building
  const grouped: Record<string, RoomReport[]> = {};
  rooms.forEach((r) => {
    const key = r.building_id || "unassigned";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(r);
  });

  // Live occupancy only (latest sensor snapshot, not historical %)
  const totalOccupied = rooms.filter((r) => {
    const status = Array.isArray(r.room_status) ? r.room_status[0] : r.room_status;
    return status?.occupancy === "OCCUPIED";
  }).length;

  // Avg temperature from current live readings (not historical average)
  const tempValues: number[] = [];
  rooms.forEach((r) => {
    const status = Array.isArray(r.room_status) ? r.room_status[0] : r.room_status;
    if (typeof status?.temperature_c === "number") tempValues.push(status.temperature_c);
  });
  const avgTemp = tempValues.reduce((sum, t) => sum + t, 0);
  const tempRooms = tempValues.length;

  const ghostCooling = rooms.filter((r) => {
    const status = Array.isArray(r.room_status) ? r.room_status[0] : r.room_status;
    return status?.ghost_cooling_active;
  }).length;

  return (
    <>
      {/* Summary */}
      <div className="report-summary-row">
        <div className="report-summary-card">
          <span className="report-summary-value">{rooms.length}</span>
          <span className="report-summary-label">Total Rooms</span>
        </div>
        <div className="report-summary-card">
          <span className="report-summary-value" style={{ color: "var(--accent-green)" }}>{totalOccupied}</span>
          <span className="report-summary-label">Currently Occupied</span>
        </div>
        <div className="report-summary-card">
          <span className="report-summary-value">{tempRooms > 0 ? (avgTemp / tempRooms).toFixed(1) + "°" : "—"}</span>
          <span className="report-summary-label">Avg Temperature</span>
        </div>
        <div className="report-summary-card">
          <span className="report-summary-value" style={{ color: ghostCooling > 0 ? "var(--accent-red)" : "var(--accent-green)" }}>{ghostCooling}</span>
          <span className="report-summary-label">Ghost Cooling</span>
        </div>
      </div>

      {/* Building-grouped room tables */}
      {Object.entries(grouped).map(([buildingId, bRooms], i) => (
        <div key={buildingId} className="report-section" style={{ animationDelay: `${i * 0.05}s` }}>
          <div className="report-section-header">
            <div className="report-section-icon">🏢</div>
            <div>
              <h3>{getBuildingName(buildingId)}</h3>
              <p>{bRooms.length} room{bRooms.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
          <div className="report-section-body" style={{ padding: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Room</th>
                  <th>Type</th>
                  <th>Current status</th>
                  <th>Live temp</th>
                  <th>Avg temp (period)</th>
                  <th>Occupancy % (period)</th>
                  <th>Sensors</th>
                </tr>
              </thead>
              <tbody>
                {bRooms.map((r) => {
                  const status = (Array.isArray(r.room_status) ? r.room_status[0] : r.room_status) || {};
                  return (
                    <tr key={r.room_id}>
                      <td style={{ fontWeight: 500, color: "var(--text-primary)" }}>
                        {r.name || "—"}
                        {r.code && <span style={{ display: "block", fontSize: 11, color: "var(--text-muted)" }}>{r.code}</span>}
                      </td>
                      <td><span className={`badge ${r.type === "LAB" ? "blue" : r.type === "HALL" ? "green" : "amber"}`}>{r.type || "—"}</span></td>
                      <td>
                        <span className={`badge ${
                          status.occupancy === "OCCUPIED"
                            ? "green"
                            : status.occupancy === "EMPTY"
                              ? "red"
                              : "amber"
                        }`}>
                          <span className="badge-dot" />
                          {status.occupancy === "OCCUPIED"
                            ? "Occupied"
                            : status.occupancy === "EMPTY"
                              ? "Empty"
                              : status.is_stale
                                ? "No recent data"
                                : "Unknown"}
                        </span>
                      </td>
                      <td>{status.temperature_c != null ? `${status.temperature_c}°C` : "—"}</td>
                      <td>{r.stats?.avgTemperature != null ? `${r.stats.avgTemperature}°C` : "—"}</td>
                      <td>
                        {r.stats?.occupancyRate != null ? (
                          <div className="report-bar-wrapper">
                            <div className="report-bar" style={{ width: `${Math.min(r.stats.occupancyRate, 100)}%` }} />
                            <span>{r.stats.occupancyRate}%</span>
                          </div>
                        ) : "—"}
                      </td>
                      <td>
                        <span className="badge blue">{r.sensor_nodes?.length || 0}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </>
  );
}

/* ════════════════════════════════════════════════
   ALERTS REPORT
   ════════════════════════════════════════════════ */
function renderAlertsReport(data: any, formatDateTime: (d: string) => string) {
  const alerts: AlertReport[] = data?.alerts || [];
  if (alerts.length === 0) {
    return <EmptyReport icon="🔔" title="No alerts found" subtitle="No anomalies match your selected filters." />;
  }

  const active = alerts.filter(a => a.is_active).length;
  const resolved = alerts.length - active;
  const high = alerts.filter(a => a.severity === "HIGH").length;

  return (
    <>
      <div className="report-summary-row">
        <div className="report-summary-card">
          <span className="report-summary-value">{alerts.length}</span>
          <span className="report-summary-label">Total Alerts</span>
        </div>
        <div className="report-summary-card">
          <span className="report-summary-value" style={{ color: "var(--accent-red)" }}>{active}</span>
          <span className="report-summary-label">Active</span>
        </div>
        <div className="report-summary-card">
          <span className="report-summary-value" style={{ color: "var(--accent-green)" }}>{resolved}</span>
          <span className="report-summary-label">Resolved</span>
        </div>
        <div className="report-summary-card">
          <span className="report-summary-value" style={{ color: high > 0 ? "var(--accent-red)" : "var(--text-muted)" }}>{high}</span>
          <span className="report-summary-label">High Severity</span>
        </div>
      </div>

      <div className="report-section">
        <div className="report-section-body" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Severity</th>
                <th>Room</th>
                <th>Message</th>
                <th>Status</th>
                <th>Started</th>
                <th>Resolved</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((a) => (
                <tr key={a.anomaly_id}>
                  <td style={{ fontWeight: 500, color: "var(--text-primary)" }}>
                    {a.type === "GHOST_COOLING" ? "👻 Ghost Cooling" : a.type === "SENSOR_OFFLINE" ? "📡 Sensor Offline" : a.type === "HIGH_TEMP" ? "🌡 High Temp" : a.type}
                  </td>
                  <td>
                    <span className={`badge ${a.severity === "HIGH" ? "red" : a.severity === "MEDIUM" ? "amber" : "blue"}`}>
                      {a.severity}
                    </span>
                  </td>
                  <td>{a.rooms?.name || "—"}</td>
                  <td style={{ maxWidth: 250, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.message}</td>
                  <td>
                    <span className={`badge ${a.is_active ? "red" : "green"}`}>
                      <span className="badge-dot" />
                      {a.is_active ? "Active" : "Resolved"}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, whiteSpace: "nowrap" }}>{formatDateTime(a.start_at)}</td>
                  <td style={{ fontSize: 12, whiteSpace: "nowrap" }}>{a.end_at ? formatDateTime(a.end_at) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/* ════════════════════════════════════════════════
   SENSORS REPORT
   ════════════════════════════════════════════════ */
function renderSensorsReport(data: any, formatDateTime: (d: string) => string) {
  const sensors: SensorReport[] = data?.sensors || [];
  if (sensors.length === 0) {
    return <EmptyReport icon="📡" title="No sensors found" subtitle="No sensor nodes match your selected filters." />;
  }

  const activeSensors = sensors.filter(s => s.is_active).length;

  return (
    <>
      <div className="report-summary-row">
        <div className="report-summary-card">
          <span className="report-summary-value">{sensors.length}</span>
          <span className="report-summary-label">Total Nodes</span>
        </div>
        <div className="report-summary-card">
          <span className="report-summary-value" style={{ color: "var(--accent-green)" }}>{activeSensors}</span>
          <span className="report-summary-label">Active</span>
        </div>
        <div className="report-summary-card">
          <span className="report-summary-value" style={{ color: sensors.length - activeSensors > 0 ? "var(--accent-red)" : "var(--text-muted)" }}>
            {sensors.length - activeSensors}
          </span>
          <span className="report-summary-label">Inactive</span>
        </div>
      </div>

      <div className="report-section">
        <div className="report-section-body" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Node ID</th>
                <th>Device</th>
                <th>Room</th>
                <th>Status</th>
                <th>Firmware</th>
                <th>Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {sensors.map((s) => (
                <tr key={s.node_id}>
                  <td style={{ fontWeight: 500, color: "var(--text-primary)", fontFamily: "monospace", fontSize: 13 }}>{s.node_id}</td>
                  <td>{s.device_name || "—"}</td>
                  <td>{s.rooms?.name || "—"}</td>
                  <td>
                    <span className={`badge ${s.is_active ? "green" : "red"}`}>
                      <span className="badge-dot" />
                      {s.is_active ? "Online" : "Offline"}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: "var(--text-muted)" }}>{s.firmware_version || "—"}</td>
                  <td style={{ fontSize: 12, whiteSpace: "nowrap" }}>{s.last_seen_at ? formatDateTime(s.last_seen_at) : "Never"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/* ── Empty State Component ── */
function EmptyReport({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  return (
    <div className="empty-state" style={{ padding: 80 }}>
      <div className="empty-state-icon">{icon}</div>
      <h3>{title}</h3>
      <p style={{ color: "var(--text-muted)", marginTop: 8 }}>{subtitle}</p>
    </div>
  );
}
