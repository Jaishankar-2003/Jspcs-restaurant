import { useEffect, useState } from "react";
import client from "../api/client";
import { Link } from "react-router-dom";

interface Toast {
  id: number;
  type: "success" | "error";
  message: string;
}

export default function KitchenPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = (type: "success" | "error", message: string) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  };

  const load = () => {
    client
      .get("/kitchen/orders")
      .then((r) => setOrders(r.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, []);

  const update = async (id: number, status: string) => {
    try {
      await client.patch(`/kitchen/orders/${id}/status`, { status });
      if (status === "preparing") showToast("success", `🍳 Order #${id} — Now Preparing`);
      if (status === "ready") showToast("success", `✅ Order #${id} — Ready! Waiting for waiter`);
      if (status === "picked") showToast("success", `🏃 Order #${id} — Picked by waiter. Gone from queue!`);
      load();
    } catch (err: any) {
      showToast("error", "❌ Failed to update status: " + (err.response?.data?.detail || "Unknown error"));
    }
  };

  return (
    <div className="page">
      {/* ── Toast Container ── */}
      <div style={{ position: "fixed", top: "1.5rem", right: "1.5rem", zIndex: 9999, display: "flex", flexDirection: "column", gap: "0.75rem", pointerEvents: "none" }}>
        {toasts.map((t) => (
          <div
            key={t.id}
            style={{
              background: t.type === "success" ? "#10b981" : "#ef4444",
              color: "#fff",
              padding: "1rem 1.5rem",
              borderRadius: "0.75rem",
              fontWeight: 700,
              fontSize: "1rem",
              boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
              animation: "fadeIn 0.3s ease-out",
              minWidth: "280px",
              pointerEvents: "auto",
            }}
          >
            {t.message}
          </div>
        ))}
      </div>

      <div className="topbar">
        <div>
          <h1>KITCHEN DISPLAY</h1>
          <small style={{ color: "var(--success)" }}>● Live &amp; Connected</small>
        </div>
        <Link to="/dashboard" className="btn-secondary">Dashboard</Link>
      </div>

      {loading && orders.length === 0 ? (
        <div className="text-center" style={{ padding: "5rem" }}><h2>Connecting...</h2></div>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(400px, 1fr))", gap: "2rem" }}>
          {orders.map((o) => {
            const s = (o.status || "").toLowerCase().trim();
            const borderColor =
              s === "confirmed" ? "var(--primary)"
              : s === "preparing" ? "#2563eb"
              : "var(--success)";

            return (
              <div
                key={o.id}
                className="card"
                style={{ display: "flex", flexDirection: "column", minHeight: "550px", borderTop: `12px solid ${borderColor}` }}
              >
                {/* Header */}
                <div className="row" style={{ justifyContent: "space-between", marginBottom: "1.5rem" }}>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <div style={{ fontSize: "3.5rem", fontWeight: 900, lineHeight: 1 }}>#{o.id}</div>
                    <span style={{ fontSize: "1rem", color: "var(--text-muted)" }}>
                      {new Date(o.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "3rem" }}>🥘</div>
                    <span className={`badge badge-${s}`} style={{ fontSize: "1rem", padding: "0.5rem 1rem" }}>
                      {s === "confirmed" ? "NEW ORDER" : s.toUpperCase()}
                    </span>
                  </div>
                </div>

                {/* Table / Token */}
                <div style={{ background: "var(--accent)", padding: "1.5rem", borderRadius: "1rem", marginBottom: "1.5rem", border: "1px solid var(--border)" }}>
                  <div style={{ fontWeight: 900, fontSize: "2rem", color: "var(--primary)" }}>
                    {o.type === "dine_in" ? `🪑 TABLE ${o.table_id}` : `🥡 TAKEAWAY #${o.token_number}`}
                  </div>
                </div>

                {/* Waiter Note — Highlighted box */}
                {o.waiter_note ? (
                  <div
                    style={{
                      padding: "1.25rem",
                      marginBottom: "1.5rem",
                      background: "#fffbeb",
                      border: "3px solid #f59e0b",
                      borderRadius: "1rem",
                      display: "flex",
                      gap: "1rem",
                      alignItems: "center",
                      boxShadow: "0 4px 12px rgba(245,158,11,0.2)"
                    }}
                  >
                    <span style={{ fontSize: "2rem" }}>📝</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 900, fontSize: "0.9rem", color: "#b45309", textTransform: "uppercase", marginBottom: "0.2rem" }}>Waiter Instruction</div>
                      <div style={{ fontWeight: 800, fontSize: "1.4rem", color: "#1f2937", lineHeight: 1.2 }}>{o.waiter_note}</div>
                    </div>
                  </div>
                ) : null}

                {/* Items */}
                <div style={{ flex: 1, overflowY: "auto", marginBottom: "1.5rem" }}>
                  {o.items?.map((item: any) => {
                    const isCancelled = item.status === 'cancelled';
                    return (
                      <div 
                        key={item.id} 
                        className="row" 
                        style={{ 
                          justifyContent: "space-between", 
                          padding: "1.25rem 0", 
                          borderBottom: "1px solid var(--border)",
                          opacity: isCancelled ? 0.5 : 1,
                        }}
                      >
                        <span style={{ 
                          fontSize: "1.6rem", 
                          fontWeight: 800,
                          textDecoration: isCancelled ? 'line-through' : 'none',
                          color: isCancelled ? 'var(--danger)' : 'inherit'
                        }}>
                          <span style={{ color: isCancelled ? 'var(--danger)' : "var(--primary)", marginRight: "1.25rem" }}>
                            {item.quantity} x
                          </span>
                          {item.product?.name || "Dish"}
                        </span>
                        {isCancelled && (
                          <span 
                            className="badge badge-danger" 
                            style={{ 
                              fontSize: '1rem', 
                              padding: '0.4rem 0.8rem',
                              animation: 'pulse 1s infinite'
                            }}
                          >
                            CANCELLED
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Action Buttons */}
                <div className="row mt-4" style={{ gap: "1.5rem" }}>
                  {(s === "confirmed" || s === "pending") && (
                    <button
                      className="btn-primary flex-1"
                      style={{ background: "#2563eb", color: "white", height: "5.5rem", fontSize: "1.6rem", boxShadow: "0 4px 15px rgba(37,99,235,0.4)" }}
                      onClick={() => update(o.id, "preparing")}
                    >
                      👨‍🍳 PROCESS NOW
                    </button>
                  )}
                  {s === "preparing" && (
                    <button
                      className="btn-primary flex-1"
                      style={{ background: "var(--success)", color: "white", height: "5.5rem", fontSize: "1.6rem", boxShadow: "0 4px 15px rgba(16,185,129,0.4)" }}
                      onClick={() => update(o.id, "ready")}
                    >
                      ✅ MARK READY
                    </button>
                  )}
                  {s === "ready" && (
                    <button
                      className="btn-primary flex-1"
                      style={{
                        background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
                        color: "white",
                        height: "5.5rem",
                        fontSize: "1.4rem",
                        boxShadow: "0 4px 20px rgba(124,58,237,0.5)",
                        animation: "pulse 2s infinite",
                      }}
                      onClick={() => update(o.id, "picked")}
                    >
                      🏃 WAITER PICKED UP
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {orders.length === 0 && (
            <div className="card text-center" style={{ gridColumn: "1/-1", padding: "15rem", opacity: 0.1 }}>
              <div style={{ fontSize: "10rem" }}>✅</div>
              <h1>KITCHEN IS CLEAR</h1>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
