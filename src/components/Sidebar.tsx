"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Bell,
  Building2,
  ChevronRight,
  DoorOpen,
  FileText,
  LayoutDashboard,
  LogOut,
  Settings,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useNotifications } from "@/components/NotificationProvider";

const navItems: {
  href: string;
  label: string;
  icon: LucideIcon;
  superAdminOnly?: boolean;
}[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/buildings", label: "Buildings", icon: Building2 },
  { href: "/rooms", label: "Rooms", icon: DoorOpen },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/analytics", label: "Analytics", icon: TrendingUp },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/users", label: "User Management", icon: Users, superAdminOnly: true },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const { activeCount, highSeverityCount } = useNotifications();

  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        setRole(user.role);
      } catch (e) {}
    }
    // Restore collapsed state
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved === "true") setCollapsed(true);
  }, []);

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("sidebar-collapsed", String(next));
    // Dispatch event so layout can react
    window.dispatchEvent(new CustomEvent("sidebar-toggle", { detail: next }));
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Even if the API call fails, clear client-side state
    }
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.replace("/login");
  };

  const filteredNav = navItems.filter((item) => 
    !(("superAdminOnly" in item) && (item as any).superAdminOnly === true) || role === "SUPER_ADMIN"
  );

  return (
    <aside className={`sidebar ${collapsed ? "sidebar-collapsed" : ""}`}>
      {/* Collapse/Expand Toggle — on the sidebar border line */}
      <button
        className="sidebar-toggle-btn"
        onClick={toggleCollapse}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        <ChevronRight
          size={14}
          strokeWidth={2.5}
          style={{ transform: collapsed ? "rotate(0deg)" : "rotate(180deg)", transition: "transform 0.3s ease" }}
        />
      </button>

      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">N</div>
        {!collapsed && <h1>NavSens</h1>}
      </div>

      {!collapsed && <div className="sidebar-section-label">Main Menu</div>}

      <nav className="sidebar-nav">
        {filteredNav.map((item) => {
          const Icon = item.icon;
          const isAlertsItem = item.href === "/alerts";
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-link ${
                pathname.startsWith(item.href) ? "active" : ""
              }`}
              style={{ position: "relative" }}
              title={collapsed ? item.label : undefined}
            >
              <span className="sidebar-link-icon" style={{ position: "relative" }}>
                <Icon size={20} />
                {collapsed && isAlertsItem && activeCount > 0 && (
                  <span
                    className={`sidebar-alert-dot ${
                      highSeverityCount > 0 ? "critical" : ""
                    }`}
                  />
                )}
              </span>
              {!collapsed && (
                <>
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {isAlertsItem && activeCount > 0 && (
                    <span
                      className={`sidebar-alert-badge ${
                        highSeverityCount > 0 ? "critical" : ""
                      }`}
                    >
                      {activeCount > 99 ? "99+" : activeCount}
                    </span>
                  )}
                </>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Logout Button */}
      <div className="sidebar-footer">
        <button
          className="sidebar-link sidebar-logout-btn"
          onClick={handleLogout}
          title={collapsed ? "Logout" : undefined}
        >
          <span className="sidebar-link-icon">
            <LogOut size={20} />
          </span>
          {!collapsed && "Logout"}
        </button>
      </div>
    </aside>
  );
}
