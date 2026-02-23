// src/context/AuthContext.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";
import api from "../lib/api";

type User = { id: number; name: string; email: string };
type RestaurantLite = { id: number; slug: string; name: string } | null;

type LoginResponse = {
  token: string;
  is_admin: boolean;
  user: User;
  restaurant?: RestaurantLite; // backend може да НЕ го връща при login()
};

type UpdatePayload = {
  name?: string;
  email?: string;
  password?: string;
  password_confirmation?: string;
};

type AuthCtx = {
  token: string | null;
  isAdmin: boolean;
  user: User | null;
  restaurant: RestaurantLite;
  loading: boolean;

  login: (email: string, password: string) => Promise<LoginResponse>;
  logout: () => Promise<void>;

  refreshMe: () => Promise<void>;
  updateProfile: (data: UpdatePayload) => Promise<void>;
};

const Ctx = createContext<AuthCtx>({} as any);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));

  // ✅ НЕ четем is_admin от localStorage
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  const [user, setUser] = useState<User | null>(null);

  // ✅ ако имаш запазен slug, зареди го в state, за да не е null при първи render
  const [restaurant, setRestaurant] = useState<RestaurantLite>(() => {
    const slug = localStorage.getItem("restaurant_slug") || localStorage.getItem("restaurant");
    return slug ? ({ id: 0, slug, name: "" } as any) : null;
  });

  const [loading, setLoading] = useState<boolean>(true);

  // централизирано прилагане/чистене на токена
  const applyToken = useCallback((t: string | null) => {
    if (t) {
      localStorage.setItem("token", t);
      api.defaults.headers.common["Authorization"] = `Bearer ${t}`;
      setToken(t);
    } else {
      localStorage.removeItem("token");
      delete api.defaults.headers.common["Authorization"];
      setToken(null);
    }
  }, []);

  const persistRestaurant = useCallback((r: RestaurantLite) => {
    setRestaurant(r);
    const slug = r?.slug;

    if (slug) {
      localStorage.setItem("restaurant_slug", slug);
      localStorage.setItem("restaurant", slug); // legacy
    } else {
      localStorage.removeItem("restaurant_slug");
      localStorage.removeItem("restaurant");
    }
  }, []);

  const refreshMe: AuthCtx["refreshMe"] = useCallback(async () => {
    if (!token) {
      setUser(null);
      setIsAdmin(false);
      persistRestaurant(null);
      return;
    }

    try {
      const res = await api.get("/auth/me");

      // backend: { user: {...}, is_admin: bool, restaurant: {...}|null }
      const nextUser: User | null = res.data?.user ?? null;
      const nextIsAdmin = !!res.data?.is_admin;
      const nextRestaurant: RestaurantLite =
        typeof res.data?.restaurant !== "undefined" ? (res.data.restaurant ?? null) : null;

      setUser(nextUser);
      setIsAdmin(nextIsAdmin);

      // ❌ НЕ записваме is_admin в localStorage
      // localStorage.setItem("is_admin", String(nextIsAdmin));

      // ✅ истината за restaurant идва от /auth/me
      persistRestaurant(nextRestaurant);
    } catch {
      // токенът е невалиден
      applyToken(null);
      setUser(null);
      setIsAdmin(false);
      persistRestaurant(null);
    }
  }, [token, applyToken, persistRestaurant]);

  const login: AuthCtx["login"] = useCallback(
    async (email, password) => {
      // 1) login -> взимаме token
      const { data } = await api.post<LoginResponse>("/auth/login", { email, password });

      applyToken(data.token);

      // ✅ (по желание) изчисти стар ключ, ако е останал от преди версии
      localStorage.removeItem("is_admin");

      // 2) веднага sync с /auth/me за да вземем правилните is_admin + restaurant
      await refreshMe();

      return data;
    },
    [applyToken, refreshMe]
  );

  const logout: AuthCtx["logout"] = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {}

    applyToken(null);

    // ✅ чистим (legacy)
    localStorage.removeItem("is_admin");

    setIsAdmin(false);
    setUser(null);
    persistRestaurant(null);
  }, [applyToken, persistRestaurant]);

  const updateProfile: AuthCtx["updateProfile"] = useCallback(async (payload) => {
    const res = await api.patch("/auth/me", payload);
    if (res.data?.user) setUser(res.data.user);
  }, []);

  // Bootstrap – при наличие на токен възстанови състояние чрез /auth/me
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // ✅ ако има стар is_admin от преди, махни го още при старт
        localStorage.removeItem("is_admin");

        if (token) {
          api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
          await refreshMe();
        } else {
          setUser(null);
          setIsAdmin(false);
          persistRestaurant(null);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [token, refreshMe, persistRestaurant]);

  const value = useMemo<AuthCtx>(
    () => ({
      token,
      isAdmin,
      user,
      restaurant,
      loading,
      login,
      logout,
      refreshMe,
      updateProfile,
    }),
    [token, isAdmin, user, restaurant, loading, login, logout, refreshMe, updateProfile]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
