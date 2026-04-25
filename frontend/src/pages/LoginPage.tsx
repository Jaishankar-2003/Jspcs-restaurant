import { useState } from "react";
import { useNavigate } from "react-router-dom";

import client from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const [name, setName] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");
  const auth = useAuth();
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const { data } = await client.post("/auth/login", { name, password });
      auth.login(data.access_token, data.role);
      navigate("/dashboard");
    } catch {
      setError("Invalid credentials");
    }
  }

  return (
    <div className="page center">
      <form className="card" onSubmit={submit}>
        <h1>Restaurant Login</h1>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Username" />
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Password" />
        {error && <p className="error">{error}</p>}
        <button type="submit">Login</button>
      </form>
    </div>
  );
}
