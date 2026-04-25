import { useEffect, useState } from "react";
import client from "../api/client";
import { Link } from "react-router-dom";

export default function ReportsPage() {
  const [daily, setDaily] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [top, setTop] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
  }, []);

  if (loading) return <div className="page text-center"><h1>Calculating...</h1></div>;

  return (
    <div className="page">
      <div className="topbar">
        <h1>SALES & ANALYTICS</h1>
        <Link to="/dashboard" className="btn-secondary">Back to Dashboard</Link>
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
