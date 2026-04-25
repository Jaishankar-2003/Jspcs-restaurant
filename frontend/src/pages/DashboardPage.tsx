import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function DashboardPage() {
  const { role, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="page center">
      <div className="topbar" style={{width: '100%', maxWidth: '1000px'}}>
        <div>
            <h1 style={{fontSize: '2.5rem'}}>JSPCS RESTAURANT</h1>
            <small style={{color: 'var(--text-muted)'}}>MODE: HYBRID | v2.1.0</small>
        </div>
        <div className="row">
            <span className="badge badge-preparing" style={{fontSize: '0.9rem'}}>{role?.toUpperCase()}</span>
            <button className="btn-secondary" onClick={handleLogout} style={{borderColor: 'var(--danger)', color: 'var(--danger)'}}>Logout</button>
        </div>
      </div>

      <div className="grid" style={{gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', width: '100%', maxWidth: '1000px', gap: '1.5rem'}}>
        <Link to="/dashboard/billing" className="card-btn">
          <span className="icon">💰</span>
          <span className="label">Counter POS</span>
          <div style={{width: '40px', height: '4px', background: 'var(--primary)', marginTop: '1rem', borderRadius: '2px'}}></div>
        </Link>

        <Link to="/dashboard/orders" className="card-btn">
          <span className="icon">📋</span>
          <span className="label">Active Orders</span>
          <div style={{width: '40px', height: '4px', background: '#3b82f6', marginTop: '1rem', borderRadius: '2px'}}></div>
        </Link>

        <Link to="/dashboard/kitchen" className="card-btn">
          <span className="icon">🍳</span>
          <span className="label">Kitchen KDS</span>
          <div style={{width: '40px', height: '4px', background: '#10b981', marginTop: '1rem', borderRadius: '2px'}}></div>
        </Link>

        <Link to="/dashboard/tables" className="card-btn">
          <span className="icon">🪑</span>
          <span className="label">Floor Plan</span>
          <div style={{width: '40px', height: '4px', background: '#ef4444', marginTop: '1rem', borderRadius: '2px'}}></div>
        </Link>

        <Link to="/dashboard/inventory" className="card-btn">
          <span className="icon">📦</span>
          <span className="label">Stock Mgmt</span>
          <div style={{width: '40px', height: '4px', background: '#a855f7', marginTop: '1rem', borderRadius: '2px'}}></div>
        </Link>

        <Link to="/dashboard/menu" className="card-btn">
          <span className="icon">📜</span>
          <span className="label">Dish Menu</span>
          <div style={{width: '40px', height: '4px', background: '#ec4899', marginTop: '1rem', borderRadius: '2px'}}></div>
        </Link>

        <Link to="/dashboard/reports" className="card-btn">
          <span className="icon">📊</span>
          <span className="label">Analytics</span>
          <div style={{width: '40px', height: '4px', background: '#6366f1', marginTop: '1rem', borderRadius: '2px'}}></div>
        </Link>
      </div>
      
      <div style={{marginTop: '4rem', opacity: 0.3, fontSize: '0.8rem'}}>
        System Running on Local Area Network
      </div>
    </div>
  );
}
