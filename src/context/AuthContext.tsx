import { createContext, useContext, useEffect, useState } from "react";
import api from "../lib/api";

type User = { id: number; name: string; email: string };

type LoginResponse = {
  token: string;
  is_admin: boolean;
  user: User;
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

  const login: AuthCtx["login"] = async (email, password) => {
    const { data } = await api.post<LoginResponse>("/auth/login", {
      email,
      password,
    });

    // запазваме токен и флаг
    localStorage.setItem("token", data.token);
    localStorage.setItem("is_admin", String(!!data.is_admin));
    setToken(data.token);
    setIsAdmin(!!data.is_admin);
    setUser(data.user);

    return data;
  };

  const logout: AuthCtx["logout"] = async () => {
    try {
      await api.post("/auth/logout");
    } catch {}
    localStorage.removeItem("token");
    localStorage.removeItem("is_admin");
    setToken(null);
    setIsAdmin(false);
    setUser(null);
  };

  const refreshMe: AuthCtx["refreshMe"] = async () => {
    if (!token) return;
    try {
      const res = await api.get("/auth/me");
      // /auth/me може да връща { user, is_admin } или само user – покриваме и двата варианта
      const nextUser = res.data?.user ?? res.data;
      if (nextUser) setUser(nextUser);
      if (typeof res.data?.is_admin !== "undefined") {
        setIsAdmin(!!res.data.is_admin);
        localStorage.setItem("is_admin", String(!!res.data.is_admin));
      }
    } catch {
      // токенът може да е невалиден – изчистваме състоянието
      // (по избор) можеш да извикаш logout()
    }
  };

  const updateProfile: AuthCtx["updateProfile"] = async (payload) => {
    const res = await api.patch("/auth/me", payload);
    // очакваме { user, message }
    if (res.data?.user) setUser(res.data.user);
  };

  // при наличен токен – взимаме профила
  useEffect(() => {
    if (token) refreshMe();
  }, [token]);

  return (
    <Ctx.Provider
      value={{
        token,
        isAdmin,
        user,
        login,
        logout,
        refreshMe,
        updateProfile,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
