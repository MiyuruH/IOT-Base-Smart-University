"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Lock,
  Save,
  Settings,
  TriangleAlert,
  User,
  Volume2,
  type LucideIcon,
} from "lucide-react";
import {
  useNotifications,
  type AlertSettingsConfig,
} from "@/components/NotificationProvider";

interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: string;
}

const tabs: { id: string; label: string; icon: LucideIcon }[] = [
  { id: "profile", label: "Profile", icon: User },
  { id: "password", label: "Change Password", icon: Lock },
  { id: "preferences", label: "Preferences", icon: Settings },
  { id: "danger", label: "Danger Zone", icon: TriangleAlert },
];

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState("profile");
  const {
    alertSettings,
    soundEnabled,
    toastEnabled,
    desktopEnabled,
    setSoundEnabled,
    setToastEnabled,
    setDesktopEnabled,
    updateAlertSettings,
    playAlertSound,
  } = useNotifications();

  const [thresholdForm, setThresholdForm] =
    useState<AlertSettingsConfig>(alertSettings);
  const [thresholdSaving, setThresholdSaving] = useState(false);
  const [thresholdMsg, setThresholdMsg] = useState<string | null>(null);

  useEffect(() => {
    setThresholdForm(alertSettings);
  }, [alertSettings]);

  // Change password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwMsg, setPwMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pwLoading, setPwLoading] = useState(false);

  // Profile update state
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [profileMsg, setProfileMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (userData) {
      try {
        const parsedNode = JSON.parse(userData);
        setUser(parsedNode);
        setEditName(parsedNode.name || "");
        setEditEmail(parsedNode.email || "");
      } catch (err) {
        console.error("Failed to parse user data", err);
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/login");
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg(null);

    if (!editName || !editEmail) {
      setProfileMsg({ type: "error", text: "Name and email are required" });
      return;
    }

    setProfileLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/auth/update-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: editName, email: editEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        setProfileMsg({ type: "error", text: data.error || "Failed to update profile" });
      } else {
        setProfileMsg({ type: "success", text: "Profile updated successfully!" });
        // Update local storage and state with the newly returned token and user data
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        setUser(data.user);
        setIsEditingProfile(false);
      }
    } catch {
      setProfileMsg({ type: "error", text: "Network error. Please try again." });
    } finally {
      setProfileLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPwMsg({ type: "error", text: "All fields are required" });
      return;
    }
    if (newPassword.length < 6) {
      setPwMsg({ type: "error", text: "New password must be at least 6 characters" });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwMsg({ type: "error", text: "New passwords do not match" });
      return;
    }

    setPwLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPwMsg({ type: "error", text: data.error || "Failed to change password" });
      } else {
        setPwMsg({ type: "success", text: "Password changed successfully!" });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch {
      setPwMsg({ type: "error", text: "Network error. Please try again." });
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <div className="settings-page">
      <div className="page-header">
        <h2>Settings</h2>
        <p>Manage your account and system preferences</p>
      </div>

      {/* ── Horizontal Tabs ── */}
      <div className="settings-tabs">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              className={`settings-tab ${activeTab === tab.id ? "settings-tab-active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="settings-tab-icon">
                <Icon size={16} />
              </span>
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Tab Content ── */}
      <div className="settings-tab-content animate-in" key={activeTab}>
        {activeTab === "profile" && (
          <div className="settings-section">
            <div className="settings-section-header">
              <h3>Profile Information</h3>
              <p>Your account details and role</p>
            </div>
            <div className="settings-section-body">
              {profileMsg && (
                <div className={`settings-msg ${profileMsg.type === "success" ? "settings-msg-success" : "settings-msg-error"}`}>
                  {profileMsg.text}
                </div>
              )}
              {!isEditingProfile ? (
                <div className="settings-profile-grid">
                  <div className="settings-profile-item">
                    <label>Full Name</label>
                    <span>{user?.name || "Loading..."}</span>
                  </div>
                  <div className="settings-profile-item">
                    <label>Email Address</label>
                    <span>{user?.email || "Loading..."}</span>
                  </div>
                  <div className="settings-profile-item">
                    <label>Role</label>
                    <span className="badge blue">{user?.role || "USER"}</span>
                  </div>
                  <div className="settings-profile-item">
                    <label>User ID</label>
                    <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "monospace" }}>
                      {user?.uid || "—"}
                    </span>
                  </div>
                  <div style={{ gridColumn: "1 / -1", marginTop: "12px" }}>
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => {
                        setEditName(user?.name || "");
                        setEditEmail(user?.email || "");
                        setIsEditingProfile(true);
                        setProfileMsg(null);
                      }}
                    >
                      Edit Profile
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleUpdateProfile} className="settings-pw-form">
                  <div className="form-group">
                    <label className="form-label">Full Name</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Enter your name"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email Address</label>
                    <input
                      type="email"
                      className="form-input"
                      placeholder="Enter your email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Role</label>
                    <div>
                      <span className="badge blue" style={{ marginTop: 4 }}>{user?.role || "USER"}</span>
                    </div>
                  </div>
                  <div className="form-group" style={{ marginBottom: 24 }}>
                    <label className="form-label">User ID</label>
                    <div style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: "monospace", marginTop: 4 }}>
                      {user?.uid || "—"}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <button type="submit" className="btn btn-primary" disabled={profileLoading}>
                      {profileLoading ? "Saving..." : "Save Changes"}
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-outline" 
                      disabled={profileLoading} 
                      onClick={() => setIsEditingProfile(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {activeTab === "password" && (
          <div className="settings-section">
            <div className="settings-section-header">
              <h3>Change Password</h3>
              <p>Update your account password</p>
            </div>
            <div className="settings-section-body">
              {pwMsg && (
                <div className={`settings-msg ${pwMsg.type === "success" ? "settings-msg-success" : "settings-msg-error"}`}>
                  {pwMsg.text}
                </div>
              )}
              <form onSubmit={handleChangePassword} className="settings-pw-form">
                <div className="form-group">
                  <label className="form-label">Current Password</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="Enter current password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">New Password</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="Enter new password (min 6 characters)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Confirm New Password</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
                <button type="submit" className="btn btn-primary" disabled={pwLoading}>
                  {pwLoading ? "Updating..." : "Update Password"}
                </button>
              </form>
            </div>
          </div>
        )}

        {activeTab === "preferences" && (
          <div className="settings-section">
            <div className="settings-section-header">
              <h3>Notification &amp; System Preferences</h3>
              <p>Configure real-time anomaly alerts, audio chimes, and display</p>
            </div>
            <div className="settings-section-body">
              <div className="settings-pref-row">
                <div>
                  <div className="settings-pref-title">Global Alerts Sound</div>
                  <div className="settings-pref-desc">
                    Play an audio chime when a new campus anomaly occurs
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => playAlertSound("HIGH")}
                    title="Preview critical alert sound"
                  >
                    <Volume2 size={14} />
                    Test Sound
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${
                      soundEnabled ? "btn-primary" : "btn-ghost"
                    }`}
                    onClick={() => setSoundEnabled(!soundEnabled)}
                  >
                    {soundEnabled ? "Enabled" : "Muted"}
                  </button>
                </div>
              </div>

              <div className="settings-pref-row">
                <div>
                  <div className="settings-pref-title">
                    Live Popup Toast Notifications
                  </div>
                  <div className="settings-pref-desc">
                    Show floating real-time alert cards with quick actions when
                    thresholds are breached
                  </div>
                </div>
                <button
                  type="button"
                  className={`btn btn-sm ${
                    toastEnabled ? "btn-primary" : "btn-ghost"
                  }`}
                  onClick={() => setToastEnabled(!toastEnabled)}
                >
                  {toastEnabled ? "Enabled" : "Disabled"}
                </button>
              </div>

              <div className="settings-pref-row">
                <div>
                  <div className="settings-pref-title">
                    Browser Desktop Notifications
                  </div>
                  <div className="settings-pref-desc">
                    Send native OS notifications when NavSense is running in a
                    background tab
                  </div>
                </div>
                <button
                  type="button"
                  className={`btn btn-sm ${
                    desktopEnabled ? "btn-primary" : "btn-ghost"
                  }`}
                  onClick={() => setDesktopEnabled(!desktopEnabled)}
                >
                  <Bell size={14} />
                  {desktopEnabled ? "Enabled" : "Enable"}
                </button>
              </div>

              <div className="settings-pref-row">
                <div>
                  <div className="settings-pref-title">Theme Mode</div>
                  <div className="settings-pref-desc">
                    Currently locked to immersive dark mode
                  </div>
                </div>
                <span className="badge blue">Dark</span>
              </div>

              {/* Database Threshold Settings Section inside Preferences */}
              <div
                style={{
                  marginTop: 24,
                  paddingTop: 20,
                  borderTop: "1px solid var(--border-color)",
                }}
              >
                <h4 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
                  Database Alert Threshold Levels
                </h4>
                <p
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    marginBottom: 16,
                  }}
                >
                  Adjust the sensor thresholds stored in Supabase for automatic
                  campus anomaly detection
                </p>

                {thresholdMsg && (
                  <div className="settings-msg settings-msg-success">
                    {thresholdMsg}
                  </div>
                )}

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 14,
                    marginBottom: 16,
                  }}
                >
                  <div>
                    <label className="form-label">
                      High Temperature (Warning / Critical)
                    </label>
                    <div style={{ display: "flex", gap: 8 }}>
                      <div className="unit-input-wrap" title="Warning Temperature (°C)">
                        <input
                          type="number"
                          step="0.5"
                          value={thresholdForm.temp_warning_c}
                          onChange={(e) =>
                            setThresholdForm({
                              ...thresholdForm,
                              temp_warning_c: Number(e.target.value),
                            })
                          }
                          placeholder="Warn"
                        />
                        <span className="unit-input-badge">°C</span>
                      </div>
                      <div className="unit-input-wrap" title="Critical Temperature (°C)">
                        <input
                          type="number"
                          step="0.5"
                          value={thresholdForm.temp_critical_c}
                          onChange={(e) =>
                            setThresholdForm({
                              ...thresholdForm,
                              temp_critical_c: Number(e.target.value),
                            })
                          }
                          placeholder="Crit"
                        />
                        <span className="unit-input-badge">°C</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="form-label">
                      Ghost Cooling Vacant Temp (Below)
                    </label>
                    <div className="unit-input-wrap">
                      <input
                        type="number"
                        step="0.5"
                        value={thresholdForm.ghost_cooling_temp_c}
                        onChange={(e) =>
                          setThresholdForm({
                            ...thresholdForm,
                            ghost_cooling_temp_c: Number(e.target.value),
                          })
                        }
                      />
                      <span className="unit-input-badge">°C</span>
                    </div>
                  </div>

                  <div>
                    <label className="form-label">
                      Acoustic Noise (Warning / Critical)
                    </label>
                    <div style={{ display: "flex", gap: 8 }}>
                      <div className="unit-input-wrap" title="Warning Noise (dB)">
                        <input
                          type="number"
                          value={thresholdForm.noise_warning_db}
                          onChange={(e) =>
                            setThresholdForm({
                              ...thresholdForm,
                              noise_warning_db: Number(e.target.value),
                            })
                          }
                        />
                        <span className="unit-input-badge">dB</span>
                      </div>
                      <div className="unit-input-wrap" title="Critical Noise (dB)">
                        <input
                          type="number"
                          value={thresholdForm.noise_critical_db}
                          onChange={(e) =>
                            setThresholdForm({
                              ...thresholdForm,
                              noise_critical_db: Number(e.target.value),
                            })
                          }
                        />
                        <span className="unit-input-badge">dB</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="form-label">
                      Humidity (Warning / Critical)
                    </label>
                    <div style={{ display: "flex", gap: 8 }}>
                      <div className="unit-input-wrap" title="Warning Humidity (%)">
                        <input
                          type="number"
                          value={thresholdForm.humidity_warning_pct}
                          onChange={(e) =>
                            setThresholdForm({
                              ...thresholdForm,
                              humidity_warning_pct: Number(e.target.value),
                            })
                          }
                        />
                        <span className="unit-input-badge">%</span>
                      </div>
                      <div className="unit-input-wrap" title="Critical Humidity (%)">
                        <input
                          type="number"
                          value={thresholdForm.humidity_critical_pct}
                          onChange={(e) =>
                            setThresholdForm({
                              ...thresholdForm,
                              humidity_critical_pct: Number(e.target.value),
                            })
                          }
                        />
                        <span className="unit-input-badge">%</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="form-label">
                      Sensor Offline Timeout (Warning / Critical)
                    </label>
                    <div style={{ display: "flex", gap: 8 }}>
                      <div className="unit-input-wrap" title="Warning Offline Timeout (min)">
                        <input
                          type="number"
                          value={thresholdForm.offline_warning_min}
                          onChange={(e) =>
                            setThresholdForm({
                              ...thresholdForm,
                              offline_warning_min: Number(e.target.value),
                            })
                          }
                        />
                        <span className="unit-input-badge">min</span>
                      </div>
                      <div className="unit-input-wrap" title="Critical Offline Timeout (min)">
                        <input
                          type="number"
                          value={thresholdForm.offline_critical_min}
                          onChange={(e) =>
                            setThresholdForm({
                              ...thresholdForm,
                              offline_critical_min: Number(e.target.value),
                            })
                          }
                        />
                        <span className="unit-input-badge">min</span>
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      paddingTop: 22,
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
                        checked={thresholdForm.auto_resolve}
                        onChange={(e) =>
                          setThresholdForm({
                            ...thresholdForm,
                            auto_resolve: e.target.checked,
                          })
                        }
                      />
                      Auto-resolve alerts when normal
                    </label>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={thresholdSaving}
                  onClick={async () => {
                    setThresholdSaving(true);
                    setThresholdMsg(null);
                    try {
                      await updateAlertSettings(thresholdForm);
                      setThresholdMsg(
                        "Threshold settings saved to database!"
                      );
                      setTimeout(() => setThresholdMsg(null), 3000);
                    } finally {
                      setThresholdSaving(false);
                    }
                  }}
                >
                  <Save size={14} />
                  {thresholdSaving
                    ? "Saving to Database..."
                    : "Save Thresholds to Database"}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "danger" && (
          <div className="settings-section settings-danger">
            <div className="settings-section-header">
              <h3>Danger Zone</h3>
              <p>Irreversible account actions</p>
            </div>
            <div className="settings-section-body">
              <div className="settings-pref-row">
                <div>
                  <div className="settings-pref-title">Sign Out</div>
                  <div className="settings-pref-desc">Log out of your account on this device</div>
                </div>
                <button className="btn btn-danger btn-sm" onClick={handleLogout}>
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
