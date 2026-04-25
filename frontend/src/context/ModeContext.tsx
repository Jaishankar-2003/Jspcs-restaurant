import React, { createContext, useContext, useEffect, useState } from "react";
import client from "../api/client";

type Mode = "fast_food" | "restaurant" | "hybrid";

interface ModeContextType {
  mode: Mode;
  loading: boolean;
}

const ModeContext = createContext<ModeContextType | undefined>(undefined);

export const ModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<Mode>("hybrid");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client.get("/health")
      .then(res => {
        setMode(res.data.mode || "hybrid");
      })
      .catch(err => console.error("Failed to fetch mode", err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className={loading ? "loading-overlay" : ""}>
        <ModeContext.Provider value={{ mode, loading }}>
        {children}
        </ModeContext.Provider>
    </div>
  );
};

export const useMode = () => {
  const context = useContext(ModeContext);
  if (!context) throw new Error("useMode must be used within a ModeProvider");
  return context;
};
