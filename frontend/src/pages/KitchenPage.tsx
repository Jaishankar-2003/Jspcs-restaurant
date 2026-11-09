import { useEffect, useState } from "react";
import client from "../api/client";
import { AppLayout } from "../components/AppLayout";
import { SparklesIcon, SnowflakeIcon } from "../components/Icons";
import { getTableMeta } from "../utils/tableStorage";

interface Toast {
  id: number;
  type: "success" | "error";
  message: string;
}

const extractGroupTag = (waiterNote?: string | null) => {
  if (!waiterNote) return null;
  const match = waiterNote.match(/\[([^\]]+)\]/);
  return match ? match[1] : null;
};

export default function KitchenPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [tablesList, setTablesList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const showToast = (type: "success" | "error", message: string) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  };

  const load = () => {
    client
      .get("/kitchen/orders")
      .then((r) => setOrders(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
    client
      .get("/tables")
      .then((r) => setTablesList(r.data))
      .catch(() => {});
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, []);

  const update = async (id: number, status: string) => {
    try {
      await client.patch(`/kitchen/orders/${id}/status`, { status });
      if (status === "preparing") showToast("success", `👨‍🍳 Order #${id} — Now in Preparation`);
      if (status === "ready") showToast("success", `✅ Order #${id} — Marked Ready! Notifying server`);
      if (status === "picked") showToast("success", `🏃 Order #${id} — Picked up by waiter`);
      load();
    } catch (err: any) {
      showToast("error", "❌ Failed to update status: " + (err.response?.data?.detail || "Unknown error"));
    }
  };

  const filteredOrders = orders.filter((o) => {
    const s = (o.status || "").toLowerCase().trim();
    if (statusFilter === "all") return true;
    if (statusFilter === "new") return s === "confirmed" || s === "pending";
    if (statusFilter === "preparing") return s === "preparing";
    if (statusFilter === "ready") return s === "ready";
    return true;
  });

  return (
    <AppLayout
      title="KITCHEN DISPLAY SYSTEM (KDS)"
      subtitle="Real-time culinary ticket stream • Live ticket routing"
      showBack
      actions={
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div className="header-status-pill">
            <span className="status-dot-pulse" />
            <span style={{ fontWeight: 800, color: "var(--success)" }}>Live KDS Feed</span>
          </div>
          <button className="btn-secondary" onClick={load} style={{ fontSize: "0.825rem" }}>
            ↻ Refresh
          </button>
        </div>
      }
    >
      {/* ── Toast Container ── */}
      <div className="toast-container">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast-card-3d ${t.type === "success" ? "toast-success" : "toast-error"}`}
          >
            <span>{t.type === "success" ? "✓" : "⚠️"}</span>
            <span>{t.message}</span>
          </div>
        ))}
      </div>

      {/* ── Filter Pills ── */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.75rem", flexWrap: "wrap" }}>
        {[
          { key: "all", label: `All Tickets (${orders.length})` },
          { key: "new", label: "New & Pending" },
          { key: "preparing", label: "In Preparation" },
          { key: "ready", label: "Ready for Pickup" },
        ].map((tab) => (
          <button
            key={tab.key}
            className={`category-tab-pill ${statusFilter === tab.key ? "active" : ""}`}
            onClick={() => setStatusFilter(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading && orders.length === 0 ? (
        <div style={{ textAlign: "center", padding: "6rem 2rem", color: "var(--text-muted)" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🍳</div>
          <h2>Synchronizing with Kitchen Pipeline...</h2>
        </div>
      ) : (
        <div
          className="grid"
          style={{
            gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))",
            gap: "1.75rem",
          }}
        >
          {filteredOrders.map((o) => {
            const s = (o.status || "").toLowerCase().trim();
            const accentColor =
              s === "confirmed" || s === "pending"
                ? "var(--amber-gold)"
                : s === "preparing"
                ? "var(--info)"
                : "var(--success)";

            return (
              <div
                key={o.id}
                className="kds-card-3d"
                style={{
                  borderTop: `6px solid ${accentColor}`,
                }}
              >
                {/* Ticket Header */}
                <div className="kds-ticket-header">
                  <div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: "0.6rem" }}>
                      <span className="kds-order-number">#{o.id}</span>
                      <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600 }}>
                        {new Date(o.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>

                    <div style={{ marginTop: "0.4rem" }}>
                      <span className={`badge badge-${s}`}>
                        {s === "confirmed" || s === "pending" ? "NEW TICKET" : s.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  {/* Dining Target Identifier */}
                  {(() => {
                    const resolveTableName = () => {
                      if (o.type !== "dine_in") return `🥡 TOKEN #${o.token_number}`;
                      if (o.table_name) return `🪑 ${o.table_name.toUpperCase()}`;
                      const matchTable = tablesList.find((tbl) => tbl.id === o.table_id);
                      if (matchTable) return `🪑 ${matchTable.name.toUpperCase()}`;
                      return `🪑 TABLE ${o.table_id}`;
                    };

                    const resolvedTableMeta = tablesList.find((tbl) => tbl.id === o.table_id) || { id: o.table_id };

                    return (
                      <div
                        style={{
                          background: "var(--bg-surface-3)",
                          border: "1px solid var(--border-bright)",
                          padding: "0.5rem 0.85rem",
                          borderRadius: "var(--radius-md)",
                          textAlign: "right",
                        }}
                      >
                        <div style={{ fontWeight: 900, fontSize: "1.15rem", color: "var(--primary)" }}>
                          {resolveTableName()}
                        </div>
                        {extractGroupTag(o.waiter_note) && (
                          <div style={{ fontSize: "0.78rem", fontWeight: 800, color: "var(--primary)", marginTop: "2px", letterSpacing: "0.02em" }}>
                            👥 {extractGroupTag(o.waiter_note)}
                          </div>
                        )}
                        <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase", display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "0.3rem", marginTop: "2px" }}>
                          <span>{o.type === "dine_in" ? "Dine-In" : "Takeaway"}</span>
                          {o.type === "dine_in" && o.table_id && getTableMeta(resolvedTableMeta).is_ac && (
                            <span className="badge badge-ac" style={{ fontSize: "0.625rem", padding: "0.1rem 0.35rem" }}>
                              <SnowflakeIcon size={10} /> AC
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Waiter Special Instruction Highlight */}
                {o.waiter_note && (
                  <div className="kds-waiter-instruction">
                    <span style={{ fontSize: "1.5rem" }}>📝</span>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: "0.75rem", color: "var(--amber-gold)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                        WAITER INSTRUCTION
                      </div>
                      <div style={{ fontWeight: 700, fontSize: "1.05rem", color: "var(--text-primary)", marginTop: "0.15rem" }}>
                        {o.waiter_note}
                      </div>
                    </div>
                  </div>
                )}

                {/* Items List */}
                <div style={{ flex: 1, overflowY: "auto", margin: "0.5rem 0 1.5rem 0", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  {o.items?.map((item: any) => {
                    const isCancelled = item.status === "cancelled";
                    return (
                      <div
                        key={item.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "0.75rem 0.5rem",
                          borderBottom: "1px solid var(--border-subtle)",
                          opacity: isCancelled ? 0.4 : 1,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
                          <span
                            style={{
                              fontFamily: "Outfit, sans-serif",
                              fontSize: "1.35rem",
                              fontWeight: 900,
                              color: isCancelled ? "var(--danger)" : "var(--primary)",
                              minWidth: "36px",
                            }}
                          >
                            {item.quantity}×
                          </span>
                          <span
                            style={{
                              fontSize: "1.1rem",
                              fontWeight: 800,
                              color: isCancelled ? "var(--text-muted)" : "var(--text-primary)",
                              textDecoration: isCancelled ? "line-through" : "none",
                            }}
                          >
                            {item.product?.name || "Kitchen Item"}
                          </span>
                        </div>

                        {isCancelled && (
                          <span className="badge badge-danger">
                            CANCELLED
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Large Tactile Workflow Action Buttons */}
                <div style={{ marginTop: "auto" }}>
                  {(s === "confirmed" || s === "pending") && (
                    <button
                      className="btn-primary"
                      style={{
                        width: "100%",
                        height: "4.5rem",
                        fontSize: "1.25rem",
                        fontWeight: 900,
                        background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                        boxShadow: "0 8px 24px -2px rgba(37,99,235,0.4)",
                      }}
                      onClick={() => update(o.id, "preparing")}
                    >
                      👨‍🍳 START PREPARING
                    </button>
                  )}

                  {s === "preparing" && (
                    <button
                      className="btn-primary"
                      style={{
                        width: "100%",
                        height: "4.5rem",
                        fontSize: "1.25rem",
                        fontWeight: 900,
                        background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                        boxShadow: "0 8px 24px -2px rgba(16,185,129,0.4)",
                      }}
                      onClick={() => update(o.id, "ready")}
                    >
                      ✅ MARK DISH READY
                    </button>
                  )}

                  {s === "ready" && (
                    <button
                      className="btn-primary"
                      style={{
                        width: "100%",
                        height: "4.5rem",
                        fontSize: "1.25rem",
                        fontWeight: 900,
                        background: "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)",
                        boxShadow: "0 8px 24px -2px rgba(139,92,246,0.5)",
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

          {filteredOrders.length === 0 && !loading && (
            <div
              className="card-3d"
              style={{
                gridColumn: "1/-1",
                padding: "8rem 2rem",
                textAlign: "center",
                color: "var(--text-muted)",
              }}
            >
              <div style={{ fontSize: "5rem", marginBottom: "1rem" }}>
                <SparklesIcon size={72} />
              </div>
              <h2 style={{ fontSize: "2rem", fontWeight: 900, color: "var(--text-primary)" }}>
                Kitchen Station is Clear
              </h2>
              <p style={{ marginTop: "0.5rem", fontSize: "1rem" }}>
                All pending tickets have been routed and prepared. Standby for incoming orders.
              </p>
            </div>
          )}
        </div>
      )}
    </AppLayout>
  );
}
