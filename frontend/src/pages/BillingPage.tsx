import { useState, useEffect, useRef } from "react";
import client from "../api/client";
import { AppLayout } from "../components/AppLayout";
import {
  SearchIcon,
  TrashIcon,
  BellIcon,
  CheckIcon,
  PlusIcon,
  MinusIcon,
  CloseIcon,
  SnowflakeIcon,
} from "../components/Icons";
import { getTableMeta } from "../utils/tableStorage";

interface Product {
  id: number;
  name: string;
  price: number;
  category: string;
  total_stock: number;
  reserved_stock: number;
  is_veg?: boolean;
}

interface CartItem extends Product {
  quantity: number;
}

const extractGroupTag = (waiterNote?: string | null) => {
  if (!waiterNote) return null;
  const match = waiterNote.match(/\[([^\]]+)\]/);
  return match ? match[1] : null;
};

export default function BillingPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderType, setOrderType] = useState("takeaway");
  const [tableId] = useState<number | "">("");
  const [tablesList, setTablesList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [billRequests, setBillRequests] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  // AC Surcharge State (Default ₹50, Customizable)
  const [acChargeEnabled, setAcChargeEnabled] = useState(false);
  const [acChargeAmount, setAcChargeAmount] = useState<number>(50);
  const searchRef = useRef<HTMLInputElement>(null);

  const loadBillRequests = () => {
    client
      .get("/orders")
      .then((res) => {
        setBillRequests(res.data.filter((o: any) => o.status === "bill_requested"));
      })
      .catch(() => {});
  };

  const loadProducts = () => {
    client
      .get("/products")
      .then((res) => setProducts(res.data))
      .catch(() => {});
  };

  useEffect(() => {
    loadProducts();
    client
      .get("/tables")
      .then((res) => setTablesList(res.data))
      .catch(() => {});
    loadBillRequests();

    const t = setInterval(loadBillRequests, 5000);
    searchRef.current?.focus();

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "F1") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
      clearInterval(t);
    };
  }, []);

  const addToCart = (p: Product) => {
    const available = p.total_stock - p.reserved_stock;

    setCart((prev) => {
      const existing = prev.find((item) => item.id === p.id);
      const currentQty = existing ? existing.quantity : 0;

      if (currentQty >= available) {
        alert(`❌ Out of Stock! Only ${available} units of ${p.name} available.`);
        return prev;
      }

      if (existing) {
        return prev.map((item) =>
          item.id === p.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...p, quantity: 1 }];
    });
    setSearchTerm("");
    searchRef.current?.focus();
  };

  const updateCartQty = (id: number, delta: number) => {
    const product = products.find((p) => p.id === id);
    if (!product) return;
    const available = product.total_stock - product.reserved_stock;

    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.id !== id) return item;
          const nextQty = item.quantity + delta;
          if (nextQty > available) {
            alert(`❌ Cannot add more! Only ${available} units available.`);
            return item;
          }
          return { ...item, quantity: nextQty };
        })
        .filter((item) => item.quantity > 0);
    });
  };

  const removeFromCart = (id: number) => setCart((prev) => prev.filter((item) => item.id !== id));
  const dishesTotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const effectiveAcCharge = acChargeEnabled ? Number(acChargeAmount) || 0 : 0;
  const total = dishesTotal + effectiveAcCharge;

  const handleCheckout = async () => {
    if (cart.length === 0 && !selectedOrder) return;
    setLoading(true);
    try {
      if (selectedOrder) {
        // Complete existing order
        const groupTag = extractGroupTag(selectedOrder.waiter_note);
        const paymentType = confirm(`Confirm Payment of ₹${total.toFixed(2)} via Cash? (Click Cancel for Card)`) ? "cash" : "card";
        await client.post("/billing/complete", { order_id: selectedOrder.id, payment_type: paymentType });
        alert(`✅ Table #${selectedOrder.table_id}${groupTag ? ` (${groupTag})` : ""} Bill Settled for ₹${total.toFixed(2)} (${paymentType.toUpperCase()})${effectiveAcCharge > 0 ? ` [Includes ₹${effectiveAcCharge} AC Surcharge]` : ""}.`);
        setSelectedOrder(null);
        setCart([]);
        setAcChargeEnabled(false);
      } else {
        // Create new takeaway order and complete immediately (Counter POS flow)
        const orderRes = await client.post("/orders", {
          type: orderType,
          table_id: orderType === "dine_in" ? tableId : null,
          items: cart.map((item) => ({ product_id: item.id, quantity: item.quantity })),
        });
        const orderId = orderRes.data.id;

        // For counter billing, we assume it's paid and ready immediately
        await client.patch(`/orders/${orderId}/status`, null, { params: { status: "ready" } });
        await client.post("/billing/complete", { order_id: orderId, payment_type: "cash" });
        alert(`✅ Takeaway Order #${orderId} Completed! Total: ₹${total.toFixed(2)}`);
        setCart([]);
        setAcChargeEnabled(false);
      }
      loadProducts();
      loadBillRequests();
    } catch (err: any) {
      alert("Billing Failed: " + (err.response?.data?.detail || "Error"));
    } finally {
      setLoading(false);
    }
  };

  const loadOrderToPos = (order: any) => {
    setSelectedOrder(order);
    const cartItems = order.items.map((i: any) => ({
      id: i.product_id,
      name: i.product?.name || "Unknown",
      price: i.price,
      quantity: i.quantity,
      category: i.product?.category || "General",
      total_stock: 999,
      reserved_stock: 0,
      is_veg: i.product?.is_veg ?? true,
    }));
    setCart(cartItems);
    setOrderType("dine_in");

    // Auto-detect table AC status
    const table = tablesList.find((t) => t.id === order.table_id);
    const meta = getTableMeta(table || { id: order.table_id });
    if (meta.is_ac) {
      setAcChargeEnabled(true);
      setAcChargeAmount(meta.ac_charge ?? 50);
    } else {
      setAcChargeEnabled(false);
      setAcChargeAmount(0);
    }
  };

  // Extract categories for quick pill filtering
  const categories = Array.from(new Set(products.map((p) => p.category).filter(Boolean)));

  const filteredProducts = products.filter((p) => {
    const matchSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCategory = selectedCategory === "all" || p.category === selectedCategory;
    return matchSearch && matchCategory;
  });

  return (
    <AppLayout
      title="COUNTER POS &amp; BILLING"
      subtitle="High-velocity order cashier terminal • Press F1 anytime to focus dish search"
      showBack
    >
      <div className="billing-layout-3d">
        {/* ── Left Products / Catalog Area ── */}
        <div className="billing-main-panel">
          {/* Top Search & Filter Bar */}
          <div style={{ padding: "1.25rem", borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-surface-1)", display: "flex", gap: "1rem", alignItems: "center" }}>
            <div className="search-wrapper" style={{ flex: 1 }}>
              <div className="search-icon-inside">
                <SearchIcon size={18} />
              </div>
              <input
                ref={searchRef}
                className="search-input search-input-padded"
                placeholder="Scan barcode or type dish name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                disabled={!!selectedOrder}
              />
              <span className="kbd-shortcut">F1</span>
            </div>

            {selectedOrder && (
              <button
                className="btn-secondary"
                style={{ borderColor: "var(--danger)", color: "var(--danger)", whiteSpace: "nowrap" }}
                onClick={() => {
                  setSelectedOrder(null);
                  setCart([]);
                  setAcChargeEnabled(false);
                }}
              >
                ✕ Clear Table Order
              </button>
            )}
          </div>

          {/* Category Pills Strip */}
          {!selectedOrder && categories.length > 0 && (
            <div className="category-filter-strip">
              <button
                className={`category-tab-pill ${selectedCategory === "all" ? "active" : ""}`}
                onClick={() => setSelectedCategory("all")}
              >
                All Dishes ({products.length})
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  className={`category-tab-pill ${selectedCategory === cat ? "active" : ""}`}
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          {/* Product Grid */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "1.25rem",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
              gap: "1.1rem",
              background: "var(--bg-surface-2)",
              opacity: selectedOrder ? 0.45 : 1,
              pointerEvents: selectedOrder ? "none" : "auto",
              alignContent: "start",
            }}
          >
            {filteredProducts.map((p) => {
              const avail = p.total_stock - p.reserved_stock;
              const isSoldOut = avail <= 0;

              return (
                <div
                  key={p.id}
                  className={`pos-product-card-3d ${isSoldOut ? "sold-out" : ""}`}
                  onClick={() => !isSoldOut && addToCart(p)}
                >
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                      <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
                        {p.category || "General"}
                      </span>
                      <div className={`pos-diet-pip ${p.is_veg === false ? "non-veg" : "veg"}`} title={p.is_veg === false ? "Non-Veg" : "Veg"} />
                    </div>

                    <div style={{ fontWeight: 800, fontSize: "1rem", color: "var(--text-primary)", lineHeight: 1.3, marginBottom: "0.5rem" }}>
                      {p.name}
                    </div>
                  </div>

                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: "0.75rem" }}>
                      <div style={{ fontFamily: "Outfit, sans-serif", fontSize: "1.35rem", fontWeight: 900, color: "var(--primary)" }}>
                        ₹{p.price}
                      </div>

                      <span
                        className="badge"
                        style={{
                          fontSize: "0.7rem",
                          padding: "0.15rem 0.5rem",
                          background: isSoldOut ? "rgba(239,68,68,0.1)" : avail < 5 ? "#fffbeb" : "#ecfdf5",
                          color: isSoldOut ? "var(--danger)" : avail < 5 ? "var(--amber-gold)" : "var(--success)",
                          border: `1px solid ${isSoldOut ? "rgba(239,68,68,0.3)" : avail < 5 ? "rgba(245,158,11,0.3)" : "rgba(16,185,129,0.3)"}`,
                        }}
                      >
                        {isSoldOut ? "SOLD OUT" : `${avail} Left`}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredProducts.length === 0 && (
              <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "4rem 2rem", color: "var(--text-muted)" }}>
                <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>🍽️</div>
                <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>No matching dishes found</div>
                <div style={{ fontSize: "0.85rem", marginTop: "0.25rem" }}>Try a different keyword or category filter</div>
              </div>
            )}
          </div>
        </div>

        {/* ── Right Cart & Checkout Sidebar ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* Active Bill Requests Notification Box (Table settlements) */}
          {billRequests.length > 0 && (
            <div
              className="card-3d"
              style={{
                background: "linear-gradient(135deg, rgba(244, 123, 56, 0.12) 0%, rgba(255, 255, 255, 0.95) 100%)",
                border: "1px solid var(--primary)",
                boxShadow: "0 8px 24px -4px var(--primary-glow)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 800, color: "var(--primary)" }}>
                  <BellIcon size={18} />
                  <span>Dine-In Bill Requests</span>
                </div>
                <span className="badge badge-bill_requested">{billRequests.length} Waiting</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                {billRequests.map((br) => {
                  const table = tablesList.find((t) => t.id === br.table_id);
                  const meta = getTableMeta(table || { id: br.table_id });
                  const activeTotal =
                    br.items
                      ?.filter((i: any) => i.status !== "cancelled")
                      .reduce((acc: number, i: any) => acc + parseFloat(i.price) * i.quantity, 0) || 0;
                  const estimatedTotal = activeTotal + (meta.is_ac ? (meta.ac_charge ?? 50) : 0);
                  const groupTag = extractGroupTag(br.waiter_note);

                  return (
                    <div
                      key={br.id}
                      onClick={() => loadOrderToPos(br)}
                      style={{
                        padding: "0.85rem",
                        background: "var(--bg-surface-2)",
                        border: "1px solid rgba(244,123,56,0.3)",
                        borderRadius: "var(--radius-md)",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        transition: "transform 0.15s ease",
                      }}
                      onMouseOver={(e) => (e.currentTarget.style.transform = "translateX(4px)")}
                      onMouseOut={(e) => (e.currentTarget.style.transform = "translateX(0)")}
                    >
                      <div>
                        <div style={{ fontWeight: 800, fontSize: "0.95rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                          <span>🪑 {table?.name ? (table.name.startsWith("Table") ? table.name : `Table ${table.name}`) : `Table #${br.table_id}`}</span>
                          {meta.is_ac && (
                            <span className="badge badge-ac" style={{ fontSize: "0.68rem", padding: "0.15rem 0.4rem" }}>
                              <SnowflakeIcon size={11} /> AC (+₹{meta.ac_charge})
                            </span>
                          )}
                        </div>
                        {groupTag && (
                          <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--primary)", marginTop: "2px" }}>
                            👥 {groupTag}
                          </div>
                        )}
                        <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Order #{br.id} • {br.items?.length || 0} items</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontWeight: 900, color: "var(--primary)", fontSize: "1.1rem" }}>₹{estimatedTotal.toFixed(2)}</div>
                        <span style={{ fontSize: "0.75rem", color: "var(--success)", fontWeight: 700 }}>Click to Settle →</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Cart Panel */}
          <div className="card-3d" style={{ display: "flex", flexDirection: "column", flex: 1, padding: 0, overflow: "hidden" }}>
            {/* Cart Header */}
            <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-surface-1)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.15rem" }}>
                  {selectedOrder ? (
                    <div>
                      {(() => {
                        const selTable = tablesList.find((t) => t.id === selectedOrder.table_id);
                        const selTableName = selTable?.name ? (selTable.name.startsWith("Table") ? selTable.name : `Table ${selTable.name}`) : `Table #${selectedOrder.table_id}`;
                        return <span>{selTableName} Settlement</span>;
                      })()}
                      {extractGroupTag(selectedOrder.waiter_note) && (
                        <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--primary)", marginTop: "3px" }}>
                          👥 {extractGroupTag(selectedOrder.waiter_note)}
                        </div>
                      )}
                    </div>
                  ) : "Active Ticket"}
                </h3>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  {cart.length} unique items
                </span>
              </div>

              {!selectedOrder && cart.length > 0 && (
                <button
                  onClick={() => setCart([])}
                  style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: "0.75rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.3rem" }}
                >
                  <TrashIcon size={14} />
                  <span>Clear All</span>
                </button>
              )}
            </div>

            {/* Cart Items List */}
            <div className="cart-items-scroll">
              {cart.map((item) => (
                <div key={item.id} className="cart-item-row-3d">
                  <div style={{ flex: 1, paddingRight: "0.5rem" }}>
                    <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--text-primary)" }}>{item.name}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>₹{item.price} each</div>
                  </div>

                  {/* Quantity Stepper (if not settling fixed dine-in order) */}
                  {!selectedOrder ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <button className="qty-btn" onClick={() => updateCartQty(item.id, -1)} aria-label="Decrease">
                        <MinusIcon size={12} />
                      </button>
                      <span style={{ fontWeight: 800, fontSize: "0.95rem", minWidth: "22px", textAlign: "center" }}>
                        {item.quantity}
                      </span>
                      <button className="qty-btn" onClick={() => updateCartQty(item.id, 1)} aria-label="Increase">
                        <PlusIcon size={12} />
                      </button>
                    </div>
                  ) : (
                    <span className="badge" style={{ background: "var(--bg-surface-3)" }}>× {item.quantity}</span>
                  )}

                  <div style={{ minWidth: "75px", textAlign: "right", fontWeight: 800, fontSize: "1rem", color: "var(--text-primary)" }}>
                    ₹{(item.price * item.quantity).toFixed(2)}
                  </div>

                  {!selectedOrder && (
                    <button
                      onClick={() => removeFromCart(item.id)}
                      style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", padding: "0.2rem", display: "flex", alignItems: "center" }}
                      title="Remove item"
                    >
                      <CloseIcon size={16} />
                    </button>
                  )}
                </div>
              ))}

              {cart.length === 0 && (
                <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--text-muted)" }}>
                  <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>🛒</div>
                  <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>Cart is empty</div>
                  <div style={{ fontSize: "0.8rem", marginTop: "0.25rem" }}>Click any dish on the left or press F1 to search</div>
                </div>
              )}
            </div>

            {/* AC Surcharge Section (Default ₹50, Customizable) */}
            <div
              style={{
                padding: "0.85rem 1.25rem",
                background: acChargeEnabled ? "#f0f9ff" : "var(--bg-surface-2)",
                borderTop: "1px solid var(--border-subtle)",
                borderBottom: "1px solid var(--border-subtle)",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
                  <SnowflakeIcon size={16} style={{ color: acChargeEnabled ? "#0284c7" : "var(--text-muted)" }} />
                  <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--text-primary)" }}>
                    AC Section Surcharge
                  </span>
                  {acChargeEnabled && (
                    <span className="badge badge-ac" style={{ fontSize: "0.68rem", padding: "0.15rem 0.45rem" }}>
                      +₹{effectiveAcCharge} Applied
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (acChargeEnabled) {
                      setAcChargeEnabled(false);
                    } else {
                      setAcChargeEnabled(true);
                      if (!acChargeAmount) setAcChargeAmount(50);
                    }
                  }}
                  style={{
                    background: acChargeEnabled ? "rgba(239, 68, 68, 0.08)" : "var(--primary-subtle)",
                    color: acChargeEnabled ? "var(--danger)" : "var(--primary)",
                    border: `1px solid ${acChargeEnabled ? "rgba(239, 68, 68, 0.25)" : "rgba(244, 123, 56, 0.3)"}`,
                    borderRadius: "var(--radius-sm)",
                    padding: "0.25rem 0.6rem",
                    fontSize: "0.75rem",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  {acChargeEnabled ? "✕ Waive Fee" : "+ Add AC (₹50)"}
                </button>
              </div>

              {acChargeEnabled && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap", paddingTop: "0.25rem" }}>
                  <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                    Customize AC Fee Amount:
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <div style={{ position: "relative", width: "85px" }}>
                      <span style={{ position: "absolute", left: "0.5rem", top: "50%", transform: "translateY(-50%)", fontWeight: 800, color: "var(--text-muted)", fontSize: "0.85rem" }}>
                        ₹
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="5"
                        style={{
                          width: "100%",
                          height: "30px",
                          paddingLeft: "1.25rem",
                          paddingRight: "0.4rem",
                          borderRadius: "var(--radius-sm)",
                          border: "1.5px solid #7dd3fc",
                          background: "#ffffff",
                          color: "#0369a1",
                          fontWeight: 900,
                          fontSize: "0.95rem",
                          textAlign: "right",
                        }}
                        value={acChargeAmount}
                        onChange={(e) => setAcChargeAmount(Math.max(0, parseInt(e.target.value) || 0))}
                      />
                    </div>

                    <div style={{ display: "flex", gap: "0.25rem" }}>
                      {[30, 50, 75, 100].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setAcChargeAmount(amt)}
                          style={{
                            background: acChargeAmount === amt ? "#0284c7" : "#ffffff",
                            color: acChargeAmount === amt ? "#ffffff" : "#0284c7",
                            border: "1px solid #bae6fd",
                            borderRadius: "4px",
                            padding: "0.2rem 0.45rem",
                            fontSize: "0.725rem",
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          ₹{amt}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Total Section */}
            <div className="billing-total-bar">
              <div>
                <div className="billing-total-label">Total Payable</div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  Dishes: ₹{dishesTotal.toFixed(2)} {effectiveAcCharge > 0 ? `• AC Fee: +₹${effectiveAcCharge.toFixed(2)}` : ""}
                </div>
              </div>
              <div className="billing-total-amount">₹{total.toFixed(2)}</div>
            </div>

            {/* Service Type Selection & Checkout Button */}
            <div style={{ padding: "1.25rem 1.5rem", background: "var(--bg-surface-1)", borderTop: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", gap: "1rem" }}>
              {!selectedOrder && (
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <button
                    type="button"
                    className={`btn-secondary flex-1 ${orderType === "takeaway" ? "active-success" : ""}`}
                    onClick={() => setOrderType("takeaway")}
                    style={{ fontSize: "0.85rem", padding: "0.5rem" }}
                  >
                    Takeaway Counter
                  </button>
                </div>
              )}

              <button
                className="btn-primary"
                style={{
                  height: "4rem",
                  fontSize: "1.15rem",
                  fontWeight: 900,
                  background: selectedOrder
                    ? "linear-gradient(135deg, #10b981 0%, #059669 100%)"
                    : "linear-gradient(135deg, #f47b38 0%, #c2410c 100%)",
                  boxShadow: selectedOrder
                    ? "0 8px 24px -2px var(--success-glow)"
                    : "0 8px 24px -2px var(--primary-glow)",
                }}
                onClick={handleCheckout}
                disabled={loading || (cart.length === 0 && !selectedOrder)}
              >
                {loading ? (
                  <span>Processing Payment...</span>
                ) : selectedOrder ? (
                  <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <CheckIcon size={20} />
                    <span>SETTLE &amp; PRINT DINE-IN (₹{total.toFixed(2)})</span>
                  </span>
                ) : (
                  <span>COMPLETE TAKEAWAY (₹{total.toFixed(2)})</span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
