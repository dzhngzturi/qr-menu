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
  restaurant?: RestaurantLite; // 👈 backend да връща това при login()
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
  restaurant: RestaurantLite;      // 👈 вече е в контекста
  loading: boolean;

  login: (email: string, password: string) => Promise<LoginResponse>;
  logout: () => Promise<void>;

  refreshMe: () => Promise<void>;
  updateProfile: (data: UpdatePayload) => Promise<void>;
};

const Ctx = createContext<AuthCtx>({} as any);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(
    localStorage.getItem("token")
  );
  const [isAdmin, setIsAdmin] = useState<boolean>(
    localStorage.getItem("is_admin") === "true"
  );
  const [user, setUser] = useState<User | null>(null);
  const [restaurant, setRestaurant] = useState<RestaurantLite>(null); // 👈
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

  const persistRestaurant = (r: RestaurantLite) => {
    setRestaurant(r);
    const slug = r?.slug;
    if (slug) {
      localStorage.setItem("restaurant_slug", slug);
      localStorage.setItem("restaurant", slug); // legacy ключ за съвместимост
    }
  };

  const login: AuthCtx["login"] = useCallback(
    async (email, password) => {
      const { data } = await api.post<LoginResponse>("/auth/login", {
        email,
        password,
      });

      // токен + header
      applyToken(data.token);
      // флаг за админ
      localStorage.setItem("is_admin", String(!!data.is_admin));
      setIsAdmin(!!data.is_admin);
      // потребител
      setUser(data.user);
      // ресторант (ако не е супер-админ)
      if (typeof data.restaurant !== "undefined") {
        persistRestaurant(data.restaurant ?? null);
      } else {
        setRestaurant(null);
      }

      return data;
    },
    [applyToken]
  );

  const logout: AuthCtx["logout"] = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {}
    applyToken(null);
    localStorage.removeItem("is_admin");
    setIsAdmin(false);
    setUser(null);
    setRestaurant(null);
  }, [applyToken]);

  const refreshMe: AuthCtx["refreshMe"] = useCallback(async () => {
    if (!token) {
      setUser(null);
      setIsAdmin(false);
      setRestaurant(null);
      return;
    }
    try {
      const res = await api.get("/auth/me");
      const nextUser: User = res.data?.user ?? res.data;
      if (nextUser) setUser(nextUser);

      if (typeof res.data?.is_admin !== "undefined") {
        setIsAdmin(!!res.data.is_admin);
        localStorage.setItem("is_admin", String(!!res.data.is_admin));
      }

      if (typeof res.data?.restaurant !== "undefined") {
        // backend връща restaurant и тук
        persistRestaurant(res.data.restaurant ?? null);
      }
    } catch {
      // токенът е невалиден
      applyToken(null);
      setUser(null);
      setIsAdmin(false);
      setRestaurant(null);
    }
  }, [token, applyToken]);

  const updateProfile: AuthCtx["updateProfile"] = useCallback(
    async (payload) => {
      const res = await api.patch("/auth/me", payload);
      if (res.data?.user) setUser(res.data.user);
    },
    []
  );

  // Bootstrap – при наличие на токен възстанови състояние чрез /auth/me
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        if (token) {
          api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
          await refreshMe();
        } else {
          setUser(null);
          setIsAdmin(false);
          setRestaurant(null);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [token, refreshMe]);

  const value = useMemo<AuthCtx>(
    () => ({
      token,
      isAdmin,
      user,
      restaurant, // 👈 expose-нато към гардовете/страниците
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
