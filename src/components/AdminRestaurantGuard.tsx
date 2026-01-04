// src/components/AdminRestaurantGuard.tsx
import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { apiAdmin } from "../lib/api";
import { useAuth } from "../context/AuthContext";

function FullPageLoader({ text = "Проверка на достъп..." }: { text?: string }) {
  return (
    <div className="min-h-[60vh] grid place-items-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 rounded-full border-4 border-gray-300 border-t-black animate-spin" />
        <div className="text-sm text-gray-600">{text}</div>
      </div>
    </div>
  );
}

export default function AdminRestaurantGuard({ children }: { children: React.ReactNode }) {
  const { slug } = useParams<{ slug: string }>();
  const nav = useNavigate();
  const loc = useLocation();
  const { isAdmin, restaurant, loading } = useAuth();

  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function checkAccess() {
      if (!slug) return;

      // Изчакай AuthContext bootstrap-а (refreshMe), иначе може да имаш стари стойности
      if (loading) return;

      // ✅ Ако НЕ е супер-админ и имаме "негов" restaurant в контекста:
      // - ако някой ръчно напише друг slug -> или го пращаме към неговия, или NotFound (ти избираш)
      if (!isAdmin && restaurant?.slug && restaurant.slug !== slug) {
        // Вариант A: маскирай като NotFound
        nav("/not-found", { replace: true });

        // Вариант B (ако предпочиташ): върни го към неговия ресторант
        // nav(`/admin/r/${restaurant.slug}/categories`, { replace: true });

        return;
      }

      setChecking(true);

      try {
        // ✅ /api/admin/auth/check-restaurant
        await apiAdmin.get("auth/check-restaurant", { params: { restaurant: slug } });

        if (cancelled) return;
        setChecking(false);
      } catch (e: any) {
        if (cancelled) return;

        const status = e?.response?.status;

        // 401 -> не е логнат / token expired
        if (status === 401) {
          nav("/login", { replace: true, state: { from: loc.pathname } });
          return;
        }

        // ✅ 403 -> маскираме като NotFound (да не се разбира, че съществува)
        if (status === 403) {
          nav("/not-found", { replace: true });
          return;
        }

        // 404 -> няма такъв ресторант
        if (status === 404) {
          nav("/not-found", { replace: true });
          return;
        }

        // fallback
        nav("/not-found", { replace: true });
      } finally {
        if (!cancelled) setChecking(false);
      }
    }

    checkAccess();
    return () => {
      cancelled = true;
    };
  }, [slug, nav, loc.pathname, isAdmin, restaurant?.slug, loading]);

  if (loading || checking) {
    return <FullPageLoader text="Проверка на достъп..." />;
  }

  return <>{children}</>;
}
