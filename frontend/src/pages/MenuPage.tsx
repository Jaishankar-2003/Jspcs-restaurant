import { useEffect, useState, useRef } from "react";
import client from "../api/client";
import { AppLayout } from "../components/AppLayout";
import { Modal } from "../components/Modal";
import {
  PlusIcon,
  TrashIcon,
  EditIcon,
  SearchIcon,
  DownloadIcon,
  UploadIcon,
  LayersIcon
} from "../components/Icons";

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
  const [form, setForm] = useState({
    name: "",
    price: 0,
    category: "",
    sub_category: "",
    is_veg: true,
    total_stock: 0,
  });
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
        client.get("/categories"),
      ]);
      setProducts(pRes.data);
      setCategories(cRes.data);
    } catch (err) {
      console.error("Load failed", err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editProduct) {
        await client.patch(`/products/${editProduct.id}`, form);
      } else {
        await client.post("/products", form);
      }
      setForm({ name: "", price: 0, category: "", sub_category: "", is_veg: true, total_stock: 0 });
      setShowAdd(false);
      setEditProduct(null);
      loadData();
    } catch (err) {
      console.error("Submit failed", err);
    }
  };

  const startEdit = (p: any) => {
    setEditProduct(p);
    setForm({
      name: p.name,
      price: p.price,
      category: p.category || "",
      sub_category: p.sub_category || "",
      is_veg: p.is_veg,
      total_stock: p.total_stock,
    });
    setShowAdd(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm("Delete this dish?")) {
      const res = await client.delete(`/products/${id}`);
      if (res.data?.message?.includes("archived")) {
        alert(res.data.message);
      }
      setSelectedIds(selectedIds.filter((sid) => sid !== id));
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
      setSelectedIds(selectedIds.filter((sid) => sid !== id));
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
        headers: { "Content-Type": "multipart/form-data" },
      });
      alert("CSV Upload successful");
      loadData();
    } catch (err) {
      alert("Upload failed");
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDownloadSample = () => {
    const csvContent =
      "data:text/csv;charset=utf-8,name,price,category,sub_category,is_veg,quantity\nSample Dish,150,Main Course,Biryani,true,10\nAnother Dish,50,Beverages,Soft Drinks,true,50\nChicken Wings,200,Starters,Chicken,false,20";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "sample_dishes.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAddCategory = async () => {
    if (!newCatName) return;
    try {
      await client.post("/categories", { name: newCatName });
      setNewCatName("");
      loadData();
    } catch (e: any) {
      alert(e.response?.data?.detail || "Error");
    }
  };

  const handleDeleteCategory = async (id: number) => {
    if (confirm("Delete category and all its subcategories?")) {
      await client.delete(`/categories/${id}`);
      loadData();
    }
  };

  const handleAddSubCategory = async () => {
    if (!selectedCatForSub || !newSubCatName) return;
    try {
      await client.post(`/categories/${selectedCatForSub}/subcategories`, {
        name: newSubCatName,
      });
      setNewSubCatName("");
      loadData();
    } catch (e: any) {
      alert(e.response?.data?.detail || "Error");
    }
  };

  const handleDeleteSubCategory = async (id: number) => {
    if (confirm("Delete sub-category?")) {
      await client.delete(`/categories/subcategories/${id}`);
      loadData();
    }
  };

  const filteredProducts = products.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat ? p.category === filterCat : true;
    return matchSearch && matchCat;
  });

  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE) || 1;
  const currentProducts = filteredProducts.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE
  );

  const selectedCatObj = categories.find((c) => c.name === form.category);

  const totalCount = products.length;
  const vegCount = products.filter((p) => p.is_veg).length;
  const nonVegCount = totalCount - vegCount;

  return (
    <AppLayout
      title="DISH MENU &amp; CATALOG"
      subtitle="Culinary inventory catalog • Dietary preferences and category hierarchy"
      showBack
      actions={
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
          <button
            className="btn-secondary"
            onClick={handleDownloadSample}
            style={{ fontSize: "0.825rem" }}
            title="Download CSV Template"
          >
            <DownloadIcon size={14} />
            <span>Sample CSV</span>
          </button>

          <input
            type="file"
            accept=".csv"
            style={{ display: "none" }}
            ref={fileInputRef}
            onChange={handleFileUpload}
          />
          <button
            className="btn-secondary"
            onClick={() => fileInputRef.current?.click()}
            style={{ fontSize: "0.825rem" }}
          >
            <UploadIcon size={14} />
            <span>CSV Upload</span>
          </button>

          <button
            className="btn-secondary"
            onClick={() => setShowCategoryManager(true)}
            style={{ fontSize: "0.825rem" }}
          >
            <LayersIcon size={14} />
            <span>Categories</span>
          </button>

          <button
            className="btn-primary"
            onClick={() => {
              setShowAdd(true);
              setEditProduct(null);
              setForm({
                name: "",
                price: 0,
                category: "",
                sub_category: "",
                is_veg: true,
                total_stock: 0,
              });
            }}
            style={{ fontSize: "0.85rem" }}
          >
            <PlusIcon size={16} />
            <span>+ Add New Dish</span>
          </button>
        </div>
      }
    >
      {/* ── Summary Indicator Badges ── */}
      <div
        style={{
          display: "flex",
          gap: "1rem",
          marginBottom: "1.5rem",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.75rem",
            padding: "0.45rem 1rem",
            borderRadius: "var(--radius-full)",
            background: "var(--bg-surface-2)",
            border: "1px solid var(--border-subtle)",
            fontSize: "0.85rem",
          }}
        >
          <span>Catalog Items: <strong>{totalCount}</strong></span>
          <span style={{ color: "var(--border-medium)" }}>•</span>
          <span style={{ color: "var(--success)", fontWeight: 700 }}>
            🟩 Veg: {vegCount}
          </span>
          <span style={{ color: "var(--border-medium)" }}>•</span>
          <span style={{ color: "var(--danger)", fontWeight: 700 }}>
            🟥 Non-Veg: {nonVegCount}
          </span>
        </div>
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
            placeholder="Search dish by name..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <select
          className="input-field"
          style={{ flex: 1, minWidth: "220px" }}
          value={filterCat}
          onChange={(e) => {
            setFilterCat(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All Categories ({categories.length})</option>
          {categories.map((c) => (
            <option key={c.id} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* ── Bulk Selection Bar ── */}
      {currentProducts.length > 0 && (
        <div
          className="card-3d"
          style={{
            marginBottom: "1.25rem",
            padding: "0.85rem 1.25rem",
            background: "var(--bg-surface-2)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <label style={{ display: "flex", alignItems: "center", gap: "0.6rem", cursor: "pointer", fontWeight: 700, fontSize: "0.9rem" }}>
            <input
              type="checkbox"
              checked={
                selectedIds.length === currentProducts.length &&
                currentProducts.length > 0
              }
              onChange={(e) => {
                if (e.target.checked) {
                  setSelectedIds(currentProducts.map((p) => p.id));
                } else {
                  setSelectedIds([]);
                }
              }}
              style={{ width: "18px", height: "18px", accentColor: "var(--primary)" }}
            />
            <span>Select All on Page ({currentProducts.length})</span>
          </label>

          {selectedIds.length > 0 && (
            <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
              <span style={{ fontWeight: 800, color: "var(--danger)", fontSize: "0.85rem" }}>
                {selectedIds.length} Selected
              </span>
              <button
                className="btn-primary"
                style={{ background: "var(--danger)", padding: "0.45rem 0.9rem", fontSize: "0.825rem" }}
                onClick={handleBulkDelete}
              >
                <TrashIcon size={14} />
                <span>Delete Selected</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Product Grid ── */}
      <div
        className="grid"
        style={{
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          minHeight: "400px",
          alignContent: "start",
          gap: "1.5rem",
        }}
      >
        {currentProducts.length === 0 ? (
          <div
            style={{
              gridColumn: "1/-1",
              textAlign: "center",
              padding: "5rem 2rem",
              color: "var(--text-muted)",
            }}
          >
            <div style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>🍽️</div>
            <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>No dishes match your filter</div>
          </div>
        ) : (
          currentProducts.map((p) => {
            const avail = p.total_stock - p.reserved_stock;
            return (
              <div
                key={p.id}
                className="card-3d card-interactive"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  borderTop: `4px solid ${p.is_veg ? "var(--success)" : "var(--danger)"}`,
                  position: "relative",
                  padding: "1.5rem",
                  gap: "0.75rem",
                }}
              >
                {/* Floating Top-Right Action Buttons */}
                <div style={{ position: "absolute", top: "1.25rem", right: "1.25rem", zIndex: 10, display: "flex", gap: "0.4rem" }}>
                  <button
                    onClick={() => startEdit(p)}
                    title="Edit Dish"
                    style={{
                      background: "var(--bg-surface-3)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "50%",
                      width: "32px",
                      height: "32px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      color: "var(--text-secondary)",
                    }}
                  >
                    <EditIcon size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    title="Delete Dish"
                    style={{
                      background: "rgba(239, 68, 68, 0.12)",
                      border: "1px solid rgba(239, 68, 68, 0.3)",
                      borderRadius: "50%",
                      width: "32px",
                      height: "32px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      color: "#fca5a5",
                    }}
                  >
                    <TrashIcon size={14} />
                  </button>
                </div>

                {/* Selection & Badges Row */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", paddingRight: "4.5rem" }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(p.id)}
                    onChange={() => toggleSelect(p.id)}
                    title="Select Dish"
                    style={{ width: "18px", height: "18px", cursor: "pointer", accentColor: "var(--primary)", flexShrink: 0 }}
                  />

                  {/* Standard Veg / Non-Veg Icon Symbol */}
                  <div className={`pos-diet-pip ${p.is_veg ? "veg" : "non-veg"}`} title={p.is_veg ? "Vegetarian" : "Non-Vegetarian"} />

                  <span className="badge" style={{ background: "var(--bg-surface-3)", fontSize: "0.72rem" }}>
                    {p.category || "General"}
                  </span>
                </div>

                {/* Dish Info */}
                <h3 style={{ margin: "0.25rem 0", fontSize: "1.25rem", color: "var(--text-primary)" }}>
                  {p.name}
                </h3>

                {/* Pricing & Stock Card Bottom Strip */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginTop: "auto", paddingTop: "0.5rem" }}>
                  <div style={{ fontFamily: "Outfit, sans-serif", fontSize: "1.6rem", fontWeight: 900, color: "var(--primary)" }}>
                    ₹{p.price}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      background: "var(--bg-surface-1)",
                      padding: "0.6rem 0.85rem",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border-subtle)",
                      fontSize: "0.825rem",
                    }}
                  >
                    <div style={{ display: "flex", gap: "0.75rem", color: "var(--text-muted)" }}>
                      <span>Total: <strong>{p.total_stock}</strong></span>
                      <span>Reserved: <strong style={{ color: "var(--primary)" }}>{p.reserved_stock}</strong></span>
                    </div>

                    <div style={{ borderLeft: "1px solid var(--border-subtle)", paddingLeft: "0.75rem" }}>
                      Avail: <strong style={{ fontSize: "1.05rem", color: avail > 0 ? "var(--success)" : "var(--danger)" }}>
                        {avail}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="row" style={{ justifyContent: "center", marginTop: "2.5rem", gap: "1rem" }}>
          <button
            className="btn-secondary"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            ← Previous
          </button>
          <span style={{ fontWeight: 800, fontSize: "0.9rem" }}>
            Page {page} of {totalPages}
          </span>
          <button
            className="btn-secondary"
            disabled={page === totalPages}
            onClick={() => setPage(page + 1)}
          >
            Next →
          </button>
        </div>
      )}

      {/* ── Category Manager Modal ── */}
      <Modal
        isOpen={showCategoryManager}
        onClose={() => setShowCategoryManager(false)}
        title="Category &amp; Department Manager"
        subtitle="Manage food taxonomy and grouping hierarchy"
        maxWidth="640px"
        zIndex={1500}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
          {/* Add Category */}
          <div style={{ padding: "1.25rem", background: "var(--bg-surface-1)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
            <h4 style={{ margin: "0 0 0.75rem 0", fontSize: "0.95rem" }}>Create New Category</h4>
            <div className="row" style={{ gap: "0.5rem" }}>
              <input
                className="input-field flex-1"
                placeholder="Category name (e.g. Starters, Beverages)..."
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
              />
              <button className="btn-primary" onClick={handleAddCategory}>
                Add Category
              </button>
            </div>
          </div>

          {/* Add Sub-Category */}
          <div style={{ padding: "1.25rem", background: "var(--bg-surface-1)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
            <h4 style={{ margin: "0 0 0.75rem 0", fontSize: "0.95rem" }}>Add Sub-Category</h4>
            <div className="row" style={{ gap: "0.5rem" }}>
              <select
                className="input-field"
                style={{ flex: 1 }}
                value={selectedCatForSub}
                onChange={(e) => setSelectedCatForSub(parseInt(e.target.value) || "")}
              >
                <option value="">Select Parent Category...</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <input
                className="input-field flex-1"
                placeholder="Sub-category (e.g. Biryani, Hot Teas)..."
                value={newSubCatName}
                onChange={(e) => setNewSubCatName(e.target.value)}
              />
              <button className="btn-primary" onClick={handleAddSubCategory}>
                Add Sub
              </button>
            </div>
          </div>

          {/* Existing Categories List */}
          <div>
            <h4 style={{ margin: "0 0 0.75rem 0", fontSize: "0.95rem" }}>Existing Categories ({categories.length})</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxHeight: "240px", overflowY: "auto" }}>
              {categories.map((c) => (
                <div
                  key={c.id}
                  style={{
                    border: "1px solid var(--border-subtle)",
                    padding: "1rem",
                    borderRadius: "var(--radius-md)",
                    background: "var(--bg-surface-1)",
                  }}
                >
                  <div className="row" style={{ justifyContent: "space-between", marginBottom: "0.5rem" }}>
                    <strong style={{ fontSize: "1.05rem", color: "var(--primary)" }}>{c.name}</strong>
                    <button
                      style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", fontSize: "0.85rem" }}
                      onClick={() => handleDeleteCategory(c.id)}
                    >
                      🗑️ Delete
                    </button>
                  </div>

                  <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                    {c.subcategories.map((sub) => (
                      <span
                        key={sub.id}
                        className="badge"
                        style={{
                          background: "var(--bg-surface-3)",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.4rem",
                        }}
                      >
                        <span>{sub.name}</span>
                        <button
                          style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", padding: 0 }}
                          onClick={() => handleDeleteSubCategory(sub.id)}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    {c.subcategories.length === 0 && (
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>No subcategories</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* ── Dish Form Modal (Add / Edit) ── */}
      <Modal
        isOpen={showAdd}
        onClose={() => setShowAdd(false)}
        title={editProduct ? "Edit Culinary Dish" : "Create New Dish"}
        subtitle="Configure dish specifications, pricing, and dietary preferences"
        maxWidth="620px"
        zIndex={1500}
      >
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label>DISH NAME</label>
            <input
              className="input-field"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              placeholder="e.g. Mutton Biryani Special"
            />
          </div>

          <div
            className="form-group"
            style={{
              margin: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "var(--bg-surface-1)",
              padding: "0.75rem 1.25rem",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <label style={{ margin: 0, fontWeight: 700 }}>DIETARY PREFERENCE:</label>
            <div style={{ display: "flex", gap: "1.5rem" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", margin: 0 }}>
                <input
                  type="radio"
                  name="diet"
                  checked={form.is_veg}
                  onChange={() => setForm({ ...form, is_veg: true })}
                  style={{ accentColor: "var(--success)", width: "16px", height: "16px" }}
                />
                <span style={{ color: form.is_veg ? "var(--success)" : "inherit", fontWeight: 800 }}>
                  🟩 Vegetarian
                </span>
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", margin: 0 }}>
                <input
                  type="radio"
                  name="diet"
                  checked={!form.is_veg}
                  onChange={() => setForm({ ...form, is_veg: false })}
                  style={{ accentColor: "var(--danger)", width: "16px", height: "16px" }}
                />
                <span style={{ color: !form.is_veg ? "var(--danger)" : "inherit", fontWeight: 800 }}>
                  🟥 Non-Vegetarian
                </span>
              </label>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label>PRICE (₹)</label>
              <input
                type="number"
                step="any"
                className="input-field"
                value={form.price || ""}
                onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })}
                required
                placeholder="0.00"
              />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label>TOTAL ALLOTTED STOCK</label>
              <input
                type="number"
                className="input-field"
                value={form.total_stock || ""}
                onChange={(e) => setForm({ ...form, total_stock: parseFloat(e.target.value) || 0 })}
                placeholder="0"
              />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label>CATEGORY</label>
              <input
                className="input-field"
                list="category-options"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value, sub_category: "" })}
                required
                placeholder="Select or type category..."
              />
              <datalist id="category-options">
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </datalist>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label>SUB-CATEGORY</label>
              <input
                className="input-field"
                list="subcategory-options"
                value={form.sub_category}
                onChange={(e) => setForm({ ...form, sub_category: e.target.value })}
                placeholder="Select or type sub-category..."
              />
              <datalist id="subcategory-options">
                {selectedCatObj?.subcategories.map((sub) => (
                  <option key={sub.id} value={sub.name}>
                    {sub.name}
                  </option>
                ))}
              </datalist>
            </div>
          </div>

          <div className="row" style={{ marginTop: "1rem", justifyContent: "flex-end", gap: "0.75rem", borderTop: "1px solid var(--border-subtle)", paddingTop: "1.25rem" }}>
            <button type="button" className="btn-secondary" onClick={() => setShowAdd(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              {editProduct ? "Update Dish" : "Save Dish"}
            </button>
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
}
