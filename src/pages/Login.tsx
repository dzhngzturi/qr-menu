import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import api from "../lib/api";

const schema = z.object({ email: z.string().email(), password: z.string().min(1) });

// ---------- локален lock по email ----------
const lockKey = (email: string) => `login_lock:${email.toLowerCase()}`;
const getLocalLockTs = (email: string) => {
  const raw = localStorage.getItem(lockKey(email));
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
};
const setLocalLockTs = (email: string, untilTs: number) => {
  localStorage.setItem(lockKey(email), String(untilTs));
};

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();

  const [err, setErr] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [cooldownLeft, setCooldownLeft] = useState<number>(0);

  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<{ email: string; password: string }>({ resolver: zodResolver(schema) });

  const emailVal = watch("email") || "";

  // тикер за countdown-а
  useEffect(() => {
    if (!emailVal) {
      setCooldownLeft(0);
      return;
    }

    const checkAndUpdate = () => {
      const now = Date.now();
      const until = getLocalLockTs(emailVal);
      const left = Math.max(0, Math.ceil((until - now) / 1000));
      setCooldownLeft(left);
      if (left <= 0) localStorage.removeItem(lockKey(emailVal));
    };

    checkAndUpdate();

    const id = setInterval(checkAndUpdate, 1000);
    return () => clearInterval(id);
  }, [emailVal]);

  const onSubmit = handleSubmit(async (v) => {
    setErr(null);
    clearErrors();

    // 0) ако имаме локален lock → не пращаме заявка
    const untilTs = getLocalLockTs(v.email);
    if (untilTs > Date.now()) {
      const leftMin = Math.max(1, Math.ceil((untilTs - Date.now()) / 60000));
      setErr(`Акаунтът е временно заключен. Опитай отново след ~${leftMin} мин.`);
      return;
    }

    // ✅ махаме само ресторант slug (не е sensitive), за да няма "наследяване" от предишен логин
    localStorage.removeItem("restaurant_slug");
    localStorage.removeItem("restaurant");

    // ❌ махаме legacy чувствителни ключове (ако са останали от стария flow)
    localStorage.removeItem("token");
    localStorage.removeItem("is_admin");
    localStorage.removeItem("qrmenu_session_id");

    try {
      // ✅ cookie-based login (НЕ връща token)
      await login(v.email, v.password);

      // ✅ след login взимаме истината от /auth/me
      const me = await api.get("/auth/me");
      const isAdmin = !!me.data?.is_admin;

      if (isAdmin) {
        nav("/admin/platform/restaurants", { replace: true });
        return;
      }

      const restaurant = me.data?.restaurant as { slug: string } | null | undefined;
      const slug = restaurant?.slug || "";

      if (!slug) {
        setErr("Потребителят няма асоцииран ресторант.");
        return;
      }

      // ✅ restaurant_slug може да остане в localStorage
      localStorage.setItem("restaurant_slug", slug);
      localStorage.setItem("restaurant", slug);

      nav(`/admin/r/${slug}/categories`, { replace: true });
    } catch (e: any) {
      const res = e?.response;
      const data = res?.data;

      if (res?.status === 429) {
        const retryIn = Number(data?.retry_in || 0);
        const untilIso = data?.locked_until;
        const untilTs2 = untilIso ? Date.parse(untilIso) : Date.now() + Math.max(1, retryIn) * 1000;

        setLocalLockTs(emailVal, untilTs2);
        const leftMin = Math.max(1, Math.ceil((untilTs2 - Date.now()) / 60000));
        setErr(data?.message || `Акаунтът е временно заключен. Опитай след ~${leftMin} мин.`);
        setCooldownLeft(Math.ceil((untilTs2 - Date.now()) / 1000));
        return;
      }

      if (res?.status === 422) {
        const serverErrors = data?.errors;
        if (serverErrors && typeof serverErrors === "object") {
          Object.entries(serverErrors).forEach(([field, msgs]) => {
            const msg = Array.isArray(msgs) ? (msgs as any)[0] : String(msgs);
            if (field === "email" || field === "password") {
              setError(field as "email" | "password", { type: "server", message: msg });
            } else {
              setError("email", { type: "server", message: msg });
            }
          });
          setErr(null);
          return;
        }
        if (data?.message) {
          setError("email", { type: "server", message: data.message });
          setErr(null);
          return;
        }
      }

      setErr(data?.message || "Грешен имейл/парола");
    }
  });

  const disabled = isSubmitting || cooldownLeft > 0;

  return (
    <div className="min-h-screen grid place-items-center">
      <form
        id="login-form"
        noValidate
        onSubmit={onSubmit}
        className="w-full max-w-sm border rounded p-6 space-y-4 bg-white"
      >
        <h1 className="text-xl font-semibold">Админ вход</h1>

        {(err || cooldownLeft > 0) && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">
            {cooldownLeft > 0
              ? `Акаунтът е временно заключен. Остава: ${Math.floor(cooldownLeft / 60)}:${String(
                  cooldownLeft % 60
                ).padStart(2, "0")} мин.`
              : err}
          </div>
        )}

        <div>
          <label className="block mb-1" htmlFor="email">
            Имейл
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            disabled={isSubmitting}
            className={`w-full border rounded p-2 ${errors.email ? "border-red-500" : ""}`}
            {...register("email")}
          />
          {errors.email && <p className="text-sm text-red-600">{errors.email.message}</p>}
        </div>

        <div>
          <label className="block mb-1" htmlFor="password">
            Парола
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              disabled={disabled}
              className={`w-full border rounded p-2 pr-10 ${errors.password ? "border-red-500" : ""}`}
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              onMouseDown={(e) => e.preventDefault()}
              aria-label={showPassword ? "Скрий паролата" : "Покажи паролата"}
              className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-500 hover:text-gray-700"
              disabled={disabled}
            >
              {showPassword ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 3l18 18" />
                  <path d="M10.6 10.6A2 2 0 0012 14a2 2 0 001.4-3.4" />
                  <path d="M2 12s4-7 10-7c2.1 0 3.9.6 5.4 1.5M21.5 12c-.6 1.5-1.6 2.9-2.8 4" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
          {errors.password && <p className="text-sm text-red-600">{errors.password.message}</p>}
        </div>

        <button
          disabled={disabled}
          className="w-full bg-black text-white py-2 rounded disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSubmitting ? "Влизане..." : cooldownLeft > 0 ? "Заключено" : "Влез"}
        </button>
      </form>
    </div>
  );
}
