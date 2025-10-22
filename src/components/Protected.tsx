// src/components/Protected.tsx
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import type { ReactNode } from "react";

export default function Protected({ children }: { children: ReactNode }) {
  const { token } = useAuth();          // ⬅️ само токен
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
