// src/components/Protected.tsx
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import type { ReactNode } from "react";

export default function Protected({ children }: { children: ReactNode }) {
  const { token, loading } = useAuth();
  const loc = useLocation();

  // 1) Изчакай да приключи /auth/me bootstrap-а
  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center text-gray-600">
        Зареждане…
      </div>
    );
  }

  // 2) Без токен → към /login (запазваме from, ако искаш да върнеш след login)
  if (!token) {
    return <Navigate to="/login" replace state={{ from: loc }} />;
  }

  // 3) ОК
  return <>{children}</>;
}
