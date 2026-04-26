import { useEffect, useState } from "react";
import client from "../api/client";
import { Link } from "react-router-dom";

interface Product {
  id: number;
  name: string;
  price: number;
  quantity: number;
  is_veg: boolean;
  category: string;
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

  // Menu search
  const [menuSearch, setMenuSearch] = useState("");

  // Waiter note
  const [waiterNote, setWaiterNote] = useState("");

  // Custom dialog state
  const [dialog, setDialog] = useState<{ message: string; onConfirm: () => void } | null>(null);

  // Toast state
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
    setMenuSearch("");
    setWaiterNote("");
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

  // Add item to cart
  const addToTableCart = (p: Product) => {
    if (p.quantity <= 0) {
      showToast("error", `❌ ${p.name} is out of stock`);
      return;
    }
    setCart((prev) => {
      const exists = prev.find((i) => i.id === p.id);
      if (exists) return prev.map((i) => (i.id === p.id ? { ...i, qty: i.qty + 1 } : i));
      return [...prev, { ...p, qty: 1 }];
    });
  };

  // Increase qty in cart
  const increaseQty = (id: number) => {
    setCart((prev) => prev.map((i) => (i.id === id ? { ...i, qty: i.qty + 1 } : i)));
  };

  // Decrease qty in cart — remove if hits 0
  const decreaseQty = (id: number) => {
    setCart((prev) => {
      const updated = prev.map((i) => (i.id === id ? { ...i, qty: i.qty - 1 } : i));
      return updated.filter((i) => i.qty > 0);
    });
  };

  // Remove item from cart
  const removeFromCart = (id: number) => {
    setCart((prev) => prev.filter((i) => i.id !== id));
  };

