import { useEffect, useState } from "react";
import client from "../api/client";
import { AppLayout } from "../components/AppLayout";
import { StatCard } from "../components/StatCard";
import { Modal } from "../components/Modal";
import { ReportsIcon, AlertTriangleIcon, SparklesIcon } from "../components/Icons";

export default function ReportsPage() {
  const [daily, setDaily] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [top, setTop] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [showClearModal, setShowClearModal] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [clearing, setClearing] = useState(false);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      client.get("/reports/daily-sales"),
      client.get("/reports/summary"),
      client.get("/reports/top-items"),
    ])
      .then(([d, s, t]) => {
        setDaily(d.data);
        setSummary(s.data);
        setTop(t.data);
      })
      .catch((err) => {
        console.error("Failed to load reports", err);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleClearAll = async (type: "sales" | "nuclear") => {
    if (confirmText !== "RESET ALL DATA") return;
    setClearing(true);
    try {
      const endpoint =
        type === "sales" ? "/reports/clear-all" : "/reports/nuclear-reset";
      await client.post(endpoint);
      alert(
        type === "sales"
          ? "Sales data cleared."
          : "FULL SYSTEM WIPE SUCCESSFUL. All data removed."
      );
      setShowClearModal(false);
      setConfirmText("");
      loadData();
    } catch (err: any) {
      alert("Error: " + (err.response?.data?.detail || "Failed to clear data"));
    } finally {
      setClearing(false);
    }
  };

  // Find max quantity in top items to calculate relative visual progress bar
  const maxQty = top.reduce((max, item) => Math.max(max, item.quantity), 1);

  return (
    <AppLayout
      title="SALES &amp; FINANCIAL ANALYTICS"
      subtitle="Revenue metrics • Dish sales leaderboard • Data management"
      showBack
      actions={
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <button className="btn-secondary" onClick={loadData} style={{ fontSize: "0.825rem" }}>
            ↻ Refresh Data
          </button>
          <button
            className="btn-secondary"
            style={{
              borderColor: "var(--danger)",
              color: "#fca5a5",
              fontSize: "0.825rem",
              background: "rgba(239, 68, 68, 0.08)",
            }}
            onClick={() => setShowClearModal(true)}
          >
            🗑️ Clear Data
          </button>
        </div>
      }
    >
      {/* ── System Reset Danger Modal ── */}
      <Modal
        isOpen={showClearModal}
        onClose={() => {
          setShowClearModal(false);
          setConfirmText("");
        }}
        title="Database Maintenance &amp; Reset"
        danger
        maxWidth="560px"
        zIndex={3000}
        footer={
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", width: "100%" }}>
            <div className="row" style={{ gap: "0.75rem" }}>
              <button
                className="btn-primary flex-1"
                style={{
                  background: "var(--danger)",
                  height: "3.25rem",
                  fontWeight: 900,
                  fontSize: "0.95rem",
                }}
                disabled={confirmText !== "RESET ALL DATA" || clearing}
                onClick={() => handleClearAll("nuclear")}
              >
                NUCLEAR RESET (FACTORY WIPE)
              </button>
              <button
                className="btn-primary flex-1"
                style={{
                  background: "var(--amber-gold)",
                  color: "#000",
                  height: "3.25rem",
                  fontWeight: 900,
                  fontSize: "0.95rem",
                }}
                disabled={confirmText !== "RESET ALL DATA" || clearing}
                onClick={() => handleClearAll("sales")}
              >
                CLEAR SALES ONLY
              </button>
            </div>
            <button
              className="btn-secondary"
              style={{ width: "100%", height: "2.75rem" }}
              onClick={() => {
                setShowClearModal(false);
                setConfirmText("");
              }}
            >
              Cancel &amp; Keep Data
            </button>
          </div>
        }
      >
        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <div style={{ color: "var(--danger)", marginBottom: "0.75rem" }}>
            <AlertTriangleIcon size={48} />
          </div>
          <h3 style={{ color: "var(--danger)", fontSize: "1.3rem", fontWeight: 900, margin: 0 }}>
            IRREVERSIBLE SYSTEM WIPE
          </h3>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginTop: "0.35rem" }}>
            Select the destruction tier below. This action is atomic and cannot be undone.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem", marginBottom: "1.75rem" }}>
          <div
            style={{
              padding: "1rem",
              background: "var(--bg-surface-1)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-medium)",
              fontSize: "0.85rem",
            }}
          >
            <strong style={{ color: "var(--amber-gold)" }}>1. Clear Sales Only:</strong>
            <div style={{ color: "var(--text-muted)", marginTop: "0.2rem" }}>
              Wipes all customer invoices and transaction orders. Retains dishes, pricing, and category structures.
            </div>
          </div>

          <div
            style={{
              padding: "1rem",
              background: "rgba(239, 68, 68, 0.1)",
              borderRadius: "var(--radius-md)",
              border: "1px solid rgba(239, 68, 68, 0.4)",
              fontSize: "0.85rem",
            }}
          >
            <strong style={{ color: "var(--danger)" }}>2. Nuclear Factory Reset:</strong>
            <div style={{ color: "var(--text-muted)", marginTop: "0.2rem" }}>
              Complete wipe of everything (Dishes, Inventory, Floor Tables, Categories, and Invoices). User credentials preserved.
            </div>
          </div>
        </div>

        <div style={{ marginBottom: "1.5rem", textAlign: "center" }}>
          <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 800, color: "var(--text-muted)", marginBottom: "0.5rem" }}>
            TYPE "RESET ALL DATA" EXACTLY TO AUTHORIZE:
          </label>
          <input
            className="input-field"
            style={{
              textAlign: "center",
              fontSize: "1.1rem",
              fontWeight: 800,
              letterSpacing: "0.08em",
              borderColor: confirmText === "RESET ALL DATA" ? "var(--danger)" : undefined,
              boxShadow: confirmText === "RESET ALL DATA" ? "0 0 12px var(--danger-glow)" : undefined,
            }}
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="RESET ALL DATA"
          />
        </div>
      </Modal>

      {/* ── Revenue 3D Metrics Row ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "1.5rem",
          marginBottom: "2rem",
        }}
      >
        <StatCard
          label="Today's Total Sales"
          value={`₹${daily?.total_sales ?? 0}`}
          subValue={`Recorded for ${daily?.date || "today"}`}
          accentColor="success"
          badge="LIVE CASH & CARD"
          icon={<ReportsIcon size={20} />}
        />

        <StatCard
          label="7-Day Trailing Revenue"
          value={`₹${summary?.weekly_sales ?? 0}`}
          subValue="Rolling weekly revenue"
          accentColor="primary"
          badge="WEEKLY"
          icon={<ReportsIcon size={20} />}
        />

        <StatCard
          label="Month-to-Date Volume"
          value={`₹${summary?.monthly_sales ?? 0}`}
          subValue="Cumulative monthly gross"
          accentColor="indigo"
          badge="MONTHLY"
          icon={<ReportsIcon size={20} />}
        />
      </div>

      {/* ── Leaderboard: Top Selling Dishes ── */}
      <div className="card-3d" style={{ padding: 0, overflow: "hidden" }}>
        <div
          style={{
            padding: "1.5rem 1.75rem",
            borderBottom: "1px solid var(--border-subtle)",
            background: "var(--bg-surface-1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <div style={{ width: "34px", height: "34px", borderRadius: "8px", background: "var(--primary-subtle)", color: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <SparklesIcon size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.2rem" }}>Top Selling Dishes</h3>
              <p style={{ margin: "0.15rem 0 0 0", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                Ranked by customer orders and quantity volume
              </p>
            </div>
          </div>

          <span className="badge" style={{ background: "var(--bg-surface-3)" }}>
            Top 10 Dishes
          </span>
        </div>

        <div className="data-table-wrapper" style={{ border: "none", borderRadius: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: "80px" }}>Rank</th>
                <th>Dish Recipe Name</th>
                <th style={{ width: "40%" }}>Sales Volume Share</th>
                <th style={{ textAlign: "right" }}>Total Units Sold</th>
              </tr>
            </thead>
            <tbody>
              {top.map((item, idx) => {
                const percentage = Math.round((item.quantity / maxQty) * 100);
                const rankColor =
                  idx === 0
                    ? "#f59e0b"
                    : idx === 1
                    ? "#94a3b8"
                    : idx === 2
                    ? "#b45309"
                    : "var(--text-muted)";

                return (
                  <tr key={idx}>
                    <td>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: "30px",
                          height: "30px",
                          borderRadius: "50%",
                          background: "var(--bg-surface-3)",
                          color: rankColor,
                          fontWeight: 900,
                          fontSize: "0.9rem",
                          border: `1px solid ${idx < 3 ? rankColor : "var(--border-subtle)"}`,
                        }}
                      >
                        {idx + 1}
                      </span>
                    </td>
                    <td>
                      <strong style={{ fontSize: "1.05rem" }}>{item.name}</strong>
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <div
                          style={{
                            flex: 1,
                            height: "8px",
                            background: "var(--bg-surface-3)",
                            borderRadius: "var(--radius-full)",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${percentage}%`,
                              height: "100%",
                              background:
                                idx === 0
                                  ? "linear-gradient(90deg, #f59e0b, #f47b38)"
                                  : "linear-gradient(90deg, #3b82f6, #6366f1)",
                              borderRadius: "var(--radius-full)",
                            }}
                          />
                        </div>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", minWidth: "35px" }}>
                          {percentage}%
                        </span>
                      </div>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <span
                        style={{
                          fontFamily: "Outfit, sans-serif",
                          fontSize: "1.25rem",
                          fontWeight: 900,
                          color: "var(--text-primary)",
                        }}
                      >
                        {item.quantity}
                      </span>
                    </td>
                  </tr>
                );
              })}

              {top.length === 0 && !loading && (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", padding: "4rem 2rem", color: "var(--text-muted)" }}>
                    <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>📊</div>
                    <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>No sales transactions recorded yet</div>
                    <div style={{ fontSize: "0.8rem", marginTop: "0.25rem" }}>
                      Once orders are placed and settled at the counter, top dishes will rank here.
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
