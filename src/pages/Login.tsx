// src/pages/Login.tsx
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "../context/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import { useState } from "react";

const schema = z.object({ email: z.string().email(), password: z.string().min(1) });

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [err, setErr] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<{ email: string; password: string }>({ resolver: zodResolver(schema) });

  // помощна – чете ?restaurant= от URL, ако има
  const getRestaurantFromQuery = () => {
    const q = new URLSearchParams(loc.search);
    return q.get("restaurant") || undefined;
  };

  return (
    <div className="min-h-screen grid place-items-center">
      <form
        onSubmit={handleSubmit(async (v) => {
          setErr(null);
          clearErrors(); // чисти предишни field грешки
          try {
            const { is_admin } = await login(v.email, v.password);
            localStorage.setItem("is_admin", String(!!is_admin));

            if (is_admin) {
              nav("/admin/platform/restaurants", { replace: true });
            } else {
              const fromUrl = getRestaurantFromQuery();
              const fromStorage = localStorage.getItem("restaurant") || undefined;
              const slug = fromUrl || fromStorage;
              nav(slug ? `/admin/r/${slug}/categories` : "/admin/platform/restaurants", { replace: true });
            }
          } catch (e: any) {
            const res = e?.response;
            const data = res?.data;

            // 429: заключено от бекенда (RateLimiter)
            if (res?.status === 429) {
              setErr(data?.message || "Твърде много опита. Опитайте по-късно.");
              return;
            }

            // 422: валидационни грешки от Laravel (ValidationException)
            if (res?.status === 422) {
              const serverErrors = data?.errors;
              if (serverErrors && typeof serverErrors === "object") {
                Object.entries(serverErrors).forEach(([field, msgs]) => {
                  const msg = Array.isArray(msgs) ? msgs[0] : String(msgs);
                  // опитай да сетнеш по име на поле; ако е друго, сложи под email
                  if (field === "email" || field === "password") {
                    setError(field as "email" | "password", { type: "server", message: msg });
                  } else {
                    setError("email", { type: "server", message: msg });
                  }
                });
                setErr(null); // показваме грешките под полетата
                return;
              }
              // ако няма errors{}, но има message
              if (data?.message) {
                setError("email", { type: "server", message: data.message });
                setErr(null);
                return;
              }
            }

            // други (401/403/500…)
            setErr(data?.message || "Грешен имейл/парола");
          }
        })}
        className="w-full max-w-sm border rounded p-6 space-y-4 bg-white"
      >
        <h1 className="text-xl font-semibold">Админ вход</h1>

        {err && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">
            {err}
          </div>
        )}

        <div>
          <label className="block mb-1" htmlFor="email">Имейл</label>
          <input
            id="email"
            className={`w-full border rounded p-2 ${errors.email ? "border-red-500" : ""}`}
            autoComplete="email"
            disabled={isSubmitting}
            {...register("email")}
          />
          {errors.email && <p className="text-sm text-red-600">{errors.email.message}</p>}
        </div>

        <div>
          <label className="block mb-1" htmlFor="password">Парола</label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              className={`w-full border rounded p-2 pr-10 ${errors.password ? "border-red-500" : ""}`}
              autoComplete="current-password"
              disabled={isSubmitting}
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              onMouseDown={(e) => e.preventDefault()}
              aria-label={showPassword ? "Скрий паролата" : "Покажи паролата"}
              title={showPassword ? "Скрий паролата" : "Покажи паролата"}
              className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-500 hover:text-gray-700 focus:outline-none"
              disabled={isSubmitting}
            >
              {showPassword ? (
                // eye-off
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 3l18 18" />
                  <path d="M10.6 10.6A2 2 0 0012 14a2 2 0 001.4-3.4" />
                  <path d="M2 12s4-7 10-7c2.1 0 3.9.6 5.4 1.5M21.5 12c-.6 1.5-1.6 2.9-2.8 4" />
                </svg>
              ) : (
                // eye
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
          disabled={isSubmitting}
          className="w-full bg-black text-white py-2 rounded disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSubmitting ? "Влизане..." : "Влез"}
        </button>
      </form>
    </div>
  );
}
