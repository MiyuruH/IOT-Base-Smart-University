"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const pageMeta: Record<string, { title: string; subtitle: string }> = {
  "/dashboard": { title: "Dashboard", subtitle: "Smart University Overview" },
  "/buildings": { title: "Buildings", subtitle: "Manage campus buildings" },
  "/rooms": { title: "Rooms", subtitle: "Monitor room occupancy" },
  "/alerts": { title: "Alerts", subtitle: "System notifications" },
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

  const meta = pageMeta[pathname] || { title: "NavSense", subtitle: "Smart University Dashboard" };

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="top-navbar">
      {/* Page Title */}
      <div className="top-navbar-title">
        <h2>{meta.title}</h2>
        <span>{meta.subtitle}</span>
      </div>

      {/* Search Bar */}
      <div className="top-navbar-search">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          placeholder="Search rooms, devices..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Right Section */}
      <div className="top-navbar-right">
        <span className="top-navbar-status">
          <span className="live-dot" />
          Operational
        </span>
        <span className="top-navbar-time">{time}</span>
        <div 
          className="top-navbar-avatar" 
          onClick={() => router.push("/settings")}
          style={{ cursor: "pointer" }}
          title="Profile Settings"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
      </div>
    </header>
  );
}
