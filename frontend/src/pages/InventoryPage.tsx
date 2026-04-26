import { useEffect, useRef, useState } from "react";
import client from "../api/client";
import { Link } from "react-router-dom";

export default function InventoryPage() {
  const [foodItems, setFoodItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [txn, setTxn] = useState({ id: 0, quantity: 0, type: "in" });

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all"); // all, instock, lowstock, nostock

  const load = async () => {
    setLoading(true);
    const food = await client.get("/products");
    setFoodItems(food.data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const product = foodItems.find(f => f.id === txn.id);
      if (!product) return alert("Please select an item");
      const { id, ...data } = product;
      const newQty = txn.type === "in"
        ? product.quantity + txn.quantity
        : product.quantity - txn.quantity;
      if (newQty < 0) return alert("Stock cannot go below 0");
      await client.patch(`/products/${txn.id}`, { ...data, quantity: newQty });
      await load();
      alert("Stock updated");
    } catch (err) { alert("Failed to update stock"); }
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
    let filtered = items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));
    if (filter === "instock") filtered = filtered.filter(i => i.quantity > 0);
    if (filter === "lowstock") filtered = filtered.filter(i => i.quantity > 0 && i.quantity <= i.low_stock_threshold);
    if (filter === "nostock") filtered = filtered.filter(i => i.quantity <= 0);
    return filtered;
  };

  const filteredFood = applyFilters(foodItems);

  return (
    <div className="page">
      <div className="topbar">
        <h1>STOCK &amp; INVENTORY</h1>
        <Link to="/dashboard" className="btn-secondary">Back</Link>
      </div>

      <div className="card mb-4 row" style={{ gap: '1rem', display: 'flex' }}>
        <input
          className="input-field"
          style={{ flex: 3 }}
          placeholder="🔍 Search items..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className="input-field"
          style={{ flex: 1, minWidth: '200px' }}
          value={filter}
          onChange={e => setFilter(e.target.value)}
        >
          <option value="all">All Stock</option>
          <option value="instock">In Stock</option>
          <option value="lowstock">Low Stock</option>
          <option value="nostock">No Stock (0)</option>
        </select>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1fr 400px' }}>
        <div className="card">
          <h3>🍱 Food Items Stock</h3>
          <table className="data-table">
            <thead>
              <tr><th>S.No</th><th>Item</th><th>Stock Control</th><th>Alert Limit</th><th>Category</th><th>Status</th></tr>
            </thead>
            <tbody>
              {filteredFood.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center' }}>No items match your criteria</td></tr>}
              {filteredFood.map((f, i) => (
                <tr key={f.id}>
                  <td style={{ fontWeight: 800, color: 'var(--text-muted)' }}>{i + 1}</td>
                  <td>{f.name}</td>
                  <td><StockControl item={f} onUpdate={updateStockAbsolute} /></td>
                  <td><ThresholdControl item={f} onUpdate={updateStockAbsolute} /></td>
                  <td>{f.category}</td>
                  <td>
                    {f.quantity <= 0 ? <span className="badge badge-danger">Out of Stock</span> :
                      f.quantity <= f.low_stock_threshold ? <span className="badge badge-occupied">Low Stock</span> :
                        <span className="badge badge-free">In Stock</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card" style={{ height: 'fit-content', position: 'sticky', top: '2rem' }}>
          <h3>⚡ Quick Update</h3>
          <form onSubmit={handleUpdate}>
            <div className="form-group">
              <label>Select Item</label>
              <select className="input-field" value={txn.id} onChange={e => setTxn({ ...txn, id: parseInt(e.target.value) })}>
                <option value={0}>-- Select --</option>
                {foodItems.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Type</label>
              <div className="row">
                <button type="button" className={`btn-secondary flex-1 ${txn.type === 'in' ? 'active-success' : ''}`} onClick={() => setTxn({ ...txn, type: 'in' })}>STOCK IN</button>
                <button type="button" className={`btn-secondary flex-1 ${txn.type === 'out' ? 'active-danger' : ''}`} onClick={() => setTxn({ ...txn, type: 'out' })}>STOCK OUT</button>
              </div>
            </div>
            <div className="form-group">
              <label>Quantity</label>
              <input type="number" className="input-field" value={txn.quantity} onChange={e => setTxn({ ...txn, quantity: parseFloat(e.target.value) })} />
            </div>
            <button className="btn-primary mt-4" style={{ width: '100%' }} disabled={!txn.id}>UPDATE STOCK</button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ─── StockControl ─────────────────────────────────────────────────────────────
// Uses a debounced ref pattern: local optimistic value updates instantly on
// +/- clicks; a 600ms debounce fires one single API call with the final value.
// This prevents race conditions from rapid clicks all reading stale item.quantity.
function StockControl({ item, onUpdate }: { item: any; onUpdate: (item: any, field: string, value: number) => void }) {
  const [val, setVal] = useState<number>(item.quantity);
  const pendingRef = useRef<number>(item.quantity);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync when parent reloads data (after API round-trip)
  useEffect(() => {
    setVal(item.quantity);
    pendingRef.current = item.quantity;
  }, [item.quantity]);

  const commit = (newVal: number) => {
    if (newVal < 0) return;
    pendingRef.current = newVal;
    setVal(newVal);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onUpdate(item, "quantity", pendingRef.current);
    }, 600);
  };

  return (
    <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
      <button
        className="btn-secondary qty-btn"
        style={{ padding: '0.2rem 0.5rem', minWidth: '30px' }}
        onClick={() => commit(pendingRef.current - 1)}
      >-</button>
      <input
        type="number"
        className="input-field"
        style={{ width: '55px', padding: '0.15rem', textAlign: 'center', margin: 0 }}
        value={val}
        onChange={e => {
          const n = parseFloat(e.target.value);
          if (!isNaN(n)) commit(n);
          else setVal(0);
        }}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        onBlur={() => {
          // Flush immediately on blur without waiting for debounce
          if (timerRef.current) clearTimeout(timerRef.current);
          if (pendingRef.current !== item.quantity) {
            onUpdate(item, "quantity", pendingRef.current);
          }
        }}
      />
      <button
        className="btn-secondary qty-btn"
        style={{ padding: '0.2rem 0.5rem', minWidth: '30px' }}
        onClick={() => commit(pendingRef.current + 1)}
      >+</button>
    </div>
  );
}

// ─── ThresholdControl ─────────────────────────────────────────────────────────
function ThresholdControl({ item, onUpdate }: { item: any; onUpdate: (item: any, field: string, value: number) => void }) {
  const [val, setVal] = useState<number>(item.low_stock_threshold);

  useEffect(() => { setVal(item.low_stock_threshold); }, [item.low_stock_threshold]);

  return (
    <input
      type="number"
      className="input-field"
      style={{ width: '50px', padding: '0.2rem', textAlign: 'center', margin: 0, borderStyle: 'dashed' }}
      value={val}
      onChange={e => setVal(parseFloat(e.target.value))}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
      onBlur={() => {
        let n = parseFloat(val as unknown as string);
        if (!isNaN(n) && n !== item.low_stock_threshold) onUpdate(item, 'low_stock_threshold', n);
      }}
      title="Edit Low Stock Alert Limit"
    />
  );
}
