"use client";

import { useEffect, useState, useCallback } from "react";
import StatCard from "@/components/StatCard";
import { useRealtime } from "@/hooks/useRealtime";

interface DashboardStats {
  buildings: number;
  rooms: number;
  occupiedRooms: number;
  sensors: number;
  activeAlerts: number;
}

interface Reading {
  reading_id: string;
  node_id: string;
  room_id: string;
  temperature_c: number | null;
  noise_db: number | null;
  light_lux: number | null;
  occupancy_detected: boolean | null;
  created_at: string;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    buildings: 0,
    rooms: 0,
    occupiedRooms: 0,
    sensors: 0,
    activeAlerts: 0,
  });
  const [occupiedRoomsList, setOccupiedRoomsList] = useState<any[]>([]);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [allRooms, setAllRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const headers: HeadersInit = token
        ? { Authorization: `Bearer ${token}` }
        : {};

      const [buildingsRes, roomsRes, sensorsRes, alertsRes, readingsRes] =
        await Promise.all([
          fetch("/api/buildings", { headers }),
          fetch("/api/rooms", { headers }),
          fetch("/api/sensors", { headers }),
          fetch("/api/alerts", { headers }),
          fetch("/api/readings?limit=100", { headers }),
        ]);

      const [buildings, rooms, sensors, alerts, recentReadings] =
        await Promise.all([
          buildingsRes.json(),
          roomsRes.json(),
          sensorsRes.json(),
          alertsRes.json(),
          readingsRes.json(),
        ]);

      let occupiedCount = 0;
      let occupiedList: any[] = [];
      if (Array.isArray(rooms)) {
        setAllRooms(rooms);
        occupiedList = rooms.filter((r: { room_status?: { occupancy?: string } }) => {
          const status = r.room_status;
          return status?.occupancy === "OCCUPIED";
        });
        occupiedCount = occupiedList.length;
      }
      
      setOccupiedRoomsList(occupiedList);

      setStats({
        buildings: Array.isArray(buildings) ? buildings.length : 0,
        rooms: Array.isArray(rooms) ? rooms.length : 0,
        occupiedRooms: occupiedCount,
        sensors: Array.isArray(sensors) ? sensors.length : 0,
        activeAlerts: Array.isArray(alerts) ? alerts.length : 0,
      });

      if (Array.isArray(recentReadings)) {
        setReadings(recentReadings);
      }
    } catch (err) {
      console.error("Failed to fetch dashboard data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Realtime: subscribe to new readings
  useRealtime(
    { table: "readings", event: "INSERT" },
    () => {
      fetchDashboardData();
    }
  );

  // Realtime: subscribe to ESP32 sensor_readings
  useRealtime(
    { table: "sensor_readings", event: "INSERT" },
    () => {
      fetchDashboardData();
    }
  );

  if (loading) {
    return (
      <div className="loading">
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h2>Dashboard</h2>
        <p>Real-time overview of your smart campus</p>
      </div>

      <div className="card-grid" style={{ marginBottom: 32 }}>
        <StatCard
          icon="🏢"
          label="Total Buildings"
          value={stats.buildings}
          sub="Registered buildings"
          color="blue"
        />
        <StatCard
          icon="🚪"
          label="Total Rooms"
          value={stats.rooms}
          sub="Monitored rooms"
          color="green"
        />
        <StatCard
          icon="👥"
          label="Occupied Rooms"
          value={stats.occupiedRooms}
          sub="Currently in use"
          color="purple"
        />
        <StatCard
          icon="📡"
          label="Active Sensors"
          value={stats.sensors}
          sub="Connected nodes"
          color="amber"
        />
        <StatCard
          icon="🔔"
          label="Active Alerts"
          value={stats.activeAlerts}
          sub="Require attention"
          color="red"
        />
      </div>

      <div className="table-container animate-in" style={{ marginBottom: 32 }}>
        <div className="table-header">
          <h3>Occupied Rooms</h3>
        </div>
        <table>
          <thead>
            <tr>
              <th>Room Name</th>
              <th>Code</th>
              <th>Type</th>
              <th>Temperature</th>
            </tr>
          </thead>
          <tbody>
            {occupiedRoomsList.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ textAlign: "center", padding: 40 }}>
                  No rooms are currently occupied.
                </td>
              </tr>
            ) : (
              occupiedRoomsList.map((r) => {
                const status = r.room_status;
                return (
                  <tr key={r.room_id}>
                    <td style={{ color: "var(--text-primary)", fontWeight: 500 }}>
                      {r.name || "—"}
                    </td>
                    <td>{r.code || "—"}</td>
                    <td>
                      <span className={`badge ${r.type === "LAB" ? "blue" : r.type === "HALL" ? "green" : "amber"}`}>
                        {r.type || "—"}
                      </span>
                    </td>
                    <td>{status?.temperature_c != null ? `${status.temperature_c}°C` : "—"}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="table-container animate-in">
        <div className="table-header">
          <h3>Recent Readings</h3>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="live-dot" />
            <span
              style={{
                fontSize: 12,
                color: "var(--text-muted)",
                fontWeight: 500,
              }}
            >
              Live
            </span>
          </div>
        </div>
        <div style={{ maxHeight: 500, overflowY: "auto" }}>
          <table>
            <thead style={{ position: "sticky", top: 0, background: "var(--bg-secondary)", zIndex: 1 }}>
              <tr>
              <th>Room</th>
              <th>Temp °C</th>
              <th>Noise dB</th>
              <th>Light lux</th>
              <th>Occupancy</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {readings.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: 40 }}>
                  No readings yet. Insert sensor data to see live updates.
                </td>
              </tr>
            ) : (
              readings.map((r) => {
                const room = allRooms.find(rm => rm.room_id === r.room_id);
                const roomDisplay = room ? (room.name || room.code || r.node_id) : r.node_id;

                return (
                  <tr key={r.reading_id}>
                    <td style={{ color: "var(--text-primary)", fontWeight: 500 }}>
                      {roomDisplay}
                    </td>
                    <td>{r.temperature_c ?? "—"}</td>
                  <td>{r.noise_db ?? "—"}</td>
                  <td>{r.light_lux ?? "—"}</td>
                  <td>
                    <span
                      className={`badge ${r.occupancy_detected ? "green" : "red"}`}
                    >
                      <span className="badge-dot" />
                      {r.occupancy_detected ? "Yes" : "No"}
                    </span>
                  </td>
                  <td style={{ fontSize: 12 }}>
                    {new Date(r.created_at).toLocaleTimeString()}
                  </td>
                </tr>
                );
              })
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
