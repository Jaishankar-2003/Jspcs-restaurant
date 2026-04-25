import { createContext, useContext, useMemo, useState } from "react";

type AuthState = { token: string | null; role: string | null };
type AuthContextType = AuthState & {
  login: (token: string, role: string) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
  const [role, setRole] = useState<string | null>(localStorage.getItem("role"));

  const value = useMemo(
    () => ({
      token,
      role,
      login: (nextToken: string, nextRole: string) => {
        localStorage.setItem("token", nextToken);
        localStorage.setItem("role", nextRole);
        setToken(nextToken);
        setRole(nextRole);
      },
      logout: () => {
        localStorage.removeItem("token");
        localStorage.removeItem("role");
        setToken(null);
        setRole(null);
      },
    }),
    [token, role]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("Auth context missing");
  return ctx;
}
