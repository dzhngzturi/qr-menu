// src/App.tsx
import { Route, Routes, Navigate } from "react-router-dom";
import Protected from "./components/Protected";
import PlatformProtected from "./components/PlatformProtected";
import AdminShell from "./components/AdminShell";
import Login from "./pages/Login";
import Categories from "./pages/Categories";
import Dishes from "./pages/Dishes";
import PlatformRestaurants from "./pages/PlatformRestaurants";
import PlatformRestaurantUsers from "./pages/PlatformRestaurantUsers";
import MenuRouter from "./pages/MenuRouter";
import NotFound from "./pages/NotFound";
import AllergensReadOnly from "./pages/AllergensReadOnly";
import Profile from "./pages/Profile";
import { AuthProvider } from "./context/AuthContext";
import Telemetry from "./pages/Telemetry";
import AdminRestaurantGuard from "./components/AdminRestaurantGuard";
import RestaurantLangsPage from "./pages/RestaurantLangs";
import PlatformRestaurantAllergens from "./pages/PlatformRestaurantAllergens";
import PlatformAllergensPage from "./pages/PlatformAllergens";
import Privacy from "./pages/Privacy";

function AdminApp() {
  return (
    <AuthProvider>
      <Routes>
        {/* ✅ Login ВЪТРЕ в /admin */}
        <Route path="login" element={<Login />} />

        <Route
          path="platform"
          element={
            <PlatformProtected>
              <AdminShell />
            </PlatformProtected>
          }
        >
          <Route path="restaurants" element={<PlatformRestaurants />} />
          <Route path="restaurants/:id/users" element={<PlatformRestaurantUsers />} />
          <Route path="restaurants/:slug/allergens" element={<PlatformRestaurantAllergens />} />
          <Route path="allergens" element={<PlatformAllergensPage />} />

        </Route>

        <Route
          path="profile"
          element={
            <PlatformProtected>
              <AdminShell />
            </PlatformProtected>
          }
        >
          <Route index element={<Profile />} />
        </Route>

        <Route
          path="r/:slug"
          element={
            <Protected>
              <AdminRestaurantGuard>
                <AdminShell />
              </AdminRestaurantGuard>
            </Protected>
          }
        >
          <Route path="telemetry" element={<Telemetry />} />
          <Route index element={<Navigate to="categories" replace />} />
          <Route path="categories" element={<Categories />} />
          <Route path="dishes" element={<Dishes />} />
          <Route path="allergens" element={<AllergensReadOnly />} />
          <Route path="langs" element={<RestaurantLangsPage />} />
        </Route>

        {/* ✅ ако някой отвори /admin директно */}
        <Route path="" element={<Navigate to="login" replace />} />

        {/* 404 в admin зоната */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  );
}

export default function App() {
  return (
    <Routes>
      {/* ✅ Публично меню (без AuthProvider) */}
      <Route path="/menu/:slug" element={<MenuRouter />} />
      <Route path="/menu/:slug/c/:cid" element={<MenuRouter />} />
      <Route path="/privacy" element={<Privacy />} />

      {/* ✅ Redirect стария login */}
      <Route path="/login" element={<Navigate to="/admin/login" replace />} />

      {/* ✅ Admin зона */}
      <Route path="/admin/*" element={<AdminApp />} />

      {/* 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
