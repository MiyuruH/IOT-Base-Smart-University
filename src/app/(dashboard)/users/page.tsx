"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, Shield, SquarePen, Trash2, Users, X } from "lucide-react";

interface User {
  uid: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
  last_login_at: string;
  isProtected?: boolean;
}

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [formData, setFormData] = useState({ 
    uid: "", 
    name: "", 
    email: "", 
    password: "", 
    role: "ADMIN",
    is_active: true 
  });
  const [isSaving, setIsSaving] = useState(false);

  // Authorization check
  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (!userStr) {
      router.push("/login");
      return;
    }
    try {
      const user = JSON.parse(userStr);
      if (user.role !== "SUPER_ADMIN") {
        router.push("/dashboard");
      }
    } catch {
      router.push("/login");
    }
  }, [router]);

  const fetchUsers = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const headers: HeadersInit = token
        ? { Authorization: `Bearer ${token}` }
        : {};

      const res = await fetch("/api/users", { headers });
      const data = await res.json();
      if (Array.isArray(data)) setUsers(data);
    } catch (err) {
      console.error("Failed to fetch users:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

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

      const url = modalMode === "add" ? "/api/users" : `/api/users/${formData.uid}`;
      const method = modalMode === "add" ? "POST" : "PUT";
      
      const body = modalMode === "add" 
        ? { name: formData.name, email: formData.email, password: formData.password, role: formData.role }
        : { name: formData.name, role: formData.role, is_active: formData.is_active };

      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setIsModalOpen(false);
        fetchUsers();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to save user");
      }
    } catch (err) {
      console.error(err);
      alert("Error saving user");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Delete
  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete user ${name}? This action cannot be undone.`)) return;
    
    try {
      const token = localStorage.getItem("token");
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
      
      const res = await fetch(`/api/users/${id}`, {
        method: "DELETE",
        headers,
      });

      if (res.ok) {
        fetchUsers();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete user");
      }
    } catch (err) {
      console.error(err);
      alert("Error deleting user");
    }
  };

  const openAddModal = () => {
    setFormData({ uid: "", name: "", email: "", password: "", role: "ADMIN", is_active: true });
    setModalMode("add");
    setIsModalOpen(true);
  };

  const openEditModal = (u: User) => {
    setFormData({ 
      uid: u.uid, 
      name: u.name, 
      email: u.email, 
      password: "", 
      role: u.role,
      is_active: u.is_active
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
          <h2>User Management</h2>
          <p>Manage system administrators and super admins</p>
        </div>
        <button className="btn btn-primary" onClick={openAddModal}>
          <Plus size={18} />
          Add User
        </button>
      </div>

      {users.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <Users size={48} strokeWidth={1.5} />
          </div>
          <h3>No Users Found</h3>
          <p>Add a user to grant them access to the system.</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-color)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(255, 255, 255, 0.02)' }}>
                <th style={{ padding: '16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Name</th>
                <th style={{ padding: '16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Email</th>
                <th style={{ padding: '16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Role</th>
                <th style={{ padding: '16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Status</th>
                <th style={{ padding: '16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Added</th>
                <th style={{ padding: '16px', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.uid} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.2s' }} className="table-row">
                  <td style={{ padding: '16px', fontWeight: 500 }}>
                    <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 150 }} title={u.name || "Unnamed User"}>
                      {u.name || "Unnamed User"}
                    </div>
                  </td>
                  <td style={{ padding: '16px', color: 'var(--text-secondary)' }}>
                    <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 200 }} title={u.email}>
                      {u.email}
                    </div>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <span className={`badge ${u.role === "SUPER_ADMIN" ? "purple" : "blue"}`}>
                      {u.role.replace("_", " ")}
                    </span>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <span className={`badge ${u.is_active ? "green" : "red"}`}>
                      {u.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td style={{ padding: '16px', color: 'var(--text-muted)', fontSize: 13 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span>{new Date(u.created_at).toLocaleDateString()}</span>
                      {u.last_login_at && <span style={{ fontSize: 11, opacity: 0.7 }}>Last: {new Date(u.last_login_at).toLocaleDateString()}</span>}
                    </div>
                  </td>
                  <td style={{ padding: '16px', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button 
                      onClick={() => openEditModal(u)}
                      className="action-btn edit-btn"
                      title="Edit"
                    >
                      <SquarePen size={16} />
                    </button>
                    {u.isProtected ? (
                      <span
                        className="action-btn"
                        title="Original super admin — cannot be deleted"
                        style={{ cursor: "default", opacity: 0.4 }}
                      >
                        <Shield size={16} />
                      </span>
                    ) : (
                      <button 
                        onClick={() => handleDelete(u.uid, u.name || u.email)}
                        className="action-btn delete-btn"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
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
                {modalMode === "add" ? "Add New User" : "Edit User"}
              </h3>
              <button 
                className="action-btn" 
                onClick={() => setIsModalOpen(false)} 
                title="Close"
                type="button"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="John Doe"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              {modalMode === "add" && (
                <>
                  <div className="form-group">
                    <label className="form-label">Email Address *</label>
                    <input
                      type="email"
                      className="form-input"
                      placeholder="admin@navsense.io"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Password *</label>
                    <input
                      type="password"
                      className="form-input"
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required
                      minLength={6}
                    />
                  </div>
                </>
              )}

              <div className="form-group">
                <label className="form-label">Role</label>
                <select 
                  className="form-input" 
                  value={formData.role} 
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  style={{ cursor: "pointer" }}
                >
                  <option value="ADMIN">Admin</option>
                  <option value="SUPER_ADMIN">Super Admin</option>
                </select>
              </div>

              {modalMode === "edit" && (
                <div className="form-group" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16 }}>
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    style={{ width: 16, height: 16, cursor: "pointer" }}
                  />
                  <label htmlFor="is_active" className="form-label" style={{ marginBottom: 0, cursor: "pointer" }}>
                    Account is Active
                  </label>
                </div>
              )}

              <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
                <button type="button" className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={isSaving}>
                  {isSaving ? "Saving..." : "Save User"}
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
        .badge.green { background: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.2); }
        .badge.red { background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2); }
        .table-row:hover { background: rgba(255, 255, 255, 0.03) !important; }
      `}</style>
    </div>
  );
}
