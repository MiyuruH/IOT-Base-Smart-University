"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import IoTDashboard from "@/components/IoTDashboard";

interface RoomDetails {
  room_id: string;
  name: string;
  code: string;
  type: string;
  building_id: string;
  floor_id: string | null;
  is_public_destination: boolean;
  building?: { name: string };
  floor?: { name: string; level: number };
  room_status?: any;
  sensor_nodes?: { node_id: string; is_active: boolean }[] | null;
}

export default function RoomDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { id } = use(params);

  const [room, setRoom] = useState<RoomDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchRoomData = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

      const roomRes = await fetch(`/api/rooms/${id}`, { headers, cache: "no-store" });
      if (!roomRes.ok) throw new Error("Failed to fetch room details");
      const roomData = await roomRes.json();

      setRoom(roomData);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load room");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchRoomData();
  }, [fetchRoomData]);

  if (loading) {
    return (
      <div className="loading">
        <div className="loading-spinner" />
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">⚠️</div>
        <h3>{error || "Room Not Found"}</h3>
        <button className="btn btn-outline" onClick={() => router.push("/rooms")} style={{ marginTop: 16 }}>
          Back to Rooms
        </button>
      </div>
    );
  }

  return (
    <div className="room-details-page">
      {/* Header */}
      <div className="page-header" style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
        <button className="btn btn-ghost" onClick={() => router.push("/rooms")} style={{ padding: 8, marginTop: 2 }} title="Back to Rooms">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
            <h2 style={{ margin: 0 }}>{room.name || "Unnamed Room"}</h2>
            <span className="badge blue">{room.type}</span>
            {(!room.sensor_nodes || room.sensor_nodes.length === 0) ? (
              <span className="badge gray" style={{ backgroundColor: 'rgba(156, 163, 175, 0.2)', color: '#9ca3af' }}>Not Connected</span>
            ) : (room.room_status as any)?.is_stale ? (
              <span className="badge red" style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' }}>
                <span className="badge-dot" style={{ backgroundColor: '#ef4444' }} /> Offline
              </span>
            ) : (
              <span className="badge green" style={{ backgroundColor: 'rgba(16, 185, 129, 0.2)', color: '#10b981' }}>
                <span className="badge-dot" style={{ backgroundColor: '#10b981' }} /> Online
              </span>
            )}
          </div>
          <p>
            {room.code ? `${room.code} • ` : ""}
            {room.building?.name || "Unknown Building"}
            {room.floor ? ` • ${room.floor.name} (Lvl ${room.floor.level})` : ""}
          </p>
          <div style={{ marginTop: 8, fontSize: 13, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 8 }}>
            <button 
              onClick={() => {
                navigator.clipboard.writeText(room.room_id);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              style={{ 
                fontFamily: "monospace", 
                background: "rgba(255,255,255,0.05)", 
                padding: "4px 8px", 
                borderRadius: 4, 
                border: "1px solid var(--border-color)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                color: "var(--text-primary)",
                transition: "all 0.2s"
              }}
              title="Click to copy Room ID"
            >
              ID: {room.room_id}
              {copied ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Unified IoT Dashboard — realtime sensor data */}
      <h3 style={{ fontSize: 18, fontWeight: 600, marginTop: 32, marginBottom: 16, color: "var(--text-primary)" }}>
        Environment &amp; System Status
      </h3>

      <IoTDashboard roomId={id} />
    </div>
  );
}
