import { useEffect, useState } from "react";
import client from "../api/client";
import { Link } from "react-router-dom";

export default function MenuPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editProduct, setEditProduct] = useState<any>(null);
  const [form, setForm] = useState({ name: "", price: 0, category: "General", quantity: 0 });

  const load = () => {
    console.log("Loading products...");
    client.get("/products").then((r) => {
        console.log("Products loaded:", r.data);
        setProducts(r.data);
    }).catch(err => console.error("Load products failed", err));
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Submitting form:", form);
    try {
        if (editProduct) {
            await client.patch(`/products/${editProduct.id}`, form);
        } else {
            await client.post("/products", form);
        }
        setForm({ name: "", price: 0, category: "General", quantity: 0 });
        setShowAdd(false);
        setEditProduct(null);
        load();
    } catch (err) { console.error("Submit failed", err); }
  };

  const startEdit = (p: any) => {
    setEditProduct(p);
    setForm({ name: p.name, price: p.price, category: p.category, quantity: p.quantity });
    setShowAdd(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm("Delete this dish?")) {
      await client.delete(`/products/${id}`);
      load();
    }
  };

  return (
    <div className="page">
      <div className="topbar">
        <h1>DISH MANAGEMENT</h1>
        <div className="row">
          <button className="btn-primary" onClick={() => { 
              console.log("Add button clicked");
              setShowAdd(true); 
              setEditProduct(null); 
              setForm({ name: "", price: 0, category: "General", quantity: 0 }); 
          }}>+ ADD NEW DISH</button>
          <Link to="/dashboard" className="btn-secondary">Back</Link>
        </div>
      </div>

      {showAdd && (
        <div className="card mb-4" style={{maxWidth: '600px', animation: 'none'}}>
          <h3>{editProduct ? "Edit Dish" : "Create New Dish"}</h3>
          <form onSubmit={handleSubmit} style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
            <div className="form-group" style={{gridColumn: '1/-1'}}>
              <label>Dish Name</label>
              <input className="input-field" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
            </div>
            <div className="form-group">
              <label>Price (₹)</label>
              <input type="number" className="input-field" value={form.price} onChange={e => setForm({...form, price: parseFloat(e.target.value)})} required />
            </div>
            <div className="form-group">
              <label>Category</label>
              <input className="input-field" value={form.category} onChange={e => setForm({...form, category: e.target.value})} />
            </div>
            <div className="form-group" style={{gridColumn: '1/-1'}}>
              <label>Initial Stock (Quantity)</label>
              <input type="number" className="input-field" value={form.quantity} onChange={e => setForm({...form, quantity: parseFloat(e.target.value)})} />
            </div>
            <div className="row" style={{gridColumn: '1/-1'}}>
              <button type="submit" className="btn-primary flex-1">{editProduct ? "UPDATE DISH" : "SAVE DISH"}</button>
              <button type="button" className="btn-secondary" onClick={() => setShowAdd(false)}>CANCEL</button>
            </div>
          </form>
        </div>
      )}

      <div className="grid" style={{gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))'}}>
        {products.map((p) => (
          <div key={p.id} className="card" style={{display: 'flex', flexDirection: 'column'}}>
            <div className="row" style={{justifyContent: 'space-between', marginBottom: '1rem'}}>
               <span className="badge badge-pending">{p.category}</span>
               <div className="row">
                  <button onClick={() => startEdit(p)} style={{background: 'none', border: 'none', cursor: 'pointer'}}>✏️</button>
                  <button onClick={() => handleDelete(p.id)} style={{background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer'}}>🗑️</button>
               </div>
            </div>
            <h2 style={{margin: '0.5rem 0'}}>{p.name}</h2>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem'}}>
                <div style={{fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)'}}>₹{p.price}</div>
                <div style={{fontSize: '0.9rem', color: 'var(--text-muted)'}}>Stock: <strong>{p.quantity}</strong></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
