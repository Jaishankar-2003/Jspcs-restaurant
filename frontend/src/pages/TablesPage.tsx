import { useEffect, useState } from "react";
import client from "../api/client";
import { Link } from "react-router-dom";

interface Product {
  id: number;
  name: string;
  price: number;
}

interface Toast {
  id: number;
  type: "success" | "error";
  message: string;
}

export default function TablesPage() {
  const [tables, setTables] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [chairs, setChairs] = useState(4);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [selectedTable, setSelectedTable] = useState<any>(null);
  const [activeOrder, setActiveOrder] = useState<any>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<any[]>([]);

  // Custom dialog state (replaces window.confirm)
  const [dialog, setDialog] = useState<{ message: string; onConfirm: () => void } | null>(null);

  // Toast state (replaces window.alert)
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = (type: "success" | "error", message: string) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  };

  const openDialog = (message: string, onConfirm: () => void) => {
    setDialog({ message, onConfirm });
  };

  const load = async () => {
    try {
      const [tRes, oRes, pRes] = await Promise.all([
        client.get("/tables"),
        client.get("/orders"),
        client.get("/products"),
      ]);
      setTables(tRes.data);
      setOrders(oRes.data);
      setProducts(pRes.data);
    } catch (err) {
      console.error("Sync failed", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName) return;
    await client.post("/tables", { name: newName, chairs });
    setNewName("");
    setChairs(4);
    setShowAdd(false);
    load();
  };

  const openTable = async (table: any) => {
    setSelectedTable(table);
    setCart([]);
    if (table.active_order_id) {
      const order = orders.find((o) => o.id === table.active_order_id);
      setActiveOrder(order || null);
    } else {
      setActiveOrder(null);
    }
  };

  useEffect(() => {
    if (selectedTable && selectedTable.active_order_id) {
      const updatedOrder = orders.find((o) => o.id === selectedTable.active_order_id);
      if (updatedOrder) setActiveOrder(updatedOrder);
    }
  }, [orders, selectedTable]);

  const addToTableCart = (p: Product) => {
    setCart((prev) => {
      const exists = prev.find((i) => i.id === p.id);
      if (exists) return prev.map((i) => (i.id === p.id ? { ...i, quantity: i.quantity + 1 } : i));
      return [...prev, { ...p, quantity: 1 }];
    });
  };

  const doSendToKitchen = async () => {
    setDialog(null);
    setSubmitting(true);
    try {
      if (activeOrder) {
        await client.patch(`/orders/${activeOrder.id}/items`, {
          items: cart.map((i) => ({ product_id: i.id, quantity: i.quantity })),
        });
      } else {
        await client.post("/orders", {
          type: "dine_in",
          table_id: selectedTable.id,
          items: cart.map((i) => ({ product_id: i.id, quantity: i.quantity })),
        });
      }
      showToast("success", "✅ Order Sent to Kitchen!");
      setSelectedTable(null);
      setCart([]);
      load();
    } catch (err: any) {
      console.error("Order submission failed", err);
      showToast("error", "❌ " + (err.response?.data?.detail || "Could not send order"));
    } finally {
      setSubmitting(false);
    }
  };

  const doConfirmDelivery = async () => {
    setDialog(null);
    if (!activeOrder) return;
    try {
      await client.patch(`/orders/${activeOrder.id}/status`, null, {
        params: { status: "delivered" },
      });
      showToast("success", "🍽️ Delivery Confirmed! Order delivered to table.");
      setSelectedTable(null);
      load();
    } catch (err: any) {
      showToast("error", "❌ " + (err.response?.data?.detail || "Could not confirm delivery"));
    }
  };

  const confirmDelivery = () => {
    if (!activeOrder) return;
    openDialog("Confirm order delivered to this table?", doConfirmDelivery);
  };

  const handleConfirmOrder = () => {
    if (cart.length === 0) return;
    openDialog("Send this order to kitchen?", doSendToKitchen);
  };

  const doRequestBill = async () => {
    setDialog(null);
    if (!activeOrder) return;
    try {
      await client.patch(`/orders/${activeOrder.id}/status`, null, {
        params: { status: "bill_requested" },
      });
      showToast("success", "💰 Bill Request Sent to Counter!");
      setSelectedTable(null);
      load();
    } catch (err: any) {
      showToast("error", "❌ " + (err.response?.data?.detail || "Could not request bill"));
    }
  };

  const requestBill = () => {
    if (!activeOrder) return;
    openDialog("Send bill request to counter?", doRequestBill);
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

      {/* ── Custom Confirm Dialog ── */}
      {dialog && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)",
            zIndex: 9998, display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <div
            className="card"
            style={{
              maxWidth: "420px", width: "90%", padding: "2.5rem",
              textAlign: "center", border: "1px solid var(--primary)",
              boxShadow: "0 0 40px rgba(245,158,11,0.2)",
            }}
          >
            <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>⚠️</div>
            <h3 style={{ marginBottom: "1.5rem", fontSize: "1.2rem" }}>{dialog.message}</h3>
            <div className="row" style={{ justifyContent: "center", gap: "1rem" }}>
              <button
                className="btn-primary"
                style={{ minWidth: "120px" }}
                onClick={dialog.onConfirm}
              >
                YES, CONFIRM
              </button>
              <button
                className="btn-secondary"
                style={{ minWidth: "120px" }}
                onClick={() => setDialog(null)}
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="topbar">
        <h1>FLOOR LAYOUT</h1>
        <div className="row">
          <button className="btn-primary" onClick={() => setShowAdd(true)}>+ NEW TABLE</button>
          <Link to="/dashboard" className="btn-secondary">Dashboard</Link>
        </div>
      </div>

      {showAdd && (
        <div className="card mb-4" style={{ maxWidth: "500px" }}>
          <h3>Create New Table</h3>
          <form onSubmit={handleCreate}>
            <div className="row">
              <div className="form-group flex-1">
                <label>Table Name</label>
                <input className="input-field" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="T1" />
              </div>
              <div className="form-group" style={{ width: "100px" }}>
                <label>Chairs</label>
                <input type="number" className="input-field" value={chairs} onChange={(e) => setChairs(parseInt(e.target.value))} />
              </div>
            </div>
            <div className="row">
              <button type="submit" className="btn-primary flex-1">CREATE</button>
              <button type="button" className="btn-secondary" onClick={() => setShowAdd(false)}>CANCEL</button>
            </div>
          </form>
        </div>
      )}

      {selectedTable && (
        <div className="modal-overlay" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.95)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
          <div className="card" style={{ width: "100%", maxWidth: "1000px", height: "85vh", display: "flex", flexDirection: "column" }}>
            <div className="row mb-4" style={{ justifyContent: "space-between" }}>
              <div>
                <h2>Table: {selectedTable.name}</h2>
                {activeOrder && (
                  <div className="row" style={{ marginTop: "0.5rem" }}>
                    <span className={`badge badge-${activeOrder.status}`}>STATUS: {activeOrder.status.replace("_", " ").toUpperCase()}</span>
                    {activeOrder.status === "ready" && <span style={{ fontSize: "2rem", marginLeft: "1rem", animation: "bounce 1s infinite" }}>🔔</span>}
                  </div>
                )}
              </div>
              <button className="btn-secondary" onClick={() => setSelectedTable(null)}>CLOSE</button>
            </div>

            <div className="grid" style={{ gridTemplateColumns: "1fr 380px", flex: 1, overflow: "hidden", gap: "2rem" }}>
              <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
                <div className="mb-4">
                  <h4>Confirmed Items</h4>
                  <div className="card" style={{ background: "var(--bg)", minHeight: "120px", maxHeight: "250px", overflowY: "auto" }}>
                    {activeOrder?.items?.map((i: any) => (
                      <div key={i.id} className="row" style={{ justifyContent: "space-between", padding: "0.75rem", borderBottom: "1px solid var(--border)" }}>
                        <span style={{ fontWeight: 600 }}>{i.product?.name}</span>
                        <span style={{ fontWeight: 900 }}>x {i.quantity}</span>
                      </div>
                    ))}
                    {!activeOrder?.items && <p style={{ opacity: 0.3, textAlign: "center", padding: "2rem" }}>No items confirmed yet</p>}
                  </div>
                </div>
                <div style={{ flex: 1, overflowY: "auto" }}>
                  <h4>Available Menu</h4>
                  <div className="product-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))" }}>
                    {products.map((p) => (
                      <div key={p.id} className="product-card" style={{ padding: "1rem" }} onClick={() => addToTableCart(p)}>
                        <div style={{ fontSize: "0.9rem", fontWeight: 700 }}>{p.name}</div>
                        <div style={{ color: "var(--primary)", fontWeight: 900 }}>₹{p.price}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ background: "var(--accent)", padding: "2rem", borderRadius: "1.5rem", display: "flex", flexDirection: "column", border: "1px solid var(--border)" }}>
                <h3 style={{ color: "var(--primary)", marginBottom: "1.5rem" }}>Add to Order</h3>
                <div style={{ flex: 1, overflowY: "auto" }}>
                  {cart.map((i) => (
                    <div key={i.id} className="row" style={{ justifyContent: "space-between", padding: "0.8rem 0", borderBottom: "1px solid var(--border)" }}>
                      <span>{i.name} x {i.quantity}</span>
                      <button onClick={() => setCart(cart.filter((item) => item.id !== i.id))} style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", fontSize: "1.2rem" }}>✖</button>
                    </div>
                  ))}
                  {cart.length === 0 && <p style={{ opacity: 0.3, textAlign: "center", padding: "2rem" }}>Cart is empty</p>}
                </div>
                <div className="mt-4" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  <button
                    className="btn-primary"
                    style={{ height: "4.5rem", fontSize: "1.2rem" }}
                    onClick={handleConfirmOrder}
                    disabled={submitting || cart.length === 0}
                  >
                    {submitting ? "SENDING..." : "📢 SEND TO KITCHEN"}
                  </button>

                  {/* CONFIRM DELIVERY — shown when waiter has picked the order */}
                  {activeOrder && activeOrder.status === "picked" && (
                    <button
                      className="btn-primary"
                      style={{
                        height: "5rem",
                        fontSize: "1.1rem",
                        background: "linear-gradient(135deg, #10b981, #059669)",
                        color: "white",
                        boxShadow: "0 4px 20px rgba(16,185,129,0.5)",
                        animation: "pulse 1.5s infinite",
                        border: "2px solid var(--success)",
                      }}
                      onClick={confirmDelivery}
                    >
                      🍽️ CONFIRM DELIVERY
                    </button>
                  )}

                  {/* REQUEST BILL — shown when order is delivered or ready */}
                  {activeOrder && (activeOrder.status === "delivered" || activeOrder.status === "bill_requested") && (
                    <button
                      className="btn-primary"
                      style={{
                        height: "4rem",
                        background: activeOrder.status === "bill_requested" ? "var(--success)" : "var(--accent)",
                        color: activeOrder.status === "bill_requested" ? "black" : "white",
                      }}
                      onClick={requestBill}
                    >
                      💰 REQUEST BILL
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center" style={{ padding: "10rem" }}><h2>Syncing Floor...</h2></div>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "2.5rem" }}>
          {tables.map((t) => {
            const tableOrder = orders.find((o) => o.id === t.active_order_id);
            const orderStatus = tableOrder?.status?.toLowerCase().trim();
            return (
              <div
                key={t.id}
                className="card text-center"
                onClick={() => openTable(t)}
                style={{
                  cursor: "pointer",
                  borderTop: `10px solid ${t.status === "free" ? "var(--success)" : orderStatus === "ready" ? "var(--primary)" : "var(--danger)"}`,
                  transform: t.status !== "free" ? "scale(1.05)" : "scale(1)",
                  transition: "0.3s",
                }}
              >
                <h2 style={{ fontSize: "3rem", margin: "0.75rem 0" }}>{t.name}</h2>
                <div style={{ color: "var(--text-muted)", marginBottom: "1.5rem", fontWeight: 700 }}>🪑 {t.chairs} Seats</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", alignItems: "center" }}>
                  <span className={`badge badge-${t.status}`}>{t.status.toUpperCase()}</span>
                  {tableOrder && (
                    <div className="mt-2" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span className={`badge badge-${orderStatus}`} style={{ fontSize: "0.9rem", padding: "0.5rem 1rem" }}>
                        {orderStatus === "ready" ? "✅ READY" : orderStatus.toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
