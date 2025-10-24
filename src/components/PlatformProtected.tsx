// src/components/PlatformProtected.tsx
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function PlatformProtected({ children }: { children: React.ReactNode }) {
  const { token, isAdmin, restaurant, loading } = useAuth(); // 👈 взимаме restaurant от контекста
  const loc = useLocation();

  // 1) изчакай bootstrap (/auth/me)
  if (loading) {
    return <div className="min-h-screen grid place-items-center text-gray-600">Зареждане…</div>;
  }

  // 2) без токен → към login
  if (!token) {
    return <Navigate to="/login" replace state={{ from: loc }} />;
  }

  // 3) не е супер-админ → прати го към неговия ресторант (НЕ от URL)
  if (!isAdmin) {
    const slug =
      restaurant?.slug ||                         // 🔹 основният източник
      localStorage.getItem("restaurant_slug") ||   // 🔹 резервно (за refresh)
      localStorage.getItem("restaurant") || "";    //   legacy ключ

    return slug
      ? <Navigate to={`/admin/r/${slug}/categories`} replace />
      : <Navigate to="/login" replace />; // няма асоцииран ресторант → безопасен fallback
  }

  // 4) супер-админ → пускаме към платформата
  return <>{children}</>;
}