  const doSendToKitchen = async () => {
    setDialog(null);
    setSubmitting(true);
    try {
      if (activeOrder) {
        await client.patch(`/orders/${activeOrder.id}/items`, {
          items: cart.map((i) => ({ product_id: i.id, quantity: i.qty })),
          waiter_note: waiterNote.trim() || null,
        });
      } else {
        await client.post("/orders", {
          type: "dine_in",
          table_id: selectedTable.id,
          items: cart.map((i) => ({ product_id: i.id, quantity: i.qty })),
          waiter_note: waiterNote.trim() || null,
        });
      }
      showToast("success", "✅ Order Sent to Kitchen!");
      setSelectedTable(null);
      setCart([]);
      setWaiterNote("");
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

  // Filtered menu
  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(menuSearch.toLowerCase())
  );

  // Cart total
  const cartTotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0);

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
          <div className="card" style={{ maxWidth: "420px", width: "90%", padding: "2.5rem", textAlign: "center", border: "1px solid var(--primary)", boxShadow: "0 0 40px rgba(245,158,11,0.2)" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>⚠️</div>
            <h3 style={{ marginBottom: "1.5rem", fontSize: "1.2rem" }}>{dialog.message}</h3>
            <div className="row" style={{ justifyContent: "center", gap: "1rem" }}>
              <button className="btn-primary" style={{ minWidth: "120px" }} onClick={dialog.onConfirm}>YES, CONFIRM</button>
              <button className="btn-secondary" style={{ minWidth: "120px" }} onClick={() => setDialog(null)}>CANCEL</button>
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

      {/* ── TABLE ORDER MODAL ── */}
      {selectedTable && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.95)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
          <div className="card" style={{ width: "100%", maxWidth: "1100px", height: "88vh", display: "flex", flexDirection: "column" }}>

            {/* Header */}
            <div className="row mb-4" style={{ justifyContent: "space-between", flexShrink: 0 }}>
              <div>
                <h2>Table: {selectedTable.name}</h2>
                {activeOrder && (
                  <div className="row" style={{ marginTop: "0.5rem", gap: "0.5rem" }}>
                    <span className={`badge badge-${activeOrder.status}`}>
                      STATUS: {activeOrder.status.replace("_", " ").toUpperCase()}
                    </span>
                    {activeOrder.status === "ready" && <span style={{ fontSize: "2rem", animation: "bounce 1s infinite" }}>🔔</span>}
                  </div>
                )}
              </div>
              <button className="btn-secondary" onClick={() => setSelectedTable(null)}>CLOSE</button>
            </div>

            {/* Body — 3 columns */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 360px", flex: 1, overflow: "hidden", gap: "1.5rem" }}>

              {/* ── LEFT: Confirmed Items ── */}
              <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
                <h4 style={{ flexShrink: 0, marginBottom: "0.75rem" }}>✅ Confirmed Items</h4>
                <div
                  className="card"
                  style={{ background: "var(--bg)", flex: 1, overflowY: "auto", padding: "0.75rem" }}
                >
                  {activeOrder?.items?.length > 0 ? (
                    activeOrder.items.map((i: any) => (
                      <div
                        key={i.id}
                        className="row"
                        style={{ justifyContent: "space-between", padding: "0.75rem 0.5rem", borderBottom: "1px solid var(--border)" }}
                      >
                        <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>{i.product?.name}</span>
                        <span
                          style={{
                            fontWeight: 900,
                            background: "var(--accent)",
                            padding: "0.2rem 0.6rem",
                            borderRadius: "0.5rem",
                            fontSize: "0.9rem",
                          }}
                        >
                          × {i.quantity}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p style={{ opacity: 0.3, textAlign: "center", padding: "2rem" }}>No items confirmed yet</p>
                  )}
                  {/* Waiter note from active order */}
                  {activeOrder?.waiter_note && (
                    <div
                      style={{
                        marginTop: "1rem",
                        padding: "0.75rem",
                        background: "rgba(245,158,11,0.1)",
                        border: "1px dashed var(--primary)",
                        borderRadius: "0.5rem",
                        fontSize: "0.9rem",
                      }}
                    >
                      <span style={{ fontWeight: 700, color: "var(--primary)" }}>📝 Note: </span>
                      {activeOrder.waiter_note}
                    </div>
                  )}
                </div>
              </div>

              {/* ── MIDDLE: Available Menu ── */}
              <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
                {/* Search bar */}
                <div style={{ flexShrink: 0, marginBottom: "0.75rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <h4 style={{ margin: 0, whiteSpace: "nowrap" }}>🍽️ Menu</h4>
                  <input
                    className="input-field"
                    style={{ flex: 1, padding: "0.4rem 0.75rem", fontSize: "0.9rem", margin: 0 }}
                    placeholder="🔍 Search dish..."
                    value={menuSearch}
                    onChange={(e) => setMenuSearch(e.target.value)}
                  />
                </div>

                <div style={{ flex: 1, overflowY: "auto" }}>
                  <div
                    className="product-grid"
                    style={{ gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))" }}
                  >
                    {filteredProducts.map((p) => {
                      const outOfStock = p.quantity <= 0;
                      return (
                        <div
                          key={p.id}
                          className="product-card"
                          style={{
                            padding: "0.85rem",
                            opacity: outOfStock ? 0.45 : 1,
                            cursor: outOfStock ? "not-allowed" : "pointer",
                            borderTop: `3px solid ${p.is_veg ? "var(--success)" : "var(--danger)"}`,
                            position: "relative",
                          }}
                          onClick={() => addToTableCart(p)}
                        >
                          <div style={{ fontSize: "0.85rem", fontWeight: 700, marginBottom: "0.3rem", lineHeight: 1.2 }}>
                            {p.name}
                          </div>
                          <div style={{ color: "var(--primary)", fontWeight: 900, fontSize: "1rem" }}>₹{p.price}</div>
                          {/* Stock count badge */}
                          <div
                            style={{
                              marginTop: "0.4rem",
                              fontSize: "0.72rem",
                              fontWeight: 700,
                              padding: "0.15rem 0.4rem",
                              borderRadius: "0.35rem",
                              display: "inline-block",
                              background: outOfStock ? "rgba(239,68,68,0.15)" : "rgba(16,185,129,0.12)",
                              color: outOfStock ? "var(--danger)" : "var(--success)",
                              border: `1px solid ${outOfStock ? "var(--danger)" : "var(--success)"}`,
                            }}
                          >
                            {outOfStock ? "Out of Stock" : `Stock: ${p.quantity}`}
                          </div>
                        </div>
                      );
                    })}
                    {filteredProducts.length === 0 && (
                      <p style={{ gridColumn: "1/-1", textAlign: "center", opacity: 0.4, padding: "2rem" }}>
                        No dishes found
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* ── RIGHT: Cart (Add to Order) ── */}
              <div
                style={{
                  background: "var(--accent)",
                  padding: "1.5rem",
                  borderRadius: "1.25rem",
                  display: "flex",
                  flexDirection: "column",
                  border: "1px solid var(--border)",
                  overflow: "hidden",
                }}
              >
                <h3 style={{ color: "var(--primary)", marginBottom: "1rem", flexShrink: 0 }}>🛒 Add to Order</h3>

                {/* Cart items */}
                <div style={{ flex: 1, overflowY: "auto", marginBottom: "0.75rem" }}>
                  {cart.map((i) => (
                    <div
                      key={i.id}
                      style={{
                        padding: "0.65rem 0",
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      {/* Item name + remove */}
                      <div className="row" style={{ justifyContent: "space-between", marginBottom: "0.35rem" }}>
                        <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>{i.name}</span>
                        <button
                          onClick={() => removeFromCart(i.id)}
                          style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", fontSize: "1rem", lineHeight: 1 }}
                          title="Remove"
                        >✖</button>
                      </div>
                      {/* Qty controls + subtotal */}
                      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                          <button
                            onClick={() => decreaseQty(i.id)}
                            style={{
                              width: "26px", height: "26px", borderRadius: "50%",
                              border: "1.5px solid var(--border)", background: "var(--card-bg)",
                              cursor: "pointer", fontWeight: 900, fontSize: "1rem",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              color: "var(--text-dark)",
                            }}
                          >−</button>
                          <span style={{ fontWeight: 800, minWidth: "22px", textAlign: "center" }}>{i.qty}</span>
                          <button
                            onClick={() => increaseQty(i.id)}
                            style={{
                              width: "26px", height: "26px", borderRadius: "50%",
                              border: "1.5px solid var(--primary)", background: "var(--primary)",
                              cursor: "pointer", fontWeight: 900, fontSize: "1rem",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              color: "#000",
                            }}
                          >+</button>
                        </div>
                        <span style={{ fontWeight: 700, color: "var(--primary)", fontSize: "0.9rem" }}>
                          ₹{(i.price * i.qty).toFixed(0)}
                        </span>
                      </div>
                    </div>
                  ))}
                  {cart.length === 0 && (
                    <p style={{ opacity: 0.3, textAlign: "center", padding: "1.5rem" }}>Cart is empty</p>
                  )}
                </div>

                {/* Cart total */}
                {cart.length > 0 && (
                  <div
                    style={{
                      padding: "0.6rem 0.75rem",
                      background: "rgba(245,158,11,0.1)",
                      borderRadius: "0.6rem",
                      display: "flex",
                      justifyContent: "space-between",
                      fontWeight: 800,
                      marginBottom: "0.75rem",
                      border: "1px solid rgba(245,158,11,0.3)",
                    }}
                  >
                    <span>Total</span>
                    <span style={{ color: "var(--primary)" }}>₹{cartTotal.toFixed(0)}</span>
                  </div>
                )}

                {/* Waiter Note */}
                <div style={{ flexShrink: 0, marginBottom: "0.75rem" }}>
                  <textarea
                    className="input-field"
                    style={{
                      width: "100%",
                      resize: "none",
                      height: "64px",
                      fontSize: "0.85rem",
                      padding: "0.5rem 0.75rem",
                      margin: 0,
                      borderStyle: waiterNote ? "solid" : "dashed",
                      borderColor: waiterNote ? "var(--primary)" : "var(--border)",
                      background: waiterNote ? "rgba(245,158,11,0.06)" : undefined,
                    }}
                    placeholder="📝 Optional: Note for kitchen (e.g. less spicy, no onion...)"
                    value={waiterNote}
                    onChange={(e) => setWaiterNote(e.target.value)}
                  />
                </div>

                {/* Action Buttons */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", flexShrink: 0 }}>
                  <button
                    className="btn-primary"
                    style={{ height: "4rem", fontSize: "1.05rem" }}
                    onClick={handleConfirmOrder}
                    disabled={submitting || cart.length === 0}
                  >
                    {submitting ? "SENDING..." : "📢 SEND TO KITCHEN"}
                  </button>

                  {activeOrder && activeOrder.status === "picked" && (
                    <button
                      className="btn-primary"
                      style={{
                        height: "4rem",
                        fontSize: "1rem",
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

                  {activeOrder && (activeOrder.status === "delivered" || activeOrder.status === "bill_requested") && (
                    <button
                      className="btn-primary"
                      style={{
                        height: "3.5rem",
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
