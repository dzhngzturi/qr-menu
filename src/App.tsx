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

// ⬇️ НОВО
import { AuthProvider } from "./context/AuthContext";
import Profile from "./pages/Profile";

export default function App() {
  return (
    <Routes>
      {/* Login – нужен е AuthProvider */}
      <Route
        path="/login"
        element={
          <AuthProvider>
            <Login />
          </AuthProvider>
        }
      />

      {/* Платформа – само супер админ */}
      <Route
        path="/admin/platform"
        element={
          <AuthProvider>
            <PlatformProtected>
              <AdminShell />
            </PlatformProtected>
          </AuthProvider>
        }
      >
        <Route path="restaurants" element={<PlatformRestaurants />} />
        <Route path="restaurants/:id/users" element={<PlatformRestaurantUsers />} />
      </Route>

      <Route
        path="/admin/profile"
        element={
          <AuthProvider>
            <PlatformProtected>
              <AdminShell />
            </PlatformProtected>
          </AuthProvider>
        }
      >
        <Route index element={<Profile />} />
      </Route>


      {/* Ресторантски контекст */}
      <Route
        path="/admin/r/:slug"
        element={
          <AuthProvider>
            <Protected>
              <AdminShell />
            </Protected>
          </AuthProvider>
        }
      >
        <Route index element={<Navigate to="categories" replace />} />
        <Route path="categories" element={<Categories />} />
        <Route path="dishes" element={<Dishes />} />
        <Route path="allergens" element={<Allergens />} />
      </Route>

      {/* Публично меню – БЕЗ AuthProvider */}
      <Route path="/menu/:slug" element={<MenuRouter />} />
      <Route path="/menu/:slug/c/:cid" element={<MenuRouter />} />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
