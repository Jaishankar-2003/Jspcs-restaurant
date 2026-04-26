import { useEffect, useState } from "react";
import client from "../api/client";
import { Link } from "react-router-dom";

interface Toast {
  id: number;
  type: "success" | "error";
  message: string;
}

export default function ActiveOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dialog, setDialog] = useState<{ message: string; onConfirm: () => void } | null>(null);
  // Settle payment dialog
  const [settleDialog, setSettleDialog] = useState<{ orderId: number } | null>(null);
  const [paymentType, setPaymentType] = useState<"cash" | "card">("cash");
  const [settling, setSettling] = useState(false);

  const showToast = (type: "success" | "error", message: string) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  };

  const load = () => {
    client
      .get("/orders")
      .then((r) =>
        setOrders(
          r.data.filter(
            (o: any) => o.status !== "completed" && o.status !== "cancelled"
          )
        )
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  const doSettle = async () => {
    if (!settleDialog) return;
    setSettling(true);
    try {
      await client.post("/billing/complete", {
        order_id: settleDialog.orderId,
        payment_type: paymentType,
      });
      showToast("success", `✅ Order #${settleDialog.orderId} settled via ${paymentType.toUpperCase()}!`);
      setSettleDialog(null);
      load();
    } catch (err: any) {
      showToast("error", "❌ Settlement failed: " + (err.response?.data?.detail || "Unknown error"));
    } finally {
      setSettling(false);
    }
  };

  const doCancelOrder = async (orderId: number) => {
    setDialog(null);
    try {
      await client.patch(`/orders/${orderId}/status`, null, {
        params: { status: "cancelled" },
      });
      showToast("success", `🚫 Order #${orderId} cancelled.`);
      load();
    } catch (err: any) {
      showToast("error", "❌ Cancel failed: " + (err.response?.data?.detail || "Unknown error"));
    }
  };

  const cancelOrder = (orderId: number) => {
    setDialog({
      message: `Cancel Order #${orderId}? This cannot be undone.`,
      onConfirm: () => doCancelOrder(orderId),
    });
  };

  const settle = (orderId: number) => {
    setSettleDialog({ orderId });
    setPaymentType("cash");
  };

  const statusLabel = (status: string) => {
    const map: Record<string, string> = {
      pending: "PENDING",
      confirmed: "CONFIRMED",
      preparing: "PREPARING",
      ready: "READY",
      picked: "🏃 EN ROUTE",
      delivered: "🍽️ DELIVERED",
      bill_requested: "🔔 BILL REQUESTED",
    };
    return map[status] || status.replace("_", " ").toUpperCase();
  };

  // Orders that can be settled: delivered, ready, or bill_requested
  const canSettle = (status: string) =>
    ["ready", "delivered", "bill_requested"].includes(status);

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

      {/* ── Custom Confirm Dialog ── */}
      {dialog && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 9998, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="card" style={{ maxWidth: "420px", width: "90%", padding: "2.5rem", textAlign: "center", border: "1px solid var(--danger)", boxShadow: "0 0 40px rgba(239,68,68,0.2)" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>⚠️</div>
            <h3 style={{ marginBottom: "1.5rem", fontSize: "1.2rem" }}>{dialog.message}</h3>
            <div className="row" style={{ justifyContent: "center", gap: "1rem" }}>
              <button className="btn-primary" style={{ minWidth: "120px", background: "var(--danger)" }} onClick={dialog.onConfirm}>YES, CANCEL</button>
              <button className="btn-secondary" style={{ minWidth: "120px" }} onClick={() => setDialog(null)}>KEEP ORDER</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Settle Bill Dialog ── */}
      {settleDialog && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 9998, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="card" style={{ maxWidth: "460px", width: "90%", padding: "2.5rem", border: "1px solid var(--primary)", boxShadow: "0 0 40px rgba(245,158,11,0.2)" }}>
            <h2 style={{ marginBottom: "0.5rem" }}>💰 Settle Bill</h2>
            <p style={{ color: "var(--text-muted)", marginBottom: "1.5rem" }}>Order #{settleDialog.orderId}</p>

            <div style={{ display: "flex", gap: "1rem", marginBottom: "2rem" }}>
              <button
                style={{
                  flex: 1, padding: "1.5rem", borderRadius: "0.75rem", border: `2px solid ${paymentType === "cash" ? "var(--primary)" : "var(--border)"}`,
                  background: paymentType === "cash" ? "#f59e0b22" : "var(--accent)", color: "white", fontWeight: 700, fontSize: "1.1rem", cursor: "pointer",
                }}
                onClick={() => setPaymentType("cash")}
              >
                💵 CASH
              </button>
              <button
                style={{
                  flex: 1, padding: "1.5rem", borderRadius: "0.75rem", border: `2px solid ${paymentType === "card" ? "var(--primary)" : "var(--border)"}`,
                  background: paymentType === "card" ? "#f59e0b22" : "var(--accent)", color: "white", fontWeight: 700, fontSize: "1.1rem", cursor: "pointer",
                }}
                onClick={() => setPaymentType("card")}
              >
                💳 CARD
              </button>
            </div>

            <div className="row" style={{ gap: "1rem" }}>
              <button className="btn-primary flex-1" style={{ height: "3.5rem", fontSize: "1rem" }} onClick={doSettle} disabled={settling}>
                {settling ? "SETTLING..." : "✅ CONFIRM PAYMENT"}
              </button>
              <button className="btn-secondary" style={{ height: "3.5rem" }} onClick={() => setSettleDialog(null)}>CANCEL</button>
            </div>
          </div>
        </div>
      )}

      <div className="topbar">
        <h1>ACTIVE ORDERS &amp; SETTLEMENT</h1>
        <Link to="/dashboard" className="btn-secondary">Back</Link>
      </div>

      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Type</th>
              <th>Table / Token</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => {
              const total =
                o.items?.filter((i: any) => i.status !== 'cancelled')
                .reduce(
                  (acc: number, i: any) => acc + parseFloat(i.price) * i.quantity,
                  0
                ) || 0;
              const isExpanded = expandedOrder === o.id;
              const s = o.status;
              const rowHighlight =
                s === "bill_requested" ? { background: "#f59e0b22", borderLeft: "4px solid var(--primary)" }
                : s === "picked" ? { background: "#7c3aed11", borderLeft: "4px solid #7c3aed" }
                : s === "delivered" ? { background: "#10b98111", borderLeft: "4px solid var(--success)" }
                : { cursor: "pointer" };

              return (
                <>
                  <tr
                    key={o.id}
                    style={{ ...rowHighlight, cursor: "pointer" }}
                    onClick={() => setExpandedOrder(isExpanded ? null : o.id)}
                  >
                    <td><strong>#{o.id}</strong></td>
                    <td><span className="badge badge-pending">{o.type.toUpperCase()}</span></td>
                    <td>
                      {o.type === "dine_in" ? (
                        <strong>🪑 Table {o.table_id}</strong>
                      ) : (
                        <span>🥡 Token #{o.token_number}</span>
                      )}
                    </td>
                    <td style={{ fontWeight: 800 }}>₹{total.toFixed(2)}</td>
                    <td>
                      <span className={`badge badge-${s}`}>{statusLabel(s)}</span>
                    </td>
                    <td>
                      <div className="row" style={{ gap: "0.5rem" }} onClick={(e) => e.stopPropagation()}>
                        {canSettle(s) && (
                          <button className="btn-primary" style={{ padding: "0.5rem 1rem" }} onClick={() => settle(o.id)}>
                            SETTLE BILL
                          </button>
                        )}
                        <button
                          className="btn-secondary"
                          style={{ padding: "0.5rem 1rem", borderColor: "var(--danger)", color: "var(--danger)" }}
                          onClick={() => cancelOrder(o.id)}
                        >
                          CANCEL
                        </button>
                      </div>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr style={{ background: "var(--bg)" }}>
                      <td colSpan={6} style={{ padding: "1.5rem" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                          <h4 style={{ margin: 0, color: "var(--primary)" }}>Order Items</h4>
                          {o.items?.map((item: any) => (
                            <div key={item.id} className="row" style={{ justifyContent: "space-between", borderBottom: "1px solid var(--border)", padding: "0.5rem 0" }}>
                              <span>{item.quantity} x {item.product?.name}</span>
                              <span>₹{(item.price * item.quantity).toFixed(2)}</span>
                            </div>
                          ))}
                          <div className="row" style={{ justifyContent: "flex-end", marginTop: "0.75rem", fontWeight: 800, fontSize: "1.1rem" }}>
                            <span>Total: ₹{total.toFixed(2)}</span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
        {orders.length === 0 && !loading && (
          <div className="text-center" style={{ padding: "5rem", opacity: 0.5 }}>
            <h2>No active orders</h2>
          </div>
        )}
      </div>
    </div>
  );
}
