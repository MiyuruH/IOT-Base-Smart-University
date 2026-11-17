import type { Metadata } from "next";
import "./globals.css";
import AppSplashGate from "@/components/AppSplashGate";

export const metadata: Metadata = {
  title: "NavSense — Smart Campus Monitoring",
  description:
    "IoT-based smart university monitoring system with realtime sensor data, occupancy tracking, and anomaly detection.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      {/* This tells Next.js to safely ignore any minor attribute changes done to the body tag by browser extensions */}
      <body suppressHydrationWarning>
        <AppSplashGate />
        {children}
      </body>
    </html>
  );
}
