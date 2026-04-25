import { useEffect, useState } from "react";
import client from "../api/client";
import { Link } from "react-router-dom";

export default function InventoryPage() {
  const [rawItems, setRawItems] = useState<any[]>([]);
  const [foodItems, setFoodItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [txn, setTxn] = useState({ id: 0, quantity: 0, type: "in", category: "food" });

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
            const newQty = txn.type === "in" ? product.quantity + txn.quantity : product.quantity - txn.quantity;
            await client.patch(`/products/${txn.id}`, { ...product, quantity: newQty });
        } else {
            const endpoint = txn.type === "in" ? "/inventory/stock-in" : "/inventory/stock-out";
            await client.post(endpoint, { inventory_id: txn.id, quantity: txn.quantity });
        }
        load();
        alert("Stock updated");
    } catch (err) { alert("Failed to update stock"); }
  };

  return (
    <div className="page">
      <div className="topbar">
        <h1>STOCK & INVENTORY</h1>
        <Link to="/dashboard" className="btn-secondary">Back</Link>
      </div>

      <div className="grid" style={{gridTemplateColumns: '1fr 400px'}}>
        <div style={{display: 'flex', flexDirection: 'column', gap: '2rem'}}>
          <div className="card">
            <h3>🍱 Food Items Stock</h3>
            <table className="data-table">
              <thead>
                <tr><th>Item</th><th>Stock</th><th>Category</th><th>Status</th></tr>
              </thead>
              <tbody>
                {foodItems.map(f => (
                  <tr key={f.id}>
                    <td>{f.name}</td>
                    <td>{f.quantity}</td>
                    <td>{f.category}</td>
                    <td>{f.quantity < 5 ? <span className="badge badge-occupied">Low</span> : <span className="badge badge-free">OK</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card">
            <h3>📦 Raw Materials</h3>
            <table className="data-table">
              <thead>
                <tr><th>Item</th><th>Stock</th><th>Unit</th><th>Status</th></tr>
              </thead>
              <tbody>
                {rawItems.map(r => (
                  <tr key={r.id}>
                    <td>{r.name}</td>
                    <td>{r.quantity}</td>
                    <td>{r.unit}</td>
                    <td>{r.quantity < 10 ? <span className="badge badge-occupied">Low</span> : <span className="badge badge-free">OK</span>}</td>
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
