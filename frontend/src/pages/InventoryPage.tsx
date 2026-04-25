import { useEffect, useState } from "react";
import client from "../api/client";
import { Link } from "react-router-dom";

export default function InventoryPage() {
  const [rawItems, setRawItems] = useState<any[]>([]);
  const [foodItems, setFoodItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [txn, setTxn] = useState({ id: 0, quantity: 0, type: "in", category: "food" });

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all"); // all, instock, lowstock, nostock

  const load = async () => {
    setLoading(true);
    const [raw, food] = await Promise.all([
      client.get("/inventory"),
      client.get("/products")
    ]);
    setRawItems(raw.data);
    setFoodItems(food.data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
        if (txn.category === "food") {
            const product = foodItems.find(f => f.id === txn.id);
            const { id, ...data } = product;
            const newQty = txn.type === "in" ? product.quantity + txn.quantity : product.quantity - txn.quantity;
            await client.patch(`/products/${txn.id}`, { ...data, quantity: newQty });
        } else {
            const endpoint = txn.type === "in" ? "/inventory/stock-in" : "/inventory/stock-out";
            await client.post(endpoint, { inventory_id: txn.id, quantity: txn.quantity });
        }
        load();
        alert("Stock updated");
    } catch (err) { alert("Failed to update stock"); }
  };

  const updateStockInline = async (item: any, category: string, field: string, amount: number, isAbsolute: boolean = false) => {
    try {
      let newQty = isAbsolute ? amount : item[field] + amount;
      if (newQty < 0) return alert("Value cannot be negative");

      const { id, ...cleanItem } = item;
      const payload = { ...cleanItem, [field]: newQty };

      if (category === "food") {
        await client.patch(`/products/${item.id}`, payload);
      } else {
        if (field === "low_stock_threshold") {
          await client.patch(`/inventory/${item.id}`, payload);
        } else {
          let diff = newQty - item.quantity;
          if (diff !== 0) {
            const endpoint = diff > 0 ? "/inventory/stock-in" : "/inventory/stock-out";
            await client.post(endpoint, { inventory_id: item.id, quantity: Math.abs(diff) });
          }
        }
      }
      await load();
    } catch (err) {
      alert("Failed to update stock");
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
  const filteredRaw = applyFilters(rawItems);

  return (
    <div className="page">
      <div className="topbar">
        <h1>STOCK & INVENTORY</h1>
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

      <div className="grid" style={{gridTemplateColumns: '1fr 400px'}}>
        <div style={{display: 'flex', flexDirection: 'column', gap: '2rem'}}>
          <div className="card">
            <h3>🍱 Food Items Stock</h3>
            <table className="data-table">
              <thead>
                <tr><th>S.No</th><th>Item</th><th>Stock Control</th><th>Alert Limit</th><th>Category</th><th>Status</th></tr>
              </thead>
              <tbody>
                {filteredFood.length === 0 && <tr><td colSpan={6} style={{textAlign: 'center'}}>No items match your criteria</td></tr>}
                {filteredFood.map((f, i) => (
                  <tr key={f.id}>
                    <td style={{fontWeight: 800, color: 'var(--text-muted)'}}>{i + 1}</td>
                    <td>{f.name}</td>
                    <td><StockControl item={f} category="food" onUpdate={updateStockInline} /></td>
                    <td><ThresholdControl item={f} category="food" onUpdate={updateStockInline} /></td>
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

          <div className="card">
            <h3>📦 Raw Materials</h3>
            <table className="data-table">
              <thead>
                <tr><th>S.No</th><th>Item</th><th>Stock Control</th><th>Alert Limit</th><th>Unit</th><th>Status</th></tr>
              </thead>
              <tbody>
                {filteredRaw.length === 0 && <tr><td colSpan={6} style={{textAlign: 'center'}}>No items match your criteria</td></tr>}
                {filteredRaw.map((r, i) => (
                  <tr key={r.id}>
                    <td style={{fontWeight: 800, color: 'var(--text-muted)'}}>{i + 1}</td>
                    <td>{r.name}</td>
                    <td><StockControl item={r} category="raw" onUpdate={updateStockInline} /></td>
                    <td><ThresholdControl item={r} category="raw" onUpdate={updateStockInline} /></td>
                    <td>{r.unit}</td>
                    <td>
                      {r.quantity <= 0 ? <span className="badge badge-danger">Out of Stock</span> :
                       r.quantity <= r.low_stock_threshold ? <span className="badge badge-occupied">Low Stock</span> : 
                       <span className="badge badge-free">In Stock</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card" style={{height: 'fit-content', position: 'sticky', top: '2rem'}}>
          <h3>⚡ Quick Update</h3>
          <form onSubmit={handleUpdate}>
            <div className="form-group">
              <label>Category</label>
              <select className="input-field" value={txn.category} onChange={e => setTxn({...txn, category: e.target.value, id: 0})}>
                <option value="food">Food Product</option>
                <option value="raw">Raw Material</option>
              </select>
            </div>
            <div className="form-group">
              <label>Select Item</label>
              <select className="input-field" value={txn.id} onChange={e => setTxn({...txn, id: parseInt(e.target.value)})}>
                <option value={0}>-- Select --</option>
                {(txn.category === 'food' ? foodItems : rawItems).map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Type</label>
              <div className="row">
                <button type="button" className={`btn-secondary flex-1 ${txn.type === 'in' ? 'active-success' : ''}`} onClick={() => setTxn({...txn, type: 'in'})}>STOCK IN</button>
                <button type="button" className={`btn-secondary flex-1 ${txn.type === 'out' ? 'active-danger' : ''}`} onClick={() => setTxn({...txn, type: 'out'})}>STOCK OUT</button>
              </div>
            </div>
            <div className="form-group">
              <label>Quantity</label>
              <input type="number" className="input-field" value={txn.quantity} onChange={e => setTxn({...txn, quantity: parseFloat(e.target.value)})} />
            </div>
            <button className="btn-primary mt-4" style={{width: '100%'}} disabled={!txn.id}>UPDATE STOCK</button>
          </form>
        </div>
      </div>
    </div>
  );
}

// Sub-components moved outside to prevent re-definition focus bugs
function StockControl({ item, category, onUpdate }: { item: any, category: string, onUpdate: any }) {
  const [val, setVal] = useState(item.quantity);
  useEffect(() => { setVal(item.quantity) }, [item.quantity]);
  
  return (
    <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
      <button className="btn-secondary" style={{ padding: '0.2rem 0.5rem', minWidth: '30px' }} onClick={() => onUpdate(item, category, 'quantity', -1, false)}>-</button>
      <input 
        type="number" 
        className="input-field" 
        style={{ width: '70px', padding: '0.2rem', textAlign: 'center', margin: 0 }} 
        value={val} 
        onChange={e => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        onBlur={() => {
          let n = parseFloat(val as string);
          if (!isNaN(n) && n !== item.quantity) onUpdate(item, category, 'quantity', n, true);
        }}
      />
      <button className="btn-secondary" style={{ padding: '0.2rem 0.5rem', minWidth: '30px' }} onClick={() => onUpdate(item, category, 'quantity', 1, false)}>+</button>
    </div>
  );
}

function ThresholdControl({ item, category, onUpdate }: { item: any, category: string, onUpdate: any }) {
  const [val, setVal] = useState(item.low_stock_threshold);
  useEffect(() => { setVal(item.low_stock_threshold) }, [item.low_stock_threshold]);
  
  return (
    <input 
      type="number" 
      className="input-field" 
      style={{ width: '70px', padding: '0.2rem', textAlign: 'center', margin: 0, borderStyle: 'dashed' }} 
      value={val} 
      onChange={e => setVal(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
      onBlur={() => {
        let n = parseFloat(val as string);
        if (!isNaN(n) && n !== item.low_stock_threshold) onUpdate(item, category, 'low_stock_threshold', n, true);
      }}
      title="Edit Low Stock Alert Limit"
    />
  );
}
