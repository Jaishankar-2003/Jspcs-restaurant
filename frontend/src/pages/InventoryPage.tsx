import { useEffect, useRef, useState } from "react";
import client from "../api/client";
import { AppLayout } from "../components/AppLayout";
import { StatCard } from "../components/StatCard";
import { SearchIcon, PlusIcon, MinusIcon, InventoryIcon } from "../components/Icons";

export default function InventoryPage() {
  const [foodItems, setFoodItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [txn, setTxn] = useState({ id: 0, quantity: 0, type: "in" });

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all"); // all, instock, lowstock, nostock

  const load = async () => {
    setLoading(true);
    try {
      const food = await client.get("/products");
      setFoodItems(food.data);
    } catch (err) {
      console.error("Failed to load inventory", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const product = foodItems.find((f) => f.id === txn.id);
      if (!product) return alert("Please select an item to adjust");
      const { id, ...data } = product;
      const newTotal =
        txn.type === "in"
          ? product.total_stock + txn.quantity
          : product.total_stock - txn.quantity;
      if (newTotal < 0) return alert("Total stock cannot drop below zero");
      await client.patch(`/products/${txn.id}`, { ...data, total_stock: newTotal });
      await load();
      alert(`✅ Stock for ${product.name} updated to ${newTotal}`);
      setTxn({ id: 0, quantity: 0, type: "in" });
    } catch (err) {
      alert("Failed to update stock");
    }
  };

  // Called from StockControl/ThresholdControl after debounce settles
  const updateStockAbsolute = async (item: any, field: string, newValue: number) => {
    try {
      if (newValue < 0) return;
      const { id, ...cleanItem } = item;
      const payload = { ...cleanItem, [field]: newValue };
      await client.patch(`/products/${item.id}`, payload);
      await load();
    } catch (err) {
      alert("Failed to update stock");
      await load(); // reload to revert optimistic UI
    }
  };

  const applyFilters = (items: any[]) => {
    let filtered = items.filter((i) =>
      i.name.toLowerCase().includes(search.toLowerCase())
    );
    if (filter === "instock")
      filtered = filtered.filter((i) => i.total_stock - i.reserved_stock > 0);
    if (filter === "lowstock")
      filtered = filtered.filter(
        (i) =>
          i.total_stock - i.reserved_stock > 0 &&
          i.total_stock - i.reserved_stock <= i.low_stock_threshold
      );
    if (filter === "nostock")
      filtered = filtered.filter((i) => i.total_stock - i.reserved_stock <= 0);
    return filtered;
  };

  const filteredFood = applyFilters(foodItems);

  // Metrics
  const totalCount = foodItems.length;
  const inStockCount = foodItems.filter(
    (i) => i.total_stock - i.reserved_stock > i.low_stock_threshold
  ).length;
  const lowStockCount = foodItems.filter((i) => {
    const avail = i.total_stock - i.reserved_stock;
    return avail > 0 && avail <= i.low_stock_threshold;
  }).length;
  const outOfStockCount = foodItems.filter(
    (i) => i.total_stock - i.reserved_stock <= 0
  ).length;

  return (
    <AppLayout
      title="STOCK &amp; INVENTORY MANAGEMENT"
      subtitle="Atomic multi-tier stock tracking • Live reserved stock vs available on shelf"
      showBack
      actions={
        <button className="btn-secondary" onClick={load} style={{ fontSize: "0.825rem" }}>
          ↻ Refresh Stock
        </button>
      }
    >
      {/* ── Metric Summary Tiles ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "1.25rem",
          marginBottom: "1.75rem",
        }}
      >
        <StatCard
          label="Catalog Tracked"
          value={totalCount}
          subValue="Active menu items"
          accentColor="indigo"
          icon={<InventoryIcon size={18} />}
        />
        <StatCard
          label="Optimal Stock"
          value={inStockCount}
          subValue="Above alert limit"
          accentColor="success"
          badge="HEALTHY"
        />
        <StatCard
          label="Low Stock Warning"
          value={lowStockCount}
          subValue="At or below limit"
          accentColor="primary"
          badge="REORDER SOON"
        />
        <StatCard
          label="Out of Stock"
          value={outOfStockCount}
          subValue="Zero available units"
          accentColor="danger"
          badge="ACTION REQUIRED"
        />
      </div>

      {/* ── Filter Bar ── */}
      <div
        className="card-3d mb-4 row"
        style={{
          gap: "1rem",
          display: "flex",
          padding: "1rem 1.25rem",
          background: "var(--bg-surface-2)",
        }}
      >
        <div className="search-wrapper" style={{ flex: 3 }}>
          <div className="search-icon-inside">
            <SearchIcon size={18} />
          </div>
          <input
            className="search-input search-input-padded"
            placeholder="Search items by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className="input-field"
          style={{ flex: 1, minWidth: "220px" }}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">All Inventory ({foodItems.length})</option>
          <option value="instock">In Stock Only</option>
          <option value="lowstock">Low Stock Alerts ({lowStockCount})</option>
          <option value="nostock">Out of Stock (0 Available)</option>
        </select>
      </div>

      {/* ── Two-Column Inventory Layout ── */}
      <div className="grid" style={{ gridTemplateColumns: "1fr 380px", gap: "1.75rem" }}>
        {/* Left: Inventory Data Table */}
        <div className="card-3d" style={{ padding: 0, overflow: "hidden" }}>
          <div
            style={{
              padding: "1.25rem 1.5rem",
              borderBottom: "1px solid var(--border-subtle)",
              background: "var(--bg-surface-1)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: "1.15rem" }}>Food Inventory Catalog</h3>
              <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                Showing {filteredFood.length} of {foodItems.length} items
              </span>
            </div>
          </div>

          <div className="data-table-wrapper" style={{ border: "none", borderRadius: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: "50px" }}>#</th>
                  <th>Dish Item</th>
                  <th style={{ textAlign: "center" }}>Total Stock</th>
                  <th style={{ textAlign: "center" }}>Reserved</th>
                  <th style={{ textAlign: "center" }}>Available</th>
                  <th style={{ textAlign: "center" }}>Alert Limit</th>
                  <th>Stock Health</th>
                </tr>
              </thead>
              <tbody>
                {filteredFood.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>
                      No inventory items match your filter
                    </td>
                  </tr>
                )}
                {filteredFood.map((f, i) => {
                  const avail = f.total_stock - f.reserved_stock;
                  const isOutOfStock = avail <= 0;
                  const isLow = avail > 0 && avail <= f.low_stock_threshold;

                  return (
                    <tr key={f.id}>
                      <td style={{ fontWeight: 800, color: "var(--text-muted)", fontSize: "0.85rem" }}>
                        {i + 1}
                      </td>
                      <td>
                        <strong style={{ fontSize: "0.95rem" }}>{f.name}</strong>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                          {f.category || "General"}
                        </div>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <StockControl item={f} onUpdate={updateStockAbsolute} />
                      </td>
                      <td style={{ textAlign: "center", color: "var(--primary)", fontWeight: 800 }}>
                        {f.reserved_stock}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span
                          style={{
                            fontFamily: "Outfit, sans-serif",
                            fontSize: "1.25rem",
                            fontWeight: 900,
                            color: isOutOfStock
                              ? "var(--danger)"
                              : isLow
                              ? "var(--amber-gold)"
                              : "var(--success)",
                          }}
                        >
                          {avail}
                        </span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <ThresholdControl item={f} onUpdate={updateStockAbsolute} />
                      </td>
                      <td>
                        {isOutOfStock ? (
                          <span className="badge badge-danger">OUT OF STOCK</span>
                        ) : isLow ? (
                          <span
                            className="badge"
                            style={{
                              background: "var(--primary-subtle)",
                              color: "var(--primary)",
                              border: "1px solid rgba(244,123,56,0.3)",
                            }}
                          >
                            LOW STOCK
                          </span>
                        ) : (
                          <span className="badge badge-free">IN STOCK</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Quick Stock In / Out Adjustment Card */}
        <div>
          <div
            className="card-3d"
            style={{ position: "sticky", top: "85px", background: "var(--bg-surface-2)" }}
          >
            <div style={{ marginBottom: "1.25rem", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "1rem" }}>
              <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800 }}>
                ⚡ Quick Stock Adjustment
              </h3>
              <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                Fast batch receipt or manual wastage write-off
              </p>
            </div>

            <form onSubmit={handleUpdate}>
              <div className="form-group">
                <label>SELECT DISH ITEM</label>
                <select
                  className="input-field"
                  value={txn.id}
                  onChange={(e) => setTxn({ ...txn, id: parseInt(e.target.value) })}
                  required
                >
                  <option value={0}>-- Select Dish --</option>
                  {foodItems.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} (Cur: {i.total_stock - i.reserved_stock})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>ADJUSTMENT DIRECTION</label>
                <div className="row" style={{ gap: "0.5rem" }}>
                  <button
                    type="button"
                    className={`btn-secondary flex-1 ${txn.type === "in" ? "active-success" : ""}`}
                    onClick={() => setTxn({ ...txn, type: "in" })}
                  >
                    + STOCK IN
                  </button>
                  <button
                    type="button"
                    className={`btn-secondary flex-1 ${txn.type === "out" ? "active-danger" : ""}`}
                    onClick={() => setTxn({ ...txn, type: "out" })}
                  >
                    - STOCK OUT
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>QUANTITY UNITS</label>
                <input
                  type="number"
                  min="0.1"
                  step="any"
                  className="input-field"
                  value={txn.quantity || ""}
                  onChange={(e) => setTxn({ ...txn, quantity: parseFloat(e.target.value) || 0 })}
                  placeholder="e.g. 20"
                  required
                />
              </div>

              <button
                className="btn-primary mt-4"
                style={{ width: "100%", height: "3.5rem", fontSize: "1rem" }}
                disabled={!txn.id || !txn.quantity}
              >
                APPLY STOCK ADJUSTMENT
              </button>
            </form>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

// ─── StockControl Component (Preserved debounced logic with 3D styling) ───────
function StockControl({
  item,
  onUpdate,
}: {
  item: any;
  onUpdate: (item: any, field: string, value: number) => void;
}) {
  const [val, setVal] = useState<number>(item.total_stock);
  const pendingRef = useRef<number>(item.total_stock);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setVal(item.total_stock);
    pendingRef.current = item.total_stock;
  }, [item.total_stock]);

  const commit = (newVal: number) => {
    if (newVal < 0) return;
    pendingRef.current = newVal;
    setVal(newVal);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onUpdate(item, "total_stock", pendingRef.current);
    }, 600);
  };

  return (
    <div style={{ display: "inline-flex", gap: "0.35rem", alignItems: "center" }}>
      <button
        className="qty-btn"
        style={{ width: "26px", height: "26px" }}
        onClick={() => commit(pendingRef.current - 1)}
        title="Decrease Total Stock"
      >
        <MinusIcon size={12} />
      </button>

      <input
        type="number"
        className="input-field"
        style={{
          width: "60px",
          padding: "0.25rem",
          textAlign: "center",
          fontWeight: 800,
          margin: 0,
          background: "var(--bg-surface-3)",
        }}
        value={val}
        onChange={(e) => {
          const n = parseFloat(e.target.value);
          if (!isNaN(n)) commit(n);
          else setVal(0);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        onBlur={() => {
          if (timerRef.current) clearTimeout(timerRef.current);
          if (pendingRef.current !== item.total_stock) {
            onUpdate(item, "total_stock", pendingRef.current);
          }
        }}
      />

      <button
        className="qty-btn"
        style={{ width: "26px", height: "26px" }}
        onClick={() => commit(pendingRef.current + 1)}
        title="Increase Total Stock"
      >
        <PlusIcon size={12} />
      </button>
    </div>
  );
}

// ─── ThresholdControl Component ──────────────────────────────────────────────
function ThresholdControl({
  item,
  onUpdate,
}: {
  item: any;
  onUpdate: (item: any, field: string, value: number) => void;
}) {
  const [val, setVal] = useState<number>(item.low_stock_threshold);

  useEffect(() => {
    setVal(item.low_stock_threshold);
  }, [item.low_stock_threshold]);

  return (
    <input
      type="number"
      className="input-field"
      style={{
        width: "55px",
        padding: "0.25rem",
        textAlign: "center",
        margin: "0 auto",
        borderStyle: "dashed",
        borderColor: "var(--border-medium)",
        background: "transparent",
      }}
      value={val}
      onChange={(e) => setVal(parseFloat(e.target.value))}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      onBlur={() => {
        let n = parseFloat(val as unknown as string);
        if (!isNaN(n) && n !== item.low_stock_threshold)
          onUpdate(item, "low_stock_threshold", n);
      }}
      title="Edit Low Stock Alert Limit"
    />
  );
}
