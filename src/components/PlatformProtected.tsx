// src/components/PlatformProtected.tsx
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function PlatformProtected({ children }: { children: React.ReactNode }) {
  const { token, isAdmin } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  if (!isAdmin) {
    const slug = localStorage.getItem("restaurant") || "";
    return slug
      ? <Navigate to={`/admin/r/${slug}/categories`} replace />
      : <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}
