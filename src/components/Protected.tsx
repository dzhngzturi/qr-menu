// src/components/Protected.tsx
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

export default function Protected({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { token, loading } = useAuth();
  const loc = useLocation();

  // 1) Изчакай да приключи /auth/me bootstrap-а
  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center text-gray-600">
        {t("admin.common.loading")}
      </div>
    );
  }

  // 2) Без токен → към /login
  if (!token) {
    return <Navigate to="/login" replace state={{ from: loc }} />;
  }

  // 3) ОК
  return <>{children}</>;
}
