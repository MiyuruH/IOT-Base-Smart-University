"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

interface Building {
  building_id: string;
  name: string;
  address: string;
  created_at: string;
  floors: { count: number }[];
  rooms: { count: number }[];
  number_of_floors?: number;
  number_of_rooms?: number;
}

export default function BuildingsPage() {
  const router = useRouter();
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [formData, setFormData] = useState({ building_id: "", name: "", address: "", number_of_floors: 0, number_of_rooms: 0 });
  const [isSaving, setIsSaving] = useState(false);

  // Rooms Modal State
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);
  const [roomsList, setRoomsList] = useState<any[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [buildingFloors, setBuildingFloors] = useState<any[]>([]);
  const [selectedFloorFilter, setSelectedFloorFilter] = useState<string>("all");

  const fetchBuildings = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const headers: HeadersInit = token
        ? { Authorization: `Bearer ${token}` }
        : {};

      const res = await fetch("/api/buildings", { headers, cache: "no-store" });
      const data = await res.json();
      if (Array.isArray(data)) setBuildings(data);
    } catch (err) {
      console.error("Failed to fetch buildings:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBuildings();
  }, [fetchBuildings]);

  // Handle Add/Edit Form Submit
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const token = localStorage.getItem("token");
      const headers: HeadersInit = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const url = modalMode === "add" ? "/api/buildings" : `/api/buildings/${formData.building_id}`;
      const method = modalMode === "add" ? "POST" : "PUT";

      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify({ 
          name: formData.name, 
          address: formData.address,
          number_of_floors: Number(formData.number_of_floors),
          number_of_rooms: Number(formData.number_of_rooms)
        }),
      });

      if (res.ok) {
        setIsModalOpen(false);
        fetchBuildings();
      } else {
        alert("Failed to save building");
      }
    } catch (err) {
      console.error(err);
      alert("Error saving building");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Delete
  const handleDelete = async (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete ${name || "this building"}? This will permanently delete its floors and rooms.`)) return;
    
    try {
      const token = localStorage.getItem("token");
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
      
      const res = await fetch(`/api/buildings/${id}`, {
        method: "DELETE",
        headers,
      });

      if (res.ok) {
        fetchBuildings();
      } else {
        alert("Failed to delete building");
      }
    } catch (err) {
      console.error(err);
      alert("Error deleting building");
    }
  };

  const openAddModal = () => {
    setFormData({ building_id: "", name: "", address: "", number_of_floors: 0, number_of_rooms: 0 });
    setModalMode("add");
    setIsModalOpen(true);
  };

  const openEditModal = (b: Building, e: React.MouseEvent) => {
    e.stopPropagation();
    setFormData({ building_id: b.building_id, name: b.name, address: b.address, number_of_floors: b.number_of_floors || 0, number_of_rooms: b.number_of_rooms || 0 });
    setModalMode("edit");
    setIsModalOpen(true);
  };

  const handleBuildingClick = async (b: Building) => {
    setSelectedBuilding(b);
    setIsLoadingRooms(true);
    setRoomsList([]);
    setBuildingFloors([]);
    setSelectedFloorFilter("all");
    try {
      const token = localStorage.getItem("token");
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
      
      const [roomsRes, bRes] = await Promise.all([
        fetch(`/api/rooms?building_id=${b.building_id}`, { headers }),
        fetch(`/api/buildings/${b.building_id}`, { headers })
      ]);
      
      const roomsData = await roomsRes.json();
      const bData = await bRes.json();
      
      if (Array.isArray(roomsData)) setRoomsList(roomsData);
      if (bData && Array.isArray(bData.floors)) setBuildingFloors(bData.floors);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingRooms(false);
    }
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
          <h2>Buildings</h2>
          <p>Manage campus buildings and infrastructure</p>
        </div>
        <button className="btn btn-primary" onClick={openAddModal}>
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Add Building
        </button>
      </div>

      {buildings.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🏢</div>
          <h3>No Buildings Yet</h3>
          <p>Click "Add Building" to set up your first infrastructure.</p>
        </div>
      ) : (
        <div className="card-grid">
          {buildings.map((b) => (
            <div 
              key={b.building_id} 
              className="card animate-in relative group" 
              style={{ position: 'relative', cursor: 'pointer' }}
              onClick={() => handleBuildingClick(b)}
            >
              
              {/* Action Buttons (Edit/Delete) */}
              <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', gap: 8 }}>
                <button 
                  onClick={(e) => openEditModal(b, e)}
                  className="action-btn edit-btn"
                  title="Edit"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </button>
                <button 
                  onClick={(e) => handleDelete(b.building_id, b.name, e)}
                  className="action-btn delete-btn"
                  title="Delete"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                </button>
              </div>

              <h3
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  marginBottom: 8,
                  paddingRight: 48 // Make room for actions
                }}
              >
                {b.name || "Unnamed Building"}
              </h3>
              <p
                style={{
                  fontSize: 13,
                  color: "var(--text-secondary)",
                  marginBottom: 16,
                }}
              >
                {b.address || "No address"}
              </p>
              <div style={{ display: "flex", gap: 12 }}>
                <span className="badge blue" title="Actual / Planned">
                  {b.number_of_floors || 0} Floors
                </span>
                <span className="badge purple" title="Actual / Planned">
                  {b.rooms?.[0]?.count ?? 0} / {b.number_of_rooms || 0} Rooms
                </span>
              </div>
              <div
                style={{
                  marginTop: 16,
                  fontSize: 11,
                  color: "var(--text-muted)",
                }}
              >
                Added {new Date(b.created_at).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reusable Modal for Add/Edit using globals.css styling concepts */}
      {isModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100, 
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)'
        }}>
          <div className="card animate-in" style={{ width: '100%', maxWidth: '400px', margin: '20px', zIndex: 101 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h3 style={{ fontSize: 20, fontWeight: 700 }}>
                {modalMode === "add" ? "Add New Building" : "Edit Building"}
              </h3>
              <button 
                className="action-btn" 
                onClick={() => setIsModalOpen(false)} 
                title="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div className="form-group">
                <label className="form-label">Building Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Science Block A"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Location Address</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. North Campus, 3rd Ave"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: 16 }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Number of Floors</label>
                  <input
                    type="number"
                    min="0"
                    className="form-input"
                    placeholder="e.g. 3"
                    value={formData.number_of_floors}
                    onChange={(e) => setFormData({ ...formData, number_of_floors: parseInt(e.target.value) || 0 })}
                    required
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Number of Rooms</label>
                  <input
                    type="number"
                    min="0"
                    className="form-input"
                    placeholder="e.g. 30"
                    value={formData.number_of_rooms}
                    onChange={(e) => setFormData({ ...formData, number_of_rooms: parseInt(e.target.value) || 0 })}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
                <button type="button" className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={isSaving}>
                  {isSaving ? "Saving..." : "Save Building"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rooms List Modal */}
      {selectedBuilding && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100, 
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)'
        }} onClick={() => setSelectedBuilding(null)}>
          <div 
            className="card animate-in" 
            style={{ width: '100%', maxWidth: '500px', height: '500px', margin: '20px', zIndex: 101, display: 'flex', flexDirection: 'column' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexShrink: 0 }}>
              <div>
                <h3 style={{ fontSize: 20, fontWeight: 700 }}>{selectedBuilding.name} - Rooms</h3>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{selectedBuilding.address}</p>
              </div>
              <button 
                className="action-btn" 
                onClick={() => setSelectedBuilding(null)} 
                title="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            {/* Floor Filter */}
            {buildingFloors.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <select 
                  className="form-input" 
                  value={selectedFloorFilter} 
                  onChange={(e) => setSelectedFloorFilter(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <option value="all">All Floors</option>
                  {buildingFloors.map(f => (
                    <option key={f.floor_id} value={f.floor_id}>{f.name} (Lvl {f.level})</option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ overflowY: 'auto', flex: 1, paddingRight: 4 }}>
              {isLoadingRooms ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}>Loading rooms...</div>
              ) : (() => {
                const filteredRooms = roomsList.filter(room => {
                  if (selectedFloorFilter === "all") return true;
                  return room.floor_id === selectedFloorFilter;
                });
                
                if (filteredRooms.length === 0) {
                  return (
                    <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>
                      No rooms found for this selection.
                    </div>
                  );
                }

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {filteredRooms.map(room => (
                      <div key={room.room_id} style={{ 
                        padding: '12px 16px', 
                        background: 'rgba(255,255,255,0.03)', 
                        borderRadius: 8,
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <div>
                          <div style={{ fontWeight: 600 }}>{room.name}</div>
                          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Room: {room.room_number || room.code || 'N/A'}</div>
                        </div>
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '6px 12px', fontSize: '13px' }}
                          onClick={() => router.push(`/rooms/${room.room_id}`)}
                        >
                          View Room
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .action-btn { background: transparent; border: none; cursor: pointer; color: var(--text-muted); transition: color 0.2s; display: flex; align-items: center; justify-content: center; padding: 4px; border-radius: 6px; }
        .action-btn:hover { background: rgba(255,255,255,0.05); color: var(--text-primary); }
        .action-btn.edit-btn:hover { color: var(--accent-blue); background: rgba(59,130,246,0.1); }
        .action-btn.delete-btn:hover { color: var(--accent-red); background: rgba(239,68,68,0.1); }
      `}</style>
    </div>
  );
}
