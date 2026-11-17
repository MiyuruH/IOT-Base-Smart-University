"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Bell,
  BellRing,
  Check,
  CheckCheck,
  CircleCheck,
  ExternalLink,
  Search,
  User,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  formatRelativeTime,
  getAlertMeta,
  useNotifications,
} from "@/components/NotificationProvider";

const pageMeta: Record<string, { title: string; subtitle: string }> = {
  "/dashboard": { title: "Dashboard", subtitle: "Smart University Overview" },
  "/buildings": { title: "Buildings", subtitle: "Manage campus buildings" },
  "/rooms": { title: "Rooms", subtitle: "Monitor room occupancy" },
  "/alerts": { title: "Alerts", subtitle: "Real-time anomaly & notification center" },
  "/analytics": { title: "Analytics", subtitle: "Campus Analytics Dashboard" },
  "/reports": { title: "Reports", subtitle: "System reports" },
  "/users": { title: "User Management", subtitle: "Manage system users" },
  "/settings": { title: "Settings", subtitle: "System configuration" },
};

export default function TopNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [time, setTime] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifTab, setNotifTab] = useState<"active" | "resolved">("active");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    activeAlerts,
    allAlerts,
    unreadIds,
    unreadCount,
    activeCount,
    highSeverityCount,
    soundEnabled,
    setSoundEnabled,
    resolveAlert,
    resolveAllAlerts,
    markRead,
    markAllRead,
  } = useNotifications();

  const meta = pageMeta[pathname] || {
    title: "NavSense",
    subtitle: "Smart University Dashboard",
  };

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Close notification popover on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsNotifOpen(false);
      }
    };
    if (isNotifOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isNotifOpen]);

  const resolvedAlerts = allAlerts.filter((a) => !a.is_active).slice(0, 15);
  const displayedAlerts = notifTab === "active" ? activeAlerts : resolvedAlerts;

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      if (q.includes("alert") || q.includes("anomaly") || q.includes("ghost")) {
        router.push("/alerts");
      } else if (q.includes("building")) {
        router.push("/buildings");
      } else {
        router.push("/rooms");
      }
    }
  };

  return (
    <header className="top-navbar">
      {/* Page Title */}
      <div className="top-navbar-title">
        <h2>{meta.title}</h2>
        <span>{meta.subtitle}</span>
      </div>

      {/* Search Bar */}
      <div className="top-navbar-search">
        <Search size={16} />
        <input
          type="text"
          placeholder="Search rooms, alerts, devices..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleSearchKeyDown}
        />
      </div>

      {/* Right Section */}
      <div className="top-navbar-right">
        {/* Dynamic System Status Pill */}
        {highSeverityCount > 0 ? (
          <button
            type="button"
            className="top-navbar-status top-navbar-status-critical"
            onClick={() => router.push("/alerts")}
            title="Click to view critical alerts"
          >
            <span
              className="live-dot"
              style={{ background: "var(--accent-red)" }}
            />
            {highSeverityCount} Critical Alert{highSeverityCount > 1 ? "s" : ""}
          </button>
        ) : activeCount > 0 ? (
          <button
            type="button"
            className="top-navbar-status top-navbar-status-warning"
            onClick={() => router.push("/alerts")}
            title="Click to view active alerts"
          >
            <span
              className="live-dot"
              style={{ background: "var(--accent-amber)" }}
            />
            {activeCount} Active Alert{activeCount > 1 ? "s" : ""}
          </button>
        ) : (
          <span className="top-navbar-status">
            <span className="live-dot" />
            Operational
          </span>
        )}

        <span className="top-navbar-time">{time}</span>

        {/* Notification Bell & Popover */}
        <div className="notif-wrapper" ref={dropdownRef}>
          <button
            type="button"
            className={`notif-bell-btn ${activeCount > 0 ? "has-alerts" : ""} ${
              isNotifOpen ? "active" : ""
            }`}
            onClick={() => {
              const nextOpen = !isNotifOpen;
              setIsNotifOpen(nextOpen);
              if (nextOpen && unreadCount > 0) {
                markAllRead();
              }
            }}
            title={
              activeCount > 0
                ? `${activeCount} active alert(s)`
                : "Notifications (All clear)"
            }
          >
            {activeCount > 0 ? <BellRing size={18} /> : <Bell size={18} />}
            {activeCount > 0 && (
              <span
                className={`notif-badge ${
                  highSeverityCount > 0 ? "notif-badge-critical" : ""
                }`}
              >
                {activeCount > 99 ? "99+" : activeCount}
              </span>
            )}
          </button>

          {isNotifOpen && (
            <div className="notif-popover animate-in">
              <div className="notif-popover-header">
                <div>
                  <h4>Notifications</h4>
                  <span>
                    {activeCount > 0
                      ? `${activeCount} active campus anomaly alert${
                          activeCount > 1 ? "s" : ""
                        }`
                      : "All campus systems normal"}
                  </span>
                </div>
                <div className="notif-popover-header-actions">
                  <button
                    type="button"
                    className="notif-icon-action"
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    title={
                      soundEnabled ? "Mute alert sound" : "Unmute alert sound"
                    }
                  >
                    {soundEnabled ? (
                      <Volume2 size={15} />
                    ) : (
                      <VolumeX size={15} />
                    )}
                  </button>
                  {activeCount > 0 && (
                    <button
                      type="button"
                      className="notif-text-action"
                      onClick={() => resolveAllAlerts()}
                      title="Resolve all active alerts"
                    >
                      <CheckCheck size={14} />
                      Resolve all
                    </button>
                  )}
                </div>
              </div>

              {/* Popover Tabs */}
              <div className="notif-popover-tabs">
                <button
                  type="button"
                  className={`notif-popover-tab ${
                    notifTab === "active" ? "active" : ""
                  }`}
                  onClick={() => setNotifTab("active")}
                >
                  Active
                  <span className="notif-tab-count">{activeCount}</span>
                </button>
                <button
                  type="button"
                  className={`notif-popover-tab ${
                    notifTab === "resolved" ? "active" : ""
                  }`}
                  onClick={() => setNotifTab("resolved")}
                >
                  Resolved History
                  <span className="notif-tab-count">{resolvedAlerts.length}</span>
                </button>
              </div>

              {/* Popover Body */}
              <div className="notif-popover-list">
                {displayedAlerts.length === 0 ? (
                  <div className="notif-empty">
                    <div className="notif-empty-icon">
                      <CircleCheck size={32} strokeWidth={1.6} />
                    </div>
                    <p>
                      {notifTab === "active"
                        ? "No active alerts! Campus environment is optimal."
                        : "No resolved alerts in recent history."}
                    </p>
                  </div>
                ) : (
                  displayedAlerts.slice(0, 8).map((alert) => {
                    const alertMeta = getAlertMeta(alert.type);
                    const Icon = alertMeta.icon;
                    const isUnread = unreadIds.has(alert.anomaly_id);
                    const sevClass =
                      alert.severity === "HIGH"
                        ? "red"
                        : alert.severity === "MEDIUM"
                          ? "amber"
                          : "blue";

                    return (
                      <div
                        key={alert.anomaly_id}
                        className={`notif-item ${isUnread ? "unread" : ""}`}
                        onClick={() => markRead(alert.anomaly_id)}
                      >
                        <div
                          className="notif-item-icon"
                          style={{
                            background: alertMeta.bg,
                            color: alertMeta.color,
                          }}
                        >
                          <Icon size={17} />
                        </div>

                        <div className="notif-item-content">
                          <div className="notif-item-top">
                            <span className="notif-item-title">
                              {alertMeta.shortLabel}
                            </span>
                            <span
                              className={`badge ${sevClass}`}
                              style={{ padding: "1px 7px", fontSize: 10 }}
                            >
                              {alert.severity}
                            </span>
                            <span className="notif-item-time">
                              {formatRelativeTime(
                                alert.is_active
                                  ? alert.start_at
                                  : alert.end_at || alert.start_at
                              )}
                            </span>
                          </div>

                          <p className="notif-item-msg">{alert.message}</p>

                          <div className="notif-item-footer">
                            {alert.rooms?.name && (
                              <span className="notif-item-room">
                                {alert.rooms.name}
                                {alert.rooms.code ? ` (${alert.rooms.code})` : ""}
                              </span>
                            )}
                            <div className="notif-item-btns">
                              {alert.room_id && (
                                <button
                                  type="button"
                                  className="notif-mini-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setIsNotifOpen(false);
                                    router.push(`/rooms/${alert.room_id}`);
                                  }}
                                >
                                  <ExternalLink size={12} />
                                  Room
                                </button>
                              )}
                              {alert.is_active && (
                                <button
                                  type="button"
                                  className="notif-mini-btn notif-mini-btn-resolve"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    resolveAlert(alert.anomaly_id);
                                  }}
                                >
                                  <Check size={12} />
                                  Resolve
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Popover Footer */}
              <div className="notif-popover-footer">
                <button
                  type="button"
                  className="notif-view-all-btn"
                  onClick={() => {
                    setIsNotifOpen(false);
                    router.push("/alerts");
                  }}
                >
                  Open Full Alerts &amp; Notification Center
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Profile Avatar */}
        <div
          className="top-navbar-avatar"
          onClick={() => router.push("/settings")}
          style={{ cursor: "pointer" }}
          title="Profile & Alert Settings"
        >
          <User size={18} />
        </div>
      </div>
    </header>
  );
}
