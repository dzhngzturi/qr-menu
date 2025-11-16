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
import Allergens from "./pages/Allergens";
import Profile from "./pages/Profile";

// ВАЖНО: един общ AuthProvider
import { AuthProvider } from "./context/AuthContext";
import Telemetry from "./pages/Telemetry";

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Login */}
        <Route path="/login" element={<Login />} />

        {/* Платформа – само супер-админ */}
        <Route
          path="/admin/platform"
          element={
            <PlatformProtected>
              <AdminShell />
            </PlatformProtected>
          }
        >
          <Route path="restaurants" element={<PlatformRestaurants />} />
          <Route path="restaurants/:id/users" element={<PlatformRestaurantUsers />} />
        </Route>

        {/* Профил (примерно само за логнати; ако е само за супер-админ — остави PlatformProtected) */}
        <Route
          path="/admin/profile"
          element={
            <PlatformProtected>
              <AdminShell />
            </PlatformProtected>
          }
        >
          <Route index element={<Profile />} />
        </Route>

        {/* Ресторантски контекст – логнат потребител */}
        <Route
          path="/admin/r/:slug"
          element={
            <Protected>
              <AdminShell />
            </Protected>
          }
        >
          <Route path="telemetry" element={<Telemetry />} /> 
          <Route index element={<Navigate to="categories" replace />} />
          <Route path="categories" element={<Categories />} />
          <Route path="dishes" element={<Dishes />} />
          <Route path="allergens" element={<Allergens />} />
        </Route>

        {/* Публично меню */}
        <Route path="/menu/:slug" element={<MenuRouter />} />
        <Route path="/menu/:slug/c/:cid" element={<MenuRouter />} />

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  );
}
