import { useEffect, useState } from "react";
import client from "../api/client";
import { AppLayout } from "../components/AppLayout";
import { Modal } from "../components/Modal";
import { CheckIcon, AlertTriangleIcon, SnowflakeIcon } from "../components/Icons";
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

export default function ActiveOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [tablesList, setTablesList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dialog, setDialog] = useState<{ message: string; onConfirm: () => void } | null>(null);
  
  // Settle payment dialog
  const [settleDialog, setSettleDialog] = useState<{ orderId: number; amount?: number } | null>(null);
  const [settleAcFee, setSettleAcFee] = useState<number>(0);
  const [paymentType, setPaymentType] = useState<"cash" | "card">("cash");
  const [settling, setSettling] = useState(false);
  const [filterType, setFilterType] = useState<string>("all");

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
      .catch(() => {})
      .finally(() => setLoading(false));
    client
      .get("/tables")
      .then((r) => setTablesList(r.data))
      .catch(() => {});
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
      message: `Cancel Order #${orderId}? This cannot be undone and reserved stock will be restored.`,
      onConfirm: () => doCancelOrder(orderId),
    });
  };

  const settle = (orderId: number, amount?: number) => {
    const order = orders.find((o) => o.id === orderId);
    let defaultAc = 0;
    if (order?.table_id) {
      const meta = getTableMeta({ id: order.table_id });
      if (meta.is_ac) {
        defaultAc = meta.ac_charge ?? 50;
      }
    }
    setSettleAcFee(defaultAc);
    setSettleDialog({ orderId, amount });
    setPaymentType("cash");
  };

  const statusLabel = (status: string) => {
    const map: Record<string, string> = {
      pending: "PENDING",
      confirmed: "CONFIRMED",
      preparing: "PREPARING",
      ready: "READY",
      picked: "EN ROUTE",
      delivered: "DELIVERED",
      bill_requested: "BILL REQUESTED",
    };
    return map[status] || status.replace("_", " ").toUpperCase();
  };

  const canSettle = (status: string) =>
    ["ready", "delivered", "bill_requested"].includes(status);

  const filteredOrders = orders.filter((o) => {
    if (filterType === "all") return true;
    if (filterType === "dine_in") return o.type === "dine_in";
    if (filterType === "takeaway") return o.type === "takeaway";
    if (filterType === "bill_requested") return o.status === "bill_requested";
    if (filterType === "ready") return o.status === "ready";
    return true;
  });

  return (
    <AppLayout
      title="ACTIVE ORDERS &amp; SETTLEMENT"
      subtitle="Live kitchen status dispatch &amp; table payment desk"
      showBack
      actions={
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button className="btn-secondary" onClick={load} style={{ fontSize: "0.825rem" }}>
            ↻ Refresh Queue
          </button>
        </div>
      }
    >
      {/* ── Toast Notifications Container ── */}
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

      {/* ── Confirm Cancel Modal ── */}
      <Modal
        isOpen={!!dialog}
        onClose={() => setDialog(null)}
        title="Cancel Order Confirmation"
        danger
        maxWidth="460px"
        zIndex={3000}
        footer={
          <div className="row" style={{ width: "100%", justifyContent: "flex-end" }}>
            <button className="btn-secondary" onClick={() => setDialog(null)}>
              Keep Order
            </button>
            <button className="btn-primary" style={{ background: "var(--danger)" }} onClick={dialog?.onConfirm}>
              Yes, Cancel Order
            </button>
          </div>
        }
      >
        <div style={{ textAlign: "center", padding: "1rem 0" }}>
          <div style={{ color: "var(--danger)", marginBottom: "1rem" }}>
            <AlertTriangleIcon size={44} />
          </div>
          <p style={{ fontSize: "1.05rem", fontWeight: 700, margin: 0 }}>
            {dialog?.message}
          </p>
        </div>
      </Modal>

      {/* ── Settle Bill Modal ── */}
      <Modal
        isOpen={!!settleDialog}
        onClose={() => setSettleDialog(null)}
        title={<span>💰 Settle Bill &amp; Print</span>}
        subtitle={`Order #${settleDialog?.orderId}`}
        maxWidth="480px"
        zIndex={1500}
        footer={
          <div className="row" style={{ width: "100%", gap: "0.75rem" }}>
            <button className="btn-secondary flex-1" onClick={() => setSettleDialog(null)}>
              Cancel
            </button>
            <button
              className="btn-primary flex-1"
              style={{ background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", boxShadow: "0 8px 24px -2px var(--success-glow)" }}
              onClick={doSettle}
              disabled={settling}
            >
              {settling
                ? "Settling..."
                : `Confirm ${paymentType.toUpperCase()} Payment (₹${(
                    (settleDialog?.amount || 0) + (Number(settleAcFee) || 0)
                  ).toFixed(2)})`}
            </button>
          </div>
        }
      >
        <div style={{ padding: "0.5rem 0" }}>
          {/* AC Surcharge breakdown if table is in AC Section */}
          {(() => {
            const order = orders.find((o) => o.id === settleDialog?.orderId);
            const isAcTable = order?.table_id && getTableMeta({ id: order.table_id }).is_ac;
            if (!isAcTable && settleAcFee === 0) return null;

            return (
              <div
                style={{
                  padding: "0.75rem 1rem",
                  background: "#f0f9ff",
                  border: "1px solid #bae6fd",
                  borderRadius: "var(--radius-md)",
                  marginBottom: "1.25rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.45rem",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "#0369a1", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                    <SnowflakeIcon size={15} />
                    <span>AC Section Surcharge</span>
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                    <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--text-muted)" }}>₹</span>
                    <input
                      type="number"
                      min="0"
                      step="5"
                      style={{
                        width: "75px",
                        height: "28px",
                        padding: "0.2rem 0.4rem",
                        borderRadius: "4px",
                        border: "1px solid #7dd3fc",
                        fontWeight: 900,
                        textAlign: "right",
                        fontSize: "0.95rem",
                        color: "#0369a1",
                        background: "#fff",
                      }}
                      value={settleAcFee}
                      onChange={(e) => setSettleAcFee(Math.max(0, parseInt(e.target.value) || 0))}
                    />
                  </div>
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  Default ₹50. Cashier can customize or set to 0 to waive.
                </div>
              </div>
            );
          })()}

          <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-muted)", marginBottom: "0.75rem", textTransform: "uppercase" }}>
            Select Payment Method
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
            <button
              type="button"
              style={{
                padding: "1.5rem 1rem",
                borderRadius: "var(--radius-lg)",
                border: `2px solid ${paymentType === "cash" ? "var(--primary)" : "var(--border-medium)"}`,
                background: paymentType === "cash" ? "var(--primary-subtle)" : "var(--bg-surface-3)",
                color: "var(--text-primary)",
                fontWeight: 800,
                fontSize: "1.1rem",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "0.5rem",
                transition: "all 0.2s ease",
              }}
              onClick={() => setPaymentType("cash")}
            >
              <span style={{ fontSize: "2rem" }}>💵</span>
              <span>CASH</span>
            </button>

            <button
              type="button"
              style={{
                padding: "1.5rem 1rem",
                borderRadius: "var(--radius-lg)",
                border: `2px solid ${paymentType === "card" ? "var(--primary)" : "var(--border-medium)"}`,
                background: paymentType === "card" ? "var(--primary-subtle)" : "var(--bg-surface-3)",
                color: "var(--text-primary)",
                fontWeight: 800,
                fontSize: "1.1rem",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "0.5rem",
                transition: "all 0.2s ease",
              }}
              onClick={() => setPaymentType("card")}
            >
              <span style={{ fontSize: "2rem" }}>💳</span>
              <span>CARD / UPI</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Status Filter Pills ── */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        {[
          { key: "all", label: `All Orders (${orders.length})` },
          { key: "dine_in", label: "Dine-In" },
          { key: "takeaway", label: "Takeaway" },
          { key: "ready", label: "Ready for Pickup" },
          { key: "bill_requested", label: "Bill Requested" },
        ].map((tab) => (
          <button
            key={tab.key}
            className={`category-tab-pill ${filterType === tab.key ? "active" : ""}`}
            onClick={() => setFilterType(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Orders Data Table ── */}
      <div className="data-table-wrapper" style={{ boxShadow: "var(--shadow-3d-md)" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Service Type</th>
              <th>Table / Token</th>
              <th>Amount</th>
              <th>Kitchen Status</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.map((o) => {
              const total =
                o.items
                  ?.filter((i: any) => i.status !== "cancelled")
                  .reduce((acc: number, i: any) => acc + parseFloat(i.price) * i.quantity, 0) || 0;
              const isExpanded = expandedOrder === o.id;
              const s = o.status;

              return (
                <>
                  <tr
                    key={o.id}
                    onClick={() => setExpandedOrder(isExpanded ? null : o.id)}
                    style={{
                      cursor: "pointer",
                      background:
                        s === "bill_requested"
                          ? "rgba(244, 123, 56, 0.08)"
                          : s === "ready"
                          ? "rgba(16, 185, 129, 0.05)"
                          : undefined,
                    }}
                  >
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span style={{ fontWeight: 900, color: "var(--primary)", fontSize: "1.05rem" }}>
                          #{o.id}
                        </span>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                          {isExpanded ? "▲" : "▼"}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="badge" style={{ background: "var(--bg-surface-3)" }}>
                        {o.type.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      {o.type === "dine_in" ? (
                        <div>
                          {(() => {
                            const matchTable = tablesList.find((tbl) => tbl.id === o.table_id);
                            const resolvedName = o.table_name || (matchTable ? matchTable.name : `Table ${o.table_id}`);
                            return <strong style={{ fontSize: "0.95rem" }}>🪑 {resolvedName}</strong>;
                          })()}
                          {extractGroupTag(o.waiter_note) && (
                            <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--primary)", marginTop: "2px" }}>
                              👥 {extractGroupTag(o.waiter_note)}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span style={{ fontWeight: 700 }}>🥡 Token #{o.token_number}</span>
                      )}
                    </td>
                    <td style={{ fontWeight: 900, fontSize: "1.1rem", color: "var(--text-primary)" }}>
                      ₹{total.toFixed(2)}
                    </td>
                    <td>
                      <span className={`badge badge-${s}`}>
                        {statusLabel(s)}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div
                        className="row"
                        style={{ justifyContent: "flex-end", gap: "0.5rem" }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {canSettle(s) && (
                          <button
                            className="btn-primary"
                            style={{
                              padding: "0.45rem 0.9rem",
                              fontSize: "0.8rem",
                              background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                            }}
                            onClick={() => settle(o.id, total)}
                          >
                            <CheckIcon size={14} />
                            <span>Settle Bill</span>
                          </button>
                        )}
                        <button
                          className="btn-secondary"
                          style={{
                            padding: "0.45rem 0.85rem",
                            fontSize: "0.8rem",
                            borderColor: "var(--danger)",
                            color: "#fca5a5",
                          }}
                          onClick={() => cancelOrder(o.id)}
                        >
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Expanded Order Items Row */}
                  {isExpanded && (
                    <tr key={`${o.id}-expanded`} style={{ background: "var(--bg-surface-1)" }}>
                      <td colSpan={6} style={{ padding: "1.5rem 2rem" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <h4 style={{ margin: 0, color: "var(--primary)", fontSize: "0.95rem" }}>
                              Ticket Items ({o.items?.length || 0})
                            </h4>
                            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                              Created at: {new Date(o.created_at).toLocaleTimeString()}
                            </span>
                          </div>

                          {/* Waiter Note if present */}
                          {o.waiter_note && (
                            <div style={{ padding: "0.75rem 1rem", background: "rgba(245, 158, 11, 0.12)", border: "1px dashed var(--primary)", borderRadius: "var(--radius-sm)", fontSize: "0.85rem" }}>
                              <strong style={{ color: "var(--primary)" }}>📝 Kitchen Special Instruction: </strong>
                              <span>{o.waiter_note}</span>
                            </div>
                          )}

                          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginTop: "0.25rem" }}>
                            {o.items?.map((item: any) => (
                              <div
                                key={item.id}
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  padding: "0.5rem 0",
                                  borderBottom: "1px solid var(--border-subtle)",
                                  opacity: item.status === "cancelled" ? 0.4 : 1,
                                  textDecoration: item.status === "cancelled" ? "line-through" : "none",
                                  fontSize: "0.9rem",
                                }}
                              >
                                <span>
                                  <strong style={{ color: "var(--primary)", marginRight: "0.75rem" }}>
                                    {item.quantity} ×
                                  </strong>
                                  {item.product?.name || "Dish Item"}
                                </span>
                                <span style={{ fontWeight: 700 }}>
                                  ₹{(item.price * item.quantity).toFixed(2)}
                                </span>
                              </div>
                            ))}
                          </div>

                          <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: "0.5rem", fontWeight: 900, fontSize: "1.1rem" }}>
                            <span>Total Payable: ₹{total.toFixed(2)}</span>
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

        {filteredOrders.length === 0 && !loading && (
          <div style={{ textAlign: "center", padding: "5rem 2rem", color: "var(--text-muted)" }}>
            <div style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>📋</div>
            <div style={{ fontSize: "1.2rem", fontWeight: 800 }}>No active orders in this view</div>
            <div style={{ fontSize: "0.85rem", marginTop: "0.25rem" }}>
              New orders submitted from POS or Table Floor will appear here automatically.
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
