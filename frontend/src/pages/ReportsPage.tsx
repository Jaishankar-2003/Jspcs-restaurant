import { useEffect, useState } from "react";
import client from "../api/client";
import { Link } from "react-router-dom";

export default function ReportsPage() {
  const [daily, setDaily] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [top, setTop] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showClearModal, setShowClearModal] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [clearing, setClearing] = useState(false);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      client.get("/reports/daily-sales"), 
      client.get("/reports/summary"), 
      client.get("/reports/top-items")
    ]).then(([d, s, t]) => {
      setDaily(d.data);
      setSummary(s.data);
      setTop(t.data);
      setLoading(false);
    });
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleClearAll = async (type: 'sales' | 'nuclear') => {
    if (confirmText !== "RESET ALL DATA") return;
    setClearing(true);
    try {
      const endpoint = type === 'sales' ? "/reports/clear-all" : "/reports/nuclear-reset";
      await client.post(endpoint);
      alert(type === 'sales' ? "Sales data cleared." : "FULL SYSTEM WIPE SUCCESSFUL. All data removed.");
      setShowClearModal(false);
      setConfirmText("");
      loadData();
    } catch (err: any) {
      alert("Error: " + (err.response?.data?.detail || "Failed to clear data"));
    } finally {
      setClearing(false);
    }
  };

  if (loading && !showClearModal) return <div className="page text-center"><h1>Calculating...</h1></div>;

  return (
    <div className="page">
      {showClearModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '550px', width: '100%', border: '2px solid var(--danger)', padding: '3rem', textAlign: 'center' }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>☢️</div>
            <h2 style={{ color: 'var(--danger)', marginBottom: '1rem' }}>SYSTEM RESET OPTIONS</h2>
            <p style={{ marginBottom: '2rem', opacity: 0.8 }}>
              Choose the level of data you want to wipe. This action is <strong>permanent</strong>.
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
              <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '0.5rem', textAlign: 'left', border: '1px solid var(--border)' }}>
                <strong>1. Clear Sales Only</strong>: Deletes Invoices and Orders. Keeps your Dishes and Categories.
              </div>
              <div style={{ padding: '1rem', background: 'rgba(239,68,68,0.1)', borderRadius: '0.5rem', textAlign: 'left', border: '1px solid var(--danger)' }}>
                <strong>2. Nuclear Reset</strong>: Deletes EVERYTHING (Dishes, Categories, Tables, Sales). Like a factory reset.
              </div>
            </div>

            <p style={{ marginBottom: '0.5rem', fontWeight: 800 }}>Type "RESET ALL DATA" to confirm:</p>
            <input 
              className="input-field" 
              style={{ textAlign: 'center', fontSize: '1.2rem', marginBottom: '2rem', borderColor: confirmText === 'RESET ALL DATA' ? 'var(--danger)' : undefined }}
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              placeholder="Type here..."
            />
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div className="row" style={{ gap: '1rem' }}>
                <button 
                  className="btn-primary" 
                  style={{ flex: 1, background: 'var(--danger)', height: '3.5rem', fontWeight: 800 }}
                  disabled={confirmText !== 'RESET ALL DATA' || clearing}
                  onClick={() => handleClearAll('nuclear')}
                >
                  NUCLEAR RESET (WIPE ALL)
                </button>
                <button 
                  className="btn-primary" 
                  style={{ flex: 1, background: '#f59e0b', color: 'black', height: '3.5rem' }}
                  disabled={confirmText !== 'RESET ALL DATA' || clearing}
                  onClick={() => handleClearAll('sales')}
                >
                  CLEAR SALES ONLY
                </button>
              </div>
              <button 
                className="btn-secondary" 
                style={{ width: '100%', height: '3.5rem' }}
                onClick={() => { setShowClearModal(false); setConfirmText(""); }}
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="topbar">
        <h1>SALES & ANALYTICS</h1>
        <div className="row">
          <button 
            className="btn-secondary" 
            style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
            onClick={() => setShowClearModal(true)}
          >
            🗑️ CLEAR ALL SALES DATA
          </button>
          <Link to="/dashboard" className="btn-secondary">Back to Dashboard</Link>
        </div>
      </div>

      <div className="grid" style={{gridTemplateColumns: 'repeat(3, 1fr)'}}>
        <div className="card text-center">
          <div style={{color: 'var(--text-muted)', marginBottom: '0.5rem'}}>TODAY'S SALES</div>
          <div style={{fontSize: '2.5rem', fontWeight: 900, color: 'var(--success)'}}>₹{daily?.total_sales || 0}</div>
        </div>
        <div className="card text-center">
          <div style={{color: 'var(--text-muted)', marginBottom: '0.5rem'}}>WEEKLY SUMMARY</div>
          <div style={{fontSize: '2.5rem', fontWeight: 900, color: 'var(--primary)'}}>₹{summary?.weekly_sales || 0}</div>
        </div>
        <div className="card text-center">
          <div style={{color: 'var(--text-muted)', marginBottom: '0.5rem'}}>MONTHLY TOTAL</div>
          <div style={{fontSize: '2.5rem', fontWeight: 900, color: '#3b82f6'}}>₹{summary?.monthly_sales || 0}</div>
        </div>
      </div>

      <div className="card mt-4">
        <h3>Top Selling Items</h3>
        <table style={{width: '100%', borderCollapse: 'collapse', marginTop: '1rem'}}>
          <thead>
            <tr style={{textAlign: 'left', borderBottom: '1px solid var(--border)'}}>
               <th style={{padding: '1rem'}}>Item Name</th>
               <th style={{padding: '1rem'}}>Quantity Sold</th>
            </tr>
          </thead>
          <tbody>
            {top.map((item, idx) => (
              <tr key={idx} style={{borderBottom: '1px solid var(--border)'}}>
                <td style={{padding: '1rem'}}>{item.name}</td>
                <td style={{padding: '1rem', fontWeight: 700}}>{item.quantity}</td>
              </tr>
            ))}
            {top.length === 0 && <tr><td colSpan={2} style={{padding: '2rem', textAlign: 'center', opacity: 0.5}}>No sales data yet</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
