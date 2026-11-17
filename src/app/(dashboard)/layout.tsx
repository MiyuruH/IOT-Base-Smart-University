"use client";

import Sidebar from "@/components/Sidebar";
import TopNavbar from "@/components/TopNavbar";
import NotificationProvider from "@/components/NotificationProvider";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    // Client-side auth guard (defense-in-depth alongside middleware)
    const token = localStorage.getItem("token");
    if (!token) {
      router.replace("/login");
      return;
    }
    setAuthChecked(true);

    // Read initial sidebar state
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved === "true") setCollapsed(true);

    // Listen for toggle events from sidebar
    const handler = (e: Event) => {
      setCollapsed((e as CustomEvent).detail);
    };
    window.addEventListener("sidebar-toggle", handler);
    return () => window.removeEventListener("sidebar-toggle", handler);
  }, [router]);

  // Show loading while checking auth
  if (!authChecked) {
    return (
      <div className="loading">
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <NotificationProvider>
      <div className={`app-layout ${collapsed ? "sidebar-is-collapsed" : ""}`}>
        <Sidebar />
        <div className="main-wrapper">
          <TopNavbar />
          <main className="main-content">{children}</main>
        </div>
      </div>
    </NotificationProvider>
  );
}

