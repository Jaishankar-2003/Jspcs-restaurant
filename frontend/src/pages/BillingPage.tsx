import { useState, useEffect, useRef } from "react";
import client from "../api/client";
import { Link } from "react-router-dom";

interface Product {
  id: number;
  name: string;
  price: number;
  category: string;
}

interface CartItem extends Product {
  quantity: number;
}

export default function BillingPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderType, setOrderType] = useState("takeaway");
  const [tableId, setTableId] = useState<number | "">("");
  const [tables, setTables] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [billRequests, setBillRequests] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const loadBillRequests = () => {
    client.get("/orders").then(res => {
      setBillRequests(res.data.filter((o: any) => o.status === 'bill_requested'));
    });
  };

  useEffect(() => {
    client.get("/products").then(res => setProducts(res.data));
    client.get("/tables").then(res => setTables(res.data.filter((t: any) => t.status === 'free')));
    loadBillRequests();
    
    const t = setInterval(loadBillRequests, 5000);
    searchRef.current?.focus();
    
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "F1") { e.preventDefault(); searchRef.current?.focus(); }
    };
    window.addEventListener("keydown", handleKey);
    return () => {
        window.removeEventListener("keydown", handleKey);
        clearInterval(t);
    };
  }, []);

  const addToCart = (p: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === p.id);
      if (existing) {
        return prev.map(item => item.id === p.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...p, quantity: 1 }];
    });
    setSearchTerm("");
    searchRef.current?.focus();
  };

  const removeFromCart = (id: number) => setCart(prev => prev.filter(item => item.id !== id));
  const total = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);

  const handleCheckout = async () => {
    if (cart.length === 0 && !selectedOrder) return;
    setLoading(true);
    try {
      if (selectedOrder) {
          // Complete existing order
          const paymentType = confirm("Confirm Payment via Cash?") ? "cash" : "card";
          await client.post("/billing/complete", { order_id: selectedOrder.id, payment_type: paymentType });
          alert("Dine-In Bill Settled! Table is now free.");
          setSelectedOrder(null);
          setCart([]);
      } else {
          // Create new takeaway order and complete immediately (Counter POS flow)
          const orderRes = await client.post("/orders", {
            type: orderType,
            table_id: orderType === 'dine_in' ? tableId : null,
            items: cart.map(item => ({ product_id: item.id, quantity: item.quantity }))
          });
          const orderId = orderRes.data.id;
          
          // For counter billing, we assume it's paid and ready immediately
          await client.patch(`/orders/${orderId}/status`, null, { params: { status: 'ready' } });
          await client.post("/billing/complete", { order_id: orderId, payment_type: "cash" });
          alert(`Takeaway Order #${orderId} Completed!`);
          setCart([]);
      }
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
        category: i.product?.category || "General"
    }));
    setCart(cartItems);
    setOrderType("dine_in");
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="page">
      <div className="topbar">
        <h1>COUNTER POS & BILLING</h1>
        <Link to="/dashboard" className="btn-secondary">Dashboard</Link>
      </div>

      <div className="billing-layout">
        <div className="billing-main">
          <div style={{padding: '1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '1rem'}}>
            <input 
              ref={searchRef}
              className="search-input flex-1" 
              placeholder="Search dishes (F1)..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              disabled={!!selectedOrder}
            />
            {selectedOrder && (
                <button className="btn-secondary" onClick={() => { setSelectedOrder(null); setCart([]); }}>CLEAR TABLE ORDER</button>
            )}
          </div>
          
          <div className="product-grid" style={{opacity: selectedOrder ? 0.5 : 1, pointerEvents: selectedOrder ? 'none' : 'auto'}}>
            {filteredProducts.map(p => (
              <div key={p.id} className="product-card" onClick={() => addToCart(p)}>
                <div style={{fontSize: '0.8rem', color: 'var(--text-muted)'}}>{p.category}</div>
                <div style={{fontWeight: 700, margin: '0.5rem 0'}}>{p.name}</div>
                <div style={{color: 'var(--primary)', fontWeight: 800}}>₹{p.price}</div>
              </div>
            ))}
          </div>

          <div className="cart-items">
            <h3>{selectedOrder ? `Table ${selectedOrder.table_id} Items` : "Current Cart"}</h3>
            {cart.map(item => (
              <div key={item.id} className="cart-item">
                <div className="flex-1">
                  <strong>{item.name}</strong>
                  <div style={{fontSize: '0.9rem', color: 'var(--text-muted)'}}>₹{item.price} x {item.quantity}</div>
                </div>
                <div className="row">
                  <div style={{fontWeight: 800}}>₹{item.price * item.quantity}</div>
                  {!selectedOrder && <button onClick={() => removeFromCart(item.id)} style={{background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '1.2rem'}}>✖</button>}
                </div>
              </div>
            ))}
          </div>

          <div className="total-section">
            <span>Total Payable</span>
            <span>₹{total.toFixed(2)}</span>
          </div>
        </div>

        <div className="billing-sidebar" style={{display: 'flex', flexDirection: 'column', gap: '1.5rem'}}>
          <div className="card" style={{background: 'var(--accent)', border: '2px solid var(--primary)'}}>
            <h3>🔔 Bill Notifications</h3>
            <div style={{display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem'}}>
                {billRequests.map(br => (
                    <div key={br.id} className="card" style={{padding: '1rem', cursor: 'pointer', border: '1px solid var(--primary)'}} onClick={() => loadOrderToPos(br)}>
                        <div style={{fontWeight: 800}}>🪑 Table {br.table_id}</div>
                        <div style={{fontSize: '0.8rem', color: 'var(--text-muted)'}}>Amount: ₹{br.items?.reduce((acc: number, i: any) => acc + (i.price * i.quantity), 0).toFixed(2)}</div>
                        <button className="btn-primary mt-4" style={{padding: '0.4rem', width: '100%', fontSize: '0.8rem'}}>PROCESS BILL</button>
                    </div>
                ))}
                {billRequests.length === 0 && <p style={{opacity: 0.5, textAlign: 'center'}}>No pending bill requests</p>}
            </div>
          </div>

          <div className="card" style={{display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: 1}}>
            <h3>{selectedOrder ? "Settle Dine-In" : "Takeaway Checkout"}</h3>
            
            {!selectedOrder && (
                <div className="form-group">
                <label>Service Type</label>
                <div className="row">
                    <button 
                    className={`btn-secondary flex-1 ${orderType === 'takeaway' ? 'active-success' : ''}`}
                    onClick={() => setOrderType('takeaway')}
                    >Takeaway</button>
                </div>
                </div>
            )}

            <button 
              className="btn-primary" 
              style={{height: '5rem', fontSize: '1.5rem', background: selectedOrder ? 'var(--success)' : 'var(--primary)'}} 
              onClick={handleCheckout} 
              disabled={loading || cart.length === 0}
            >
              {loading ? "..." : selectedOrder ? "SETTLE & PRINT" : "COMPLETE TAKEAWAY"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
