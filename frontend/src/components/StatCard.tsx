import React from "react";

interface StatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon?: React.ReactNode;
  accentColor?: "primary" | "success" | "danger" | "indigo" | "purple";
  badge?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subValue,
  icon,
  accentColor = "primary",
  badge,
}) => {
  return (
    <div className={`stat-card-3d accent-${accentColor}`}>
      <div className="stat-card-glow" />
      <div className="stat-card-header">
        <span className="stat-card-label">{label}</span>
        {icon && <div className="stat-card-icon-box">{icon}</div>}
      </div>

      <div className="stat-card-body">
        <div className="stat-card-value">{value}</div>
        {subValue && <div className="stat-card-subvalue">{subValue}</div>}
      </div>

      {badge && (
        <div className="stat-card-footer">
          <span className="stat-badge">{badge}</span>
        </div>
      )}
    </div>
  );
};

