import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useMode } from "../context/ModeContext";
import client from "../api/client";
import { AppLayout } from "../components/AppLayout";
import {
  PosIcon,
  OrdersIcon,
  KitchenIcon,
  TablesIcon,
  InventoryIcon,
  MenuIcon,
  ReportsIcon,
  ArrowRightIcon,
  SparklesIcon
} from "../components/Icons";

export default function DashboardPage() {
  const { role } = useAuth();
  const { mode } = useMode();
  const [dailySales, setDailySales] = useState<number | null>(null);
  const [activeOrderCount, setActiveOrderCount] = useState<number>(0);
  const [lowStockCount, setLowStockCount] = useState<number>(0);
  const [occupiedTablesCount, setOccupiedTablesCount] = useState<number>(0);

  useEffect(() => {
    // Gracefully load quick summary stats
    client.get("/reports/daily-sales")
      .then((res) => setDailySales(res.data?.total_sales ?? 0))
      .catch(() => setDailySales(null));

    client.get("/orders")
      .then((res) => {
        const active = res.data?.filter((o: any) => o.status !== "completed" && o.status !== "cancelled");
        setActiveOrderCount(active?.length || 0);
      })
      .catch(() => {});

    client.get("/tables")
      .then((res) => {
        const occ = res.data?.filter((t: any) => t.status !== "free");
        setOccupiedTablesCount(occ?.length || 0);
      })
      .catch(() => {});

    client.get("/products")
      .then((res) => {
        const low = res.data?.filter((p: any) => {
          const avail = p.total_stock - p.reserved_stock;
          return avail <= (p.low_stock_threshold || 5);
        });
        setLowStockCount(low?.length || 0);
      })
      .catch(() => {});
  }, []);

  const modules = [
    {
      to: "/dashboard/billing",
      title: "Counter POS",
      subtitle: "Fast takeaway & counter cashier terminal with F1 instant search",
      badge: "HOT KEY F1",
      icon: <PosIcon size={26} />,
      gradient: "linear-gradient(135deg, #f47b38 0%, #c2410c 100%)",
      glowColor: "var(--primary-glow)",
      accentBorder: "#f47b38",
      primaryAction: true,
    },
    {
      to: "/dashboard/orders",
      title: "Active Orders",
      subtitle: "Track, manage, bill-settle, and dispatch real-time orders",
      badge: activeOrderCount > 0 ? `${activeOrderCount} ACTIVE` : "LIVE QUEUE",
      icon: <OrdersIcon size={26} />,
      gradient: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
      glowColor: "rgba(59, 130, 246, 0.25)",
      accentBorder: "#3b82f6",
    },
    {
      to: "/dashboard/kitchen",
      title: "Kitchen KDS",
      subtitle: "High-visibility prep display with waiter special instructions",
      badge: "LIVE TICKETS",
      icon: <KitchenIcon size={26} />,
      gradient: "linear-gradient(135deg, #10b981 0%, #047857 100%)",
      glowColor: "rgba(16, 185, 129, 0.25)",
      accentBorder: "#10b981",
    },
    {
      to: "/dashboard/tables",
      title: "Floor Plan",
      subtitle: "Interactive dining room map, seat counts, and table ordering",
      badge: occupiedTablesCount > 0 ? `${occupiedTablesCount} OCCUPIED` : "SEATING MAP",
      icon: <TablesIcon size={26} />,
      gradient: "linear-gradient(135deg, #ec4899 0%, #be185d 100%)",
      glowColor: "rgba(236, 72, 153, 0.25)",
      accentBorder: "#ec4899",
    },
    {
      to: "/dashboard/inventory",
      title: "Stock & Inventory",
      subtitle: "Atomic reserved vs sold stock with threshold reorder alerts",
      badge: lowStockCount > 0 ? `⚠️ ${lowStockCount} LOW STOCK` : "MONITORED",
      icon: <InventoryIcon size={26} />,
      gradient: "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)",
      glowColor: "rgba(139, 92, 246, 0.25)",
      accentBorder: "#8b5cf6",
    },
    {
      to: "/dashboard/menu",
      title: "Dish Menu Catalog",
      subtitle: "Culinary dishes, veg/non-veg tags, categories, & CSV imports",
      badge: "CATALOG",
      icon: <MenuIcon size={26} />,
      gradient: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
      glowColor: "rgba(245, 158, 11, 0.25)",
      accentBorder: "#f59e0b",
    },
    {
      to: "/dashboard/reports",
      title: "Reports & Analytics",
      subtitle: "Revenue trends, top selling items, and system reset controls",
      badge: "FINANCIALS",
      icon: <ReportsIcon size={26} />,
      gradient: "linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)",
      glowColor: "rgba(6, 182, 212, 0.25)",
      accentBorder: "#06b6d4",
    },
  ];

  return (
    <AppLayout>
      {/* ── Executive Hero Welcome Strip (Warm Light Luxury) ── */}
      <div
        className="card-3d"
        style={{
          padding: "2rem 2.25rem",
          marginBottom: "2rem",
          background: "linear-gradient(135deg, #ffffff 0%, #faf8f4 100%)",
          border: "1px solid var(--border-medium)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1.5rem",
          boxShadow: "var(--shadow-3d-sm)",
        }}
      >
        <div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.25rem 0.75rem", background: "var(--primary-subtle)", borderRadius: "9999px", color: "var(--primary)", fontSize: "0.75rem", fontWeight: 800, marginBottom: "0.6rem" }}>
            <SparklesIcon size={12} />
            <span>EXECUTIVE DISPATCH TERMINAL</span>
          </div>
          <h1 style={{ fontSize: "2.2rem", fontWeight: 900, letterSpacing: "-0.03em", margin: 0, color: "var(--text-primary)" }}>
            Restaurant Command Center
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", margin: "0.35rem 0 0 0" }}>
            Operating in <strong style={{ color: "var(--primary)" }}>{mode?.toUpperCase() || "HYBRID"}</strong> mode • Station operator: <strong style={{ color: "var(--text-primary)" }}>{role?.toUpperCase()}</strong>
          </p>
        </div>

        {/* Telemetry Stats Pill Cluster */}
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          {dailySales !== null && (
            <div style={{ background: "var(--bg-surface-1)", border: "1px solid var(--border-medium)", padding: "0.75rem 1.25rem", borderRadius: "var(--radius-lg)", minWidth: "140px" }}>
              <div style={{ fontSize: "0.7rem", fontWeight: 800, color: "var(--text-muted)", letterSpacing: "0.05em", textTransform: "uppercase" }}>TODAY'S REVENUE</div>
              <div style={{ fontFamily: "Outfit, sans-serif", fontSize: "1.5rem", fontWeight: 900, color: "var(--success)" }}>₹{dailySales.toFixed(2)}</div>
            </div>
          )}

          <div style={{ background: "var(--bg-surface-1)", border: "1px solid var(--border-medium)", padding: "0.75rem 1.25rem", borderRadius: "var(--radius-lg)", minWidth: "130px" }}>
            <div style={{ fontSize: "0.7rem", fontWeight: 800, color: "var(--text-muted)", letterSpacing: "0.05em", textTransform: "uppercase" }}>ACTIVE ORDERS</div>
            <div style={{ fontFamily: "Outfit, sans-serif", fontSize: "1.5rem", fontWeight: 900, color: "var(--info)" }}>{activeOrderCount} Live</div>
          </div>

          <div style={{ background: "var(--bg-surface-1)", border: "1px solid var(--border-medium)", padding: "0.75rem 1.25rem", borderRadius: "var(--radius-lg)", minWidth: "130px" }}>
            <div style={{ fontSize: "0.7rem", fontWeight: 800, color: "var(--text-muted)", letterSpacing: "0.05em", textTransform: "uppercase" }}>FLOOR TABLES</div>
            <div style={{ fontFamily: "Outfit, sans-serif", fontSize: "1.5rem", fontWeight: 900, color: occupiedTablesCount > 0 ? "var(--primary)" : "var(--success)" }}>
              {occupiedTablesCount} Busy
            </div>
          </div>
        </div>
      </div>

      {/* ── 3D Interactive Module Grid ── */}
      <div
        className="grid"
        style={{
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: "1.75rem",
        }}
      >
        {modules.map((m) => (
          <Link
            key={m.to}
            to={m.to}
            className="dashboard-action-card"
            style={{
              borderColor: m.primaryAction ? "rgba(244, 123, 56, 0.45)" : undefined,
              boxShadow: m.primaryAction ? "0 10px 24px -4px var(--primary-glow), var(--shadow-3d-sm)" : undefined,
            }}
          >
            {/* Top Row: Icon + Badge */}
            <div style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div
                className="card-action-icon-3d"
                style={{
                  background: m.gradient,
                  color: "#fff",
                  boxShadow: `0 6px 16px -2px ${m.glowColor}`,
                }}
              >
                {m.icon}
              </div>

              <span
                className="badge"
                style={{
                  background: m.primaryAction ? "var(--primary-subtle)" : "var(--bg-surface-1)",
                  color: m.primaryAction ? "var(--primary)" : "var(--text-secondary)",
                  border: m.primaryAction ? "1px solid rgba(244,123,56,0.3)" : "1px solid var(--border-medium)",
                  fontSize: "0.72rem",
                }}
              >
                {m.badge}
              </span>
            </div>

            {/* Content */}
            <div className="card-action-title">{m.title}</div>
            <div className="card-action-desc">{m.subtitle}</div>

            {/* Footer */}
            <div className="card-action-footer">
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 700 }}>Launch Module</span>
              <div className="card-action-arrow">
                <span>Open</span>
                <ArrowRightIcon size={14} />
              </div>
            </div>

            {/* Glowing Accent Baseline */}
            <div className="card-action-glow-line" style={{ background: m.accentBorder }} />
          </Link>
        ))}
      </div>

      {/* ── Subtitle Footnote ── */}
      <div style={{ marginTop: "3.5rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.8rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "1rem" }}>
        <span>Station Synchronized with Local Area Network</span>
        <span>•</span>
        <span>Database Mode: SQLite WAL Atomic</span>
        <span>•</span>
        <span>Instant WebSocket-Ready</span>
      </div>
    </AppLayout>
  );
}
