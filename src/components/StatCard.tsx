import type { ReactNode } from "react";

interface StatCardProps {
  icon: ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  color: "blue" | "green" | "amber" | "red" | "purple";
}

export default function StatCard({
  icon,
  label,
  value,
  sub,
  color,
}: StatCardProps) {
  return (
    <div className={`stat-card ${color} animate-in`}>
      <div className="stat-card-header">
        <span className="stat-card-label">{label}</span>
        <div className={`stat-card-icon ${color}`}>{icon}</div>
      </div>
      <div className="stat-card-value">{value}</div>
      {sub && <div className="stat-card-sub">{sub}</div>}
    </div>
  );
}
