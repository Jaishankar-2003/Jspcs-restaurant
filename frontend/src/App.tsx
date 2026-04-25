import { Navigate, Route, Routes } from "react-router-dom";

import { useAuth } from "./context/AuthContext";
import BillingPage from "./pages/BillingPage";
import DashboardPage from "./pages/DashboardPage";
import InventoryPage from "./pages/InventoryPage";
import KitchenPage from "./pages/KitchenPage";
import LoginPage from "./pages/LoginPage";
import MenuPage from "./pages/MenuPage";
import ReportsPage from "./pages/ReportsPage";
import TablesPage from "./pages/TablesPage";
import ActiveOrdersPage from "./pages/ActiveOrdersPage";

function Protected({ children }: { children: JSX.Element }) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/dashboard" element={<Protected><DashboardPage /></Protected>} />
      <Route path="/dashboard/billing" element={<Protected><BillingPage /></Protected>} />
      <Route path="/dashboard/orders" element={<Protected><ActiveOrdersPage /></Protected>} />
      <Route path="/dashboard/kitchen" element={<Protected><KitchenPage /></Protected>} />
      <Route path="/dashboard/tables" element={<Protected><TablesPage /></Protected>} />
      <Route path="/dashboard/inventory" element={<Protected><InventoryPage /></Protected>} />
      <Route path="/dashboard/menu" element={<Protected><MenuPage /></Protected>} />
      <Route path="/dashboard/reports" element={<Protected><ReportsPage /></Protected>} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
