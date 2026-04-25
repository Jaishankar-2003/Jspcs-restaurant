import { useEffect, useState, useRef } from "react";
import client from "../api/client";
import { Link } from "react-router-dom";

interface Category {
  id: number;
  name: string;
  subcategories: { id: number; name: string }[];
}

export default function MenuPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  
  // Modals
  const [showAdd, setShowAdd] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  
  const [editProduct, setEditProduct] = useState<any>(null);
  const [form, setForm] = useState({ name: "", price: 0, category: "", sub_category: "", is_veg: true, quantity: 0 });
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  
  // Category management state
  const [newCatName, setNewCatName] = useState("");
  const [newSubCatName, setNewSubCatName] = useState("");
  const [selectedCatForSub, setSelectedCatForSub] = useState<number | "">("");

  // Filtering & Pagination
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("");
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 12;

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = async () => {
    try {
      const [pRes, cRes] = await Promise.all([
        client.get("/products"),
        client.get("/categories")
      ]);
      setProducts(pRes.data);
      setCategories(cRes.data);
    } catch (err) {
      console.error("Load failed", err);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
        if (editProduct) {
            await client.patch(`/products/${editProduct.id}`, form);
        } else {
            await client.post("/products", form);
        }
        setForm({ name: "", price: 0, category: "", sub_category: "", is_veg: true, quantity: 0 });
        setShowAdd(false);
        setEditProduct(null);
        loadData();
    } catch (err) { console.error("Submit failed", err); }
  };

  const startEdit = (p: any) => {
    setEditProduct(p);
    setForm({ name: p.name, price: p.price, category: p.category || "", sub_category: p.sub_category || "", is_veg: p.is_veg, quantity: p.quantity });
    setShowAdd(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm("Delete this dish?")) {
      const res = await client.delete(`/products/${id}`);
      if (res.data?.message?.includes("archived")) {
        alert(res.data.message);
      }
      setSelectedIds(selectedIds.filter(sid => sid !== id));
      loadData();
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (confirm(`Delete ${selectedIds.length} selected dishes?`)) {
      const res = await client.post("/products/bulk-delete", { ids: selectedIds });
      alert(res.data.message);
      setSelectedIds([]);
      loadData();
    }
  };

  const toggleSelect = (id: number) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(sid => sid !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
        await client.post("/products/bulk", formData, {
            headers: { "Content-Type": "multipart/form-data" }
        });
        alert("Upload successful");
        loadData();
    } catch (err) {
        alert("Upload failed");
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDownloadSample = () => {
    const csvContent = "data:text/csv;charset=utf-8,name,price,category,sub_category,is_veg,quantity\nSample Dish,150,Main Course,Biryani,true,10\nAnother Dish,50,Beverages,Soft Drinks,true,50\nChicken Wings,200,Starters,Chicken,false,20";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "sample_dishes.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAddCategory = async () => {
    if(!newCatName) return;
    try {
      await client.post("/categories", { name: newCatName });
      setNewCatName("");
      loadData();
    } catch (e: any) { alert(e.response?.data?.detail || "Error"); }
  };
  
  const handleDeleteCategory = async (id: number) => {
    if(confirm("Delete category and all its subcategories?")) {
        await client.delete(`/categories/${id}`);
        loadData();
    }
  };

  const handleAddSubCategory = async () => {
    if(!selectedCatForSub || !newSubCatName) return;
    try {
      await client.post(`/categories/${selectedCatForSub}/subcategories`, { name: newSubCatName });
      setNewSubCatName("");
      loadData();
    } catch (e: any) { alert(e.response?.data?.detail || "Error"); }
  };

  const handleDeleteSubCategory = async (id: number) => {
    if(confirm("Delete sub-category?")) {
        await client.delete(`/categories/subcategories/${id}`);
        loadData();
    }
  };

  const filteredProducts = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat ? p.category === filterCat : true;
    return matchSearch && matchCat;
  });

  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE) || 1;
  const currentProducts = filteredProducts.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const selectedCatObj = categories.find(c => c.name === form.category);

  const totalCount = products.length;
  const vegCount = products.filter(p => p.is_veg).length;
  const nonVegCount = totalCount - vegCount;

  return (
    <div className="page">
      <div className="topbar">
        <div>
          <h1 style={{margin: 0}}>DISH MANAGEMENT</h1>
          <div style={{display: 'flex', gap: '1rem', marginTop: '0.5rem', fontSize: '0.9rem', background: 'var(--card-bg)', padding: '0.25rem 0.75rem', borderRadius: '1rem', border: '1px solid var(--border)', display: 'inline-flex'}}>
            <span style={{color: 'var(--text-dark)'}}>Total: <strong>{totalCount}</strong></span>
            <span style={{color: 'var(--success)'}}>🟩 Veg: <strong>{vegCount}</strong></span>
            <span style={{color: 'var(--danger)'}}>🟥 Non-Veg: <strong>{nonVegCount}</strong></span>
          </div>
        </div>
        <div className="row">
          <button className="btn-secondary" onClick={handleDownloadSample} style={{marginRight: '0.5rem', background: 'transparent', border: '1px solid var(--border)'}}>⬇️ Sample CSV</button>
          <input type="file" accept=".csv" style={{display: 'none'}} ref={fileInputRef} onChange={handleFileUpload} />
          <button className="btn-secondary" onClick={() => fileInputRef.current?.click()}>⬆️ CSV Upload</button>
          <button className="btn-secondary" onClick={() => setShowCategoryManager(true)}>Manage Categories</button>
          <button className="btn-primary" onClick={() => { 
              setShowAdd(true); 
              setEditProduct(null); 
              setForm({ name: "", price: 0, category: "", sub_category: "", is_veg: true, quantity: 0 }); 
          }}>+ ADD NEW DISH</button>
          <Link to="/dashboard" className="btn-secondary">Back</Link>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="card mb-4 row" style={{ gap: '1rem', display: 'flex' }}>
        <input 
          className="input-field" 
          style={{ flex: 3 }}
          placeholder="🔍 Search dish name..." 
          value={search} 
          onChange={e => { setSearch(e.target.value); setPage(1); }} 
        />
        <select 
          className="input-field" 
          style={{ flex: 1, minWidth: '200px' }}
          value={filterCat} 
          onChange={e => { setFilterCat(e.target.value); setPage(1); }}
        >
          <option value="">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
      </div>

      {/* CATEGORY MANAGER MODAL */}
      {showCategoryManager && (
        <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <div className="card" style={{width: '600px', maxHeight: '90vh', overflowY: 'auto'}}>
            <div className="row" style={{justifyContent: 'space-between', marginBottom: '1rem'}}>
              <h2>Manage Categories</h2>
              <button className="btn-secondary" onClick={() => setShowCategoryManager(false)}>Close</button>
            </div>
            
            <div style={{marginBottom: '2rem'}}>
              <h4>Add Category</h4>
              <div className="row" style={{gap: '0.5rem'}}>
                <input className="input-field flex-1" placeholder="Category name..." value={newCatName} onChange={e=>setNewCatName(e.target.value)} />
                <button className="btn-primary" onClick={handleAddCategory}>Add</button>
              </div>
            </div>

            <div style={{marginBottom: '2rem'}}>
              <h4>Add Sub-Category</h4>
              <div className="row" style={{gap: '0.5rem'}}>
                <select className="input-field" value={selectedCatForSub} onChange={e=>setSelectedCatForSub(parseInt(e.target.value) || "")}>
                  <option value="">Select Category...</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <input className="input-field flex-1" placeholder="Sub-category name..." value={newSubCatName} onChange={e=>setNewSubCatName(e.target.value)} />
                <button className="btn-primary" onClick={handleAddSubCategory}>Add</button>
              </div>
            </div>

            <h4>Existing Categories</h4>
            <div style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
              {categories.map(c => (
                <div key={c.id} style={{border: '1px solid var(--border)', padding: '1rem', borderRadius: '0.5rem'}}>
                  <div className="row" style={{justifyContent: 'space-between', marginBottom: '0.5rem'}}>
                    <strong style={{fontSize: '1.2rem', color: 'var(--primary)'}}>{c.name}</strong>
                    <button style={{background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer'}} onClick={() => handleDeleteCategory(c.id)}>🗑️ Del</button>
                  </div>
                  <div style={{display: 'flex', gap: '0.5rem', flexWrap: 'wrap'}}>
                    {c.subcategories.map(sub => (
                      <span key={sub.id} className="badge" style={{background: 'var(--accent)', display: 'flex', gap: '0.5rem', alignItems: 'center'}}>
                        {sub.name}
                        <button style={{background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 0}} onClick={() => handleDeleteSubCategory(sub.id)}>×</button>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* DISH FORM MODAL */}
      {showAdd && (
        <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <div className="card" style={{width: '600px', maxHeight: '90vh', overflowY: 'auto'}}>
            <h3 style={{marginBottom: '1.5rem'}}>{editProduct ? "Edit Dish" : "Create New Dish"}</h3>
            <form onSubmit={handleSubmit} style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Dish Name</label>
                <input className="input-field" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required placeholder="e.g. Chicken Biryani" />
              </div>
              <div className="form-group" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--accent)', padding: '0.5rem 1rem', borderRadius: '0.6rem' }}>
                <label style={{ margin: 0 }}>Dietary Preference:</label>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', margin: 0 }}>
                    <input type="radio" name="diet" checked={form.is_veg} onChange={() => setForm({...form, is_veg: true})} style={{ accentColor: 'var(--success)' }} />
                    <span style={{ color: form.is_veg ? 'var(--success)' : 'inherit', fontWeight: form.is_veg ? 800 : 400 }}>🟩 Veg</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', margin: 0 }}>
                    <input type="radio" name="diet" checked={!form.is_veg} onChange={() => setForm({...form, is_veg: false})} style={{ accentColor: 'var(--danger)' }} />
                    <span style={{ color: !form.is_veg ? 'var(--danger)' : 'inherit', fontWeight: !form.is_veg ? 800 : 400 }}>🟥 Non-Veg</span>
                  </label>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Price (₹)</label>
                  <input type="number" className="input-field" value={form.price || ''} onChange={e => setForm({...form, price: parseFloat(e.target.value) || 0})} required placeholder="0.00" />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Initial Stock</label>
                  <input type="number" className="input-field" value={form.quantity || ''} onChange={e => setForm({...form, quantity: parseFloat(e.target.value) || 0})} placeholder="0" />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Category</label>
                  <input 
                    className="input-field" 
                    list="category-options" 
                    value={form.category} 
                    onChange={e => setForm({...form, category: e.target.value, sub_category: ""})} 
                    required 
                    placeholder="Select or type category..." 
                  />
                  <datalist id="category-options">
                    {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </datalist>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Sub-Category</label>
                  <input 
                    className="input-field" 
                    list="subcategory-options" 
                    value={form.sub_category} 
                    onChange={e => setForm({...form, sub_category: e.target.value})} 
                    placeholder="Select or type sub-category..." 
                  />
                  <datalist id="subcategory-options">
                    {selectedCatObj?.subcategories.map(sub => <option key={sub.id} value={sub.name}>{sub.name}</option>)}
                  </datalist>
                </div>
              </div>
              
              <div className="row" style={{ marginTop: '1rem', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowAdd(false)}>CANCEL</button>
                <button type="submit" className="btn-primary" style={{marginLeft: '0.5rem'}}>{editProduct ? "UPDATE DISH" : "SAVE DISH"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SELECT ALL & BULK ACTIONS */}
      {currentProducts.length > 0 && (
        <div className="row" style={{ marginBottom: '1rem', padding: '0 0.5rem', justifyContent: 'space-between', background: 'var(--card-bg)', padding: '1rem', borderRadius: '0.6rem', boxShadow: 'var(--shadow)' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 800 }}>
            <input 
              type="checkbox" 
              checked={selectedIds.length === currentProducts.length && currentProducts.length > 0} 
              onChange={(e) => {
                if (e.target.checked) {
                  setSelectedIds(currentProducts.map(p => p.id));
                } else {
                  setSelectedIds([]);
                }
              }} 
              style={{ width: '20px', height: '20px', accentColor: 'var(--primary)' }} 
            />
            Select All on Page
          </label>
          
          {selectedIds.length > 0 && (
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
               <span style={{ fontWeight: 800, color: 'var(--danger)' }}>{selectedIds.length} selected</span>
               <button className="btn-primary" style={{ background: 'var(--danger)' }} onClick={handleBulkDelete}>🗑️ Delete Selected</button>
            </div>
          )}
        </div>
      )}

      {/* GRID */}
      <div className="grid" style={{gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', minHeight: '400px', alignContent: 'start'}}>
        {currentProducts.length === 0 ? (
          <div style={{gridColumn: '1/-1', textAlign: 'center', padding: '3rem', color: 'var(--text-muted)'}}>No dishes found.</div>
        ) : currentProducts.map((p) => (
          <div 
            key={p.id} 
            className="card" 
            style={{
              display: 'flex', 
              flexDirection: 'column', 
              borderTop: `4px solid ${p.is_veg ? 'var(--success)' : 'var(--danger)'}`,
              position: 'relative',
              padding: '1.5rem',
              gap: '0.5rem',
              boxShadow: 'var(--shadow)',
              borderRadius: '0.6rem'
            }}
          >
            {/* Action Buttons (Top Right) */}
            <div style={{position: 'absolute', top: '1.5rem', right: '1.5rem', zIndex: 10, display: 'flex', gap: '0.5rem'}}>
                <button 
                  onClick={() => startEdit(p)} 
                  title="Edit Dish"
                  style={{background: 'var(--accent)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'transform 0.2s'}}
                  onMouseOver={e => e.currentTarget.style.transform = 'scale(1.1)'}
                  onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
                >✏️</button>
                <button 
                  onClick={() => handleDelete(p.id)} 
                  title="Delete Dish"
                  style={{background: '#ffebee', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'transform 0.2s'}}
                  onMouseOver={e => e.currentTarget.style.transform = 'scale(1.1)'}
                  onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
                >🗑️</button>
            </div>
            
            {/* Selection & Badges Row */}
            <div style={{display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', paddingRight: '5rem'}}>
              <input 
                type="checkbox" 
                checked={selectedIds.includes(p.id)} 
                onChange={() => toggleSelect(p.id)} 
                title="Select Dish"
                style={{width: '20px', height: '20px', cursor: 'pointer', accentColor: 'var(--primary)', flexShrink: 0}} 
              />
              
              {/* Veg / Non-Veg Standard Symbol */}
              <div 
                title={p.is_veg ? "Vegetarian" : "Non-Vegetarian"}
                style={{
                  width: '20px', height: '20px', border: `2px solid ${p.is_veg ? 'var(--success)' : 'var(--danger)'}`, 
                  display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', flexShrink: 0
              }}>
                 <div style={{width: '10px', height: '10px', borderRadius: '50%', background: p.is_veg ? 'var(--success)' : 'var(--danger)'}}></div>
              </div>

              <div style={{display: 'flex', flexWrap: 'wrap', gap: '0.5rem'}}>
                <span className="badge badge-pending" style={{ padding: '0.3rem 0.6rem' }}>{p.category}</span>
                {p.sub_category && <span className="badge" style={{background: 'var(--accent)', padding: '0.3rem 0.6rem'}}>{p.sub_category}</span>}
              </div>
            </div>

            {/* Dish Info */}
            <h2 style={{margin: '0', fontSize: '1.4rem', color: 'var(--text-dark)'}}>{p.name}</h2>
            
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 'auto', paddingTop: '1rem'}}>
                <div style={{fontSize: '1.6rem', fontWeight: 800, color: 'var(--primary)'}}>₹{p.price}</div>
                <div style={{fontSize: '0.9rem', color: 'var(--text-muted)', background: 'var(--bg-light)', padding: '0.25rem 0.75rem', borderRadius: '1rem', border: '1px solid var(--border)'}}>
                  Stock: <strong style={{color: p.quantity > 10 ? 'var(--success)' : 'var(--danger)'}}>{p.quantity}</strong>
                </div>
            </div>
          </div>
        ))}
      </div>

      {/* PAGINATION */}
      {totalPages > 1 && (
        <div className="row" style={{justifyContent: 'center', marginTop: '2rem', gap: '1rem'}}>
          <button className="btn-secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button>
          <span style={{fontWeight: 800}}>Page {page} of {totalPages}</span>
          <button className="btn-secondary" disabled={page === totalPages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}
