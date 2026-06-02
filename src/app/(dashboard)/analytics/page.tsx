"use client";

import { useEffect, useState, useCallback } from "react";
import StatCard from "@/components/StatCard";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useRealtime } from "@/hooks/useRealtime";

interface RoomStat {
  name: string;
  occupancy: number;
}

interface AnalyticsData {
  avgTemperature: number;
  occupancyRate: number;
  avgNoiseLevel: number;
  totalRoomsMonitored: number;
  roomStats: RoomStat[];
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("24h");

  const loadAnalytics = useCallback(async (showLoader = false) => {
    try {
      if (showLoader) setLoading(true);
      const token = localStorage.getItem("token");
      const headers: HeadersInit = token
        ? { Authorization: `Bearer ${token}` }
        : {};

      const res = await fetch(`/api/analytics?range=${timeRange}`, { headers });
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error("Failed to fetch analytics:", err);
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    loadAnalytics(true);
  }, [loadAnalytics]);

  // Real-time update when new readings are inserted
  useRealtime({ table: "sensor_readings", event: "INSERT" }, () => {
    loadAnalytics();
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
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2>Analytics</h2>
          <p>AI-powered insights and historical trends</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', background: 'var(--bg-secondary)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          {[
            { label: 'Past 24h', value: '24h' },
            { label: 'Past 7 Days', value: '7d' },
            { label: 'Past 30 Days', value: '30d' },
            { label: 'All Time', value: 'all' }
          ].map(range => (
            <button
              key={range.value}
              onClick={() => setTimeRange(range.value)}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                background: timeRange === range.value ? 'var(--accent-blue)' : 'transparent',
                color: timeRange === range.value ? 'white' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontWeight: 500,
                fontSize: '13px',
                transition: 'all 0.2s'
              }}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card-grid" style={{ marginBottom: 32 }}>
        <StatCard
          icon="🌡"
          label="Avg Campus Temp"
          value={data?.avgTemperature ? `${data.avgTemperature}°C` : "—"}
          sub="Based on recent readings"
          color="blue"
        />
        <StatCard
          icon="👥"
          label="Occupancy Rate"
          value={data?.occupancyRate != null ? `${data.occupancyRate}%` : "—"}
          sub="Overall campus utilization"
          color="green"
        />
        <StatCard
          icon="🔊"
          label="Avg Sound Level"
          value={data?.avgNoiseLevel ? `${data.avgNoiseLevel} dB` : "—"}
          sub="Based on recent readings"
          color="amber"
        />
        <StatCard
          icon="🏢"
          label="Measured Rooms"
          value={data?.totalRoomsMonitored || 0}
          sub="Rooms supplying data"
          color="purple"
        />
      </div>

      {/* Graphical Representation of Room Occupancy */}
      <div className="card animate-in" style={{ marginBottom: 32 }}>
        <h3 style={{ marginBottom: 16 }}>Room Occupancy Overview</h3>
        {data?.roomStats && data.roomStats.length > 0 ? (
          <div className="chart-scroll-wrapper" style={{ width: "100%", overflowX: "auto", overflowY: "hidden", paddingBottom: "12px" }}>
            <div style={{ minWidth: `${Math.max(data.roomStats.length * 60, 600)}px`, height: 350 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                data={data.roomStats}
                margin={{ top: 20, right: 30, left: 20, bottom: 30 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                <XAxis dataKey="name" stroke="var(--text-secondary)" angle={-45} textAnchor="end" height={60} />
                <YAxis stroke="var(--accent-green)" label={{ value: 'Occupancy (%)', angle: -90, position: 'insideLeft', fill: 'var(--accent-green)' }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px' }} 
                  itemStyle={{ fontWeight: 600 }}
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                />
                <Bar dataKey="occupancy" name="Occupancy (%)" fill="var(--accent-green)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
            <p>No telemetry data available for room conditions yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
