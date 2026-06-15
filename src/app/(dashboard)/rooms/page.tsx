"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useRealtime } from "@/hooks/useRealtime";

interface RoomStatus {
  occupancy: string | null;
  temperature_c: number | null;
  ghost_cooling_active: boolean | null;
}

interface Room {
  room_id: string;
  name: string;
  code: string;
  type: string;
  building_id: string;
  floor_id: string | null;
  is_public_destination: boolean;
  created_at: string;
  room_status: RoomStatus | null;
  floors?: { name: string; level: number } | null;
  sensor_nodes?: { node_id: string; is_active: boolean }[] | null;
}

interface Building {
  building_id: string;
  name: string;
}

interface Floor {
  floor_id: string;
  name: string;
  level: number;
}

export default function RoomsPage() {
  const router = useRouter();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [allFloors, setAllFloors] = useState<Floor[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    room_id: "",
    name: "",
    code: "",
    type: "OFFICE",
    building_id: "",
    floor_id: "",
    is_public_destination: false,
  });

  const fetchRooms = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

      const res = await fetch("/api/rooms", { headers, cache: "no-store" });
      const data = await res.json();
      if (Array.isArray(data)) setRooms(data);
    } catch (err) {
      console.error("Failed to fetch rooms:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchBuildings = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch("/api/buildings", { headers, cache: "no-store" });
      const data = await res.json();
      if (Array.isArray(data)) {
        setBuildings(data);
        // Fetch all floors from all buildings for display
        const allFloorsArr: Floor[] = [];
        for (const b of data) {
          const fRes = await fetch(`/api/buildings/${b.building_id}`, { headers, cache: "no-store" });
          const fData = await fRes.json();
          if (fData && Array.isArray(fData.floors)) {
            allFloorsArr.push(...fData.floors);
          }
        }
        setAllFloors(allFloorsArr);
      }
    } catch (err) {
      console.error("Failed to fetch buildings:", err);
    }
  }, []);

  const fetchFloors = async (bId: string) => {
    if (!bId) {
      setFloors([]);
      return;
    }
    try {
      const token = localStorage.getItem("token");
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`/api/buildings/${bId}`, { headers });
      const data = await res.json();
      if (data && Array.isArray(data.floors)) {
        setFloors(data.floors);
      } else {
        setFloors([]);
      }
    } catch (err) {
      console.error("Failed to fetch floors:", err);
    }
  };

  useEffect(() => {
    fetchRooms();
    fetchBuildings();
  }, [fetchRooms, fetchBuildings]);

  useRealtime({ table: "sensor_readings", event: "INSERT" }, fetchRooms);
  useRealtime({ table: "readings", event: "INSERT" }, fetchRooms);

  useEffect(() => {
    // Whenever building_id changes, fetch the corresponding floors for the dropdown
    fetchFloors(formData.building_id);
  }, [formData.building_id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.building_id) {
      alert("Please select a building.");
      return;
    }

    setIsSaving(true);
    try {
      const token = localStorage.getItem("token");
      const headers: HeadersInit = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const url = modalMode === "add" ? "/api/rooms" : `/api/rooms/${formData.room_id}`;
      const method = modalMode === "add" ? "POST" : "PUT";
      
      const body = {
        name: formData.name,
        code: formData.code,
        type: formData.type,
        building_id: formData.building_id || undefined,
        floor_id: formData.floor_id || null,
        is_public_destination: formData.is_public_destination,
      };

      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setIsModalOpen(false);
        fetchRooms();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to save room");
      }
    } catch (err) {
      console.error(err);
      alert("Error saving room");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete room '${name}'?`)) return;
    
    try {
      const token = localStorage.getItem("token");
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
      
      const res = await fetch(`/api/rooms/${id}`, {
        method: "DELETE",
        headers,
      });

      if (res.ok) {
        fetchRooms();
      } else {
        alert("Failed to delete room");
      }
    } catch (err) {
      console.error(err);
      alert("Error deleting room");
    }
  };

  const openAddModal = () => {
    setFormData({
      room_id: "",
      name: "",
      code: "",
      type: "OFFICE",
      building_id: buildings.length > 0 ? buildings[0].building_id : "",
      floor_id: "",
      is_public_destination: false,
    });
    setModalMode("add");
    setIsModalOpen(true);
  };

  const openEditModal = (room: Room) => {
    setFormData({
      room_id: room.room_id,
      name: room.name || "",
      code: room.code || "",
      type: room.type || "OFFICE",
      building_id: room.building_id || "",
      floor_id: room.floor_id || "",
      is_public_destination: room.is_public_destination || false,
    });
    setModalMode("edit");
    setIsModalOpen(true);
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>Rooms</h2>
          <p>Monitor room occupancy and environmental conditions</p>
        </div>
        <button className="btn btn-primary" onClick={openAddModal}>
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Add Room
        </button>
      </div>

      {rooms.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🚪</div>
          <h3>No Rooms Yet</h3>
          <p>Click the "Add Room" button to create one.</p>
        </div>
      ) : (
        <div className="table-container animate-in">
          <div className="table-header">
            <h3>All Rooms</h3>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
              {rooms.length} rooms
            </span>
          </div>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(255, 255, 255, 0.02)' }}>
                <th style={{ padding: '16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Name</th>
                <th style={{ padding: '16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Code</th>
                <th style={{ padding: '16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Floor</th>
                <th style={{ padding: '16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Type</th>
                <th style={{ padding: '16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Occupancy</th>
                <th style={{ padding: '16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Temperature</th>
                <th style={{ padding: '16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Ghost Cooling</th>
                <th style={{ padding: '16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Node Status</th>
                <th style={{ padding: '16px', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rooms.map((room) => (
                <tr key={room.room_id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.2s' }} className="table-row">
                  <td style={{ padding: '16px', color: "var(--text-primary)", fontWeight: 500 }}>
                    {room.name || "Unnamed"}
                  </td>
                  <td style={{ padding: '16px', color: 'var(--text-muted)' }}>{room.code || "—"}</td>
                  <td style={{ padding: '16px', color: 'var(--text-muted)' }}>
                    {room.floor_id
                      ? (() => { const f = allFloors.find(fl => fl.floor_id === room.floor_id); return f ? `${f.name} (Lvl ${f.level})` : "—"; })()
                      : "—"}
                  </td>
                  <td style={{ padding: '16px' }}>
                    <span className="badge blue">{room.type}</span>
                  </td>
                  <td style={{ padding: '16px' }}>
                    {room.room_status?.occupancy === "OCCUPIED" ? (
                      <span className="badge green">
                        <span className="badge-dot" />
                        Occupied
                      </span>
                    ) : room.room_status?.occupancy === "EMPTY" ? (
                      <span className="badge red">
                        <span className="badge-dot" />
                        Empty
                      </span>
                    ) : (
                      <span style={{ color: "var(--text-muted)", fontSize: 13 }}>
                        {(room.room_status as { is_stale?: boolean })?.is_stale
                          ? "No recent data"
                          : "Unknown"}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '16px' }}>
                    {room.room_status?.temperature_c != null
                      ? `${room.room_status.temperature_c}°C`
                      : "—"}
                  </td>
                  <td style={{ padding: '16px' }}>
                    {room.room_status?.ghost_cooling_active ? (
                      <span className="badge amber">
                        <span className="badge-dot" />
                        Active
                      </span>
                    ) : (
                      <span style={{ color: "var(--text-muted)" }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: '16px' }}>
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
                  </td>
                  <td style={{ padding: '16px', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button 
                      onClick={() => router.push(`/rooms/${room.room_id}`)}
                      className="action-btn view-btn"
                      title="View Details"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                    </button>
                    <button 
                      onClick={() => openEditModal(room)}
                      className="action-btn edit-btn"
                      title="Edit"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                    <button 
                      onClick={() => handleDelete(room.room_id, room.name || "Unknown")}
                      className="action-btn delete-btn"
                      title="Delete"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100, 
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)'
        }}>
          <div className="card animate-in" style={{ width: '100%', maxWidth: '400px', margin: '20px', zIndex: 101 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h3 style={{ fontSize: 20, fontWeight: 700 }}>
                {modalMode === "add" ? "Add New Room" : "Edit Room"}
              </h3>
              <button 
                className="action-btn" 
                onClick={() => setIsModalOpen(false)} 
                title="Close"
                type="button"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div className="form-group">
                <label className="form-label">Room Name *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Computer Science Lab"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Room Code</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. CS101"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Room Type</label>
                <select 
                  className="form-input" 
                  value={formData.type} 
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                >
                  <option value="OFFICE">Office</option>
                  <option value="LAB">Lab</option>
                  <option value="HALL">Hall</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Building *</label>
                <select 
                  className="form-input" 
                  value={formData.building_id} 
                  onChange={(e) => setFormData({ ...formData, building_id: e.target.value, floor_id: "" })}
                  required
                >
                  <option value="" disabled>Select Building</option>
                  {buildings.map(b => (
                    <option key={b.building_id} value={b.building_id}>{b.name}</option>
                  ))}
                </select>
              </div>

              {formData.building_id && (
                <div className="form-group">
                  <label className="form-label">Floor</label>
                  <select 
                    className="form-input" 
                    value={formData.floor_id} 
                    onChange={(e) => setFormData({ ...formData, floor_id: e.target.value })}
                  >
                    <option value="">No Floor Assignment</option>
                    {floors.length === 0 && (
                      <option value="" disabled>No floors found for this building</option>
                    )}
                    {floors.map(f => (
                      <option key={f.floor_id} value={f.floor_id}>{f.name} (Lvl {f.level})</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="form-group" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16 }}>
                <input
                  type="checkbox"
                  id="is_public_destination"
                  checked={formData.is_public_destination}
                  onChange={(e) => setFormData({ ...formData, is_public_destination: e.target.checked })}
                  style={{ width: 16, height: 16, cursor: "pointer" }}
                />
                <label htmlFor="is_public_destination" className="form-label" style={{ marginBottom: 0, cursor: "pointer" }}>
                  Is Public Destination (Visible on maps)
                </label>
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
                <button type="button" className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={isSaving}>
                  {isSaving ? "Saving..." : "Save Room"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <style jsx>{`
        .action-btn { background: transparent; border: none; cursor: pointer; color: var(--text-muted); transition: color 0.2s; display: flex; align-items: center; justify-content: center; padding: 4px; border-radius: 6px; }
        .action-btn:hover { background: rgba(255,255,255,0.05); color: var(--text-primary); }
        .action-btn.edit-btn:hover { color: var(--accent-blue); background: rgba(59,130,246,0.1); }
        .action-btn.delete-btn:hover { color: var(--accent-red); background: rgba(239,68,68,0.1); }
        .table-row:hover { background: rgba(255, 255, 255, 0.03) !important; }
      `}</style>
    </div>
  );
}
