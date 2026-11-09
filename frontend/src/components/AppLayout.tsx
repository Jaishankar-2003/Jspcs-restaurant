import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useMode } from "../context/ModeContext";
import {
  DashboardIcon,
  PosIcon,
  OrdersIcon,
  KitchenIcon,
  TablesIcon,
  InventoryIcon,
  MenuIcon,
  ReportsIcon,
  LogoutIcon,
  SparklesIcon
} from "./Icons";

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  showBack?: boolean;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  children,
  title,
  subtitle,
  actions,
  showBack = false,
}) => {
  const { role, logout } = useAuth();
  const { mode } = useMode();
  const location = useLocation();
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const navItems = [
    { to: "/dashboard", label: "Overview", icon: DashboardIcon },
    { to: "/dashboard/billing", label: "Counter POS", icon: PosIcon, highlight: true },
    { to: "/dashboard/orders", label: "Orders", icon: OrdersIcon },
    { to: "/dashboard/kitchen", label: "Kitchen KDS", icon: KitchenIcon },
    { to: "/dashboard/tables", label: "Floor Plan", icon: TablesIcon },
    { to: "/dashboard/inventory", label: "Stock", icon: InventoryIcon },
    { to: "/dashboard/menu", label: "Dishes", icon: MenuIcon },
    { to: "/dashboard/reports", label: "Analytics", icon: ReportsIcon },
  ];

  return (
    <div className="app-shell">
      {/* ── Top Premium Navigation Header ── */}
      <header className="app-header">
        <div className="header-left">
          <Link to="/dashboard" className="brand-badge">
            <div className="brand-logo-3d">
              <span className="brand-flame">✦</span>
            </div>
            <div className="brand-meta">
              <div className="brand-title">
                AURA <span className="brand-title-accent">OS</span>
              </div>
              <div className="brand-subtitle">HAUTE CUISINE PLATFORM</div>
            </div>
          </Link>

          <div className="header-status-pill">
            <span className="status-dot-pulse" />
            <span className="status-mode">{mode?.toUpperCase() || "HYBRID"} MODE</span>
            <span className="status-divider">•</span>
            <span className="status-time">{currentTime}</span>
          </div>
        </div>

        {/* Navigation Bar */}
        <nav className="header-nav" aria-label="Main Navigation">
          {navItems.map((item) => {
            const isActive =
              item.to === "/dashboard"
                ? location.pathname === "/dashboard"
                : location.pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`nav-tab ${isActive ? "active" : ""} ${item.highlight ? "nav-highlight" : ""}`}
              >
                <Icon size={16} className="nav-icon" />
                <span className="nav-label">{item.label}</span>
                {isActive && <span className="nav-active-glow" />}
              </Link>
            );
          })}
        </nav>

        {/* User Info & Actions */}
        <div className="header-right">
          <div className="user-profile-badge">
            <div className="user-avatar">
              <SparklesIcon size={14} />
            </div>
            <div className="user-info">
              <span className="user-role-text">{role?.toUpperCase() || "USER"}</span>
              <span className="user-status-text">Active Station</span>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="btn-logout"
            title="Sign out of station"
            aria-label="Logout"
          >
            <LogoutIcon size={16} />
            <span className="logout-text">Exit</span>
          </button>
        </div>
      </header>

      {/* ── Subheader / Page Header (if title or actions present) ── */}
      {(title || actions || showBack) && (
        <div className="page-header-strip">
          <div className="page-header-content">
            <div className="page-title-group">
              {showBack && (
                <button onClick={() => navigate("/dashboard")} className="btn-back-pill">
                  ← Dashboard
                </button>
              )}
              <div>
                {title && <h1 className="page-main-title">{title}</h1>}
                {subtitle && <p className="page-main-subtitle">{subtitle}</p>}
              </div>
            </div>

            {actions && <div className="page-header-actions">{actions}</div>}
          </div>
        </div>
      )}

      {/* ── Main Content Area ── */}
      <main className="app-main-content">
        <div className="app-container">
          {children}
        </div>
      </main>
    </div>
  );
};

