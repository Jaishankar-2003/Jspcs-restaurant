import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";
import { EyeIcon, EyeOffIcon, SparklesIcon, ShieldIcon, PosIcon, KitchenIcon, TablesIcon } from "../components/Icons";

export default function LoginPage() {
  const [name, setName] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const auth = useAuth();
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const cleanName = name.trim().toLowerCase();
    const cleanPass = password.trim();

    try {
      const { data } = await client.post("/auth/login", {
        name: cleanName,
        password: cleanPass,
      });
      auth.login(data.access_token, data.role);
      navigate("/dashboard");
    } catch (err: any) {
      // If trimmed password failed, try with exact untouched password in case password has spaces
      if (cleanPass !== password) {
        try {
          const retryRes = await client.post("/auth/login", {
            name: cleanName,
            password: password,
          });
          auth.login(retryRes.data.access_token, retryRes.data.role);
          navigate("/dashboard");
          return;
        } catch {}
      }

      const detail = err?.response?.data?.detail;
      if (err?.code === "ERR_NETWORK" || !err?.response) {
        setError("Network Error: Could not connect to backend workstation on port 8000.");
      } else if (err?.response?.status === 502 || err?.response?.status === 504) {
        setError("Gateway Error: Backend API server is starting up or unreachable.");
      } else {
        setError(detail || "Invalid workstation credentials (default: admin / admin123)");
      }
    } finally {
      setLoading(false);
    }
  }

  const setPresetCredentials = (presetName: string, presetPass: string) => {
    setName(presetName);
    setPassword(presetPass);
    setError("");
  };

  return (
    <div className="auth-split-screen">
      {/* ── Left Cinematic Brand Storytelling Panel (Light Luxury Theme) ── */}
      <div className="auth-hero-panel">
        <div className="auth-hero-glow-1" />
        <div className="auth-hero-glow-2" />

        {/* Top Brand Logo */}
        <div style={{ position: "relative", zIndex: 2 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div className="brand-logo-3d" style={{ width: "48px", height: "48px", borderRadius: "14px" }}>
              <span style={{ fontSize: "1.5rem" }}>✦</span>
            </div>
            <div>
              <div style={{ fontFamily: "Outfit, sans-serif", fontSize: "1.6rem", fontWeight: 900, letterSpacing: "0.04em", color: "var(--text-primary)" }}>
                AURA <span style={{ color: "var(--primary)" }}>RESTAURANT OS</span>
              </div>
              <div style={{ fontSize: "0.75rem", fontWeight: 800, letterSpacing: "0.14em", color: "var(--text-muted)" }}>
                HAUTE CUISINE MANAGEMENT PLATFORM
              </div>
            </div>
          </div>
        </div>

        {/* Center 3D Floating Feature Display */}
        <div style={{ position: "relative", zIndex: 2, margin: "3rem 0" }}>
          <div className="auth-hero-visual-card">
            <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.35rem 0.85rem", background: "var(--primary-subtle)", border: "1px solid rgba(244,123,56,0.3)", borderRadius: "9999px", color: "var(--primary)", fontSize: "0.75rem", fontWeight: 800, marginBottom: "1.25rem" }}>
              <SparklesIcon size={14} />
              <span>COMMERCIAL GRADE SAAS</span>
            </div>

            <h2 style={{ fontSize: "2rem", fontWeight: 900, marginBottom: "1rem", lineHeight: 1.2, color: "var(--text-primary)" }}>
              High-Velocity Hospitality Operations &amp; Intelligence
            </h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", lineHeight: 1.6, marginBottom: "2rem" }}>
              Integrated real-time floor plan orchestration, KDS kitchen ticket routing, strict atomic inventory depletion, and rapid POS cashier billing.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div style={{ background: "#ffffff", padding: "1.1rem", borderRadius: "14px", border: "1px solid var(--border-medium)", boxShadow: "var(--shadow-flat)" }}>
                <div style={{ color: "var(--primary)", marginBottom: "0.4rem" }}><PosIcon size={22} /></div>
                <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "var(--text-primary)" }}>Instant Counter POS</div>
                <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "2px" }}>One-click settlement &amp; barcode focus</div>
              </div>
              <div style={{ background: "#ffffff", padding: "1.1rem", borderRadius: "14px", border: "1px solid var(--border-medium)", boxShadow: "var(--shadow-flat)" }}>
                <div style={{ color: "var(--success)", marginBottom: "0.4rem" }}><KitchenIcon size={22} /></div>
                <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "var(--text-primary)" }}>Live Kitchen KDS</div>
                <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "2px" }}>Active order routing &amp; waiter notes</div>
              </div>
              <div style={{ background: "#ffffff", padding: "1.1rem", borderRadius: "14px", border: "1px solid var(--border-medium)", boxShadow: "var(--shadow-flat)" }}>
                <div style={{ color: "var(--info)", marginBottom: "0.4rem" }}><TablesIcon size={22} /></div>
                <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "var(--text-primary)" }}>Floor Plan Sync</div>
                <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "2px" }}>Table lifecycle &amp; seat management</div>
              </div>
              <div style={{ background: "#ffffff", padding: "1.1rem", borderRadius: "14px", border: "1px solid var(--border-medium)", boxShadow: "var(--shadow-flat)" }}>
                <div style={{ color: "var(--purple)", marginBottom: "0.4rem" }}><ShieldIcon size={22} /></div>
                <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "var(--text-primary)" }}>Stock Protection</div>
                <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "2px" }}>Atomic reserved vs sold tracking</div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Platform Info */}
        <div style={{ position: "relative", zIndex: 2, display: "flex", justifyContent: "space-between", alignItems: "center", color: "var(--text-muted)", fontSize: "0.8rem", fontWeight: 600 }}>
          <div>Station LAN Node: <strong>127.0.0.1:8000</strong></div>
          <div style={{ display: "flex", gap: "1rem" }}>
            <span>SSL Secured</span>
            <span>•</span>
            <span>v2.4.0 Production</span>
          </div>
        </div>
      </div>

      {/* ── Right Sign-In Panel (Light Theme) ── */}
      <div className="auth-form-panel">
        <div className="auth-form-card-3d">
          <div style={{ marginBottom: "2rem", textAlign: "center" }}>
            <div style={{ width: "52px", height: "52px", borderRadius: "14px", background: "var(--primary-subtle)", border: "1px solid rgba(244,123,56,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.25rem", color: "var(--primary)", boxShadow: "0 4px 14px -2px var(--primary-glow)" }}>
              <ShieldIcon size={26} />
            </div>
            <h1 style={{ fontSize: "1.75rem", fontWeight: 900, marginBottom: "0.35rem", color: "var(--text-primary)" }}>Terminal Access</h1>
            <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", margin: 0 }}>
              Authenticate to unlock your restaurant workstation
            </p>
          </div>

          {error && (
            <div style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.35)", borderRadius: "var(--radius-md)", padding: "0.85rem 1rem", marginBottom: "1.5rem", color: "var(--danger)", fontSize: "0.875rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={submit}>
            <div className="form-group">
              <label>OPERATOR USERNAME</label>
              <input
                className="input-field"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter username (e.g. admin)"
                required
                autoComplete="username"
              />
            </div>

            <div className="form-group" style={{ marginBottom: "1.75rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.45rem" }}>
                <label style={{ margin: 0 }}>SECRET KEY</label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "0.3rem" }}
                >
                  {showPassword ? <EyeOffIcon size={14} /> : <EyeIcon size={14} />}
                  <span>{showPassword ? "Hide" : "Show"}</span>
                </button>
              </div>
              <input
                className="input-field"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              className="btn-primary"
              style={{ width: "100%", padding: "0.95rem", fontSize: "1.05rem", borderRadius: "var(--radius-md)" }}
              disabled={loading}
            >
              {loading ? (
                <span>Authorizing Terminal...</span>
              ) : (
                <span>Access Station →</span>
              )}
            </button>
          </form>

          {/* Quick Preset Buttons for Convenience */}
          <div style={{ marginTop: "2rem", paddingTop: "1.5rem", borderTop: "1px solid var(--border-subtle)" }}>
            <div style={{ fontSize: "0.75rem", fontWeight: 800, color: "var(--text-muted)", textAlign: "center", marginBottom: "0.75rem", letterSpacing: "0.06em" }}>
              FAST ACCESS ROLES
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <button
                type="button"
                onClick={() => setPresetCredentials("admin", "admin123")}
                className="btn-secondary"
                style={{ fontSize: "0.8rem", padding: "0.55rem 0.75rem", justifyContent: "center" }}
              >
                👑 Manager (Admin)
              </button>
              <button
                type="button"
                onClick={() => setPresetCredentials("admin", "admin123")}
                className="btn-secondary"
                style={{ fontSize: "0.8rem", padding: "0.55rem 0.75rem", justifyContent: "center" }}
              >
                💰 Cashier / POS
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
