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

  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<{ email: string; password: string }>({ resolver: zodResolver(schema) });

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
          try {
            // очакваме login() да върне { token, is_admin, user }
            const { is_admin } = await login(v.email, v.password);

            // запази флага за бърз достъп
            localStorage.setItem("is_admin", String(!!is_admin));

            if (is_admin) {
              // супер-админ → платформата
              nav("/admin/platform/restaurants", { replace: true });
            } else {
              // не е супер-админ → ресторантен контекст
              const fromUrl = getRestaurantFromQuery();
              const fromStorage = localStorage.getItem("restaurant") || undefined;
              const slug = fromUrl || fromStorage;

              if (slug) {
                // ако знаем slug → директно в менюто на този ресторант
                nav(`/admin/r/${slug}/categories`, { replace: true });
              } else {
                // няма slug → прати го да избере (или задайте дефолт ако имате)
                nav("/admin/platform/restaurants", { replace: true });
              }
            }
          } catch (e: any) {
            setErr(e?.response?.data?.message || "Грешен имейл/парола");
          }
        })}
        className="w-full max-w-sm border rounded p-6 space-y-4 bg-white"
      >
        <h1 className="text-xl font-semibold">Админ вход</h1>

        <div>
          <label className="block mb-1">Имейл</label>
          <input className="w-full border rounded p-2" {...register("email")} />
          {errors.email && <p className="text-sm text-red-600">{errors.email.message}</p>}
        </div>

        <div>
          <label className="block mb-1">Парола</label>
          <input type="password" className="w-full border rounded p-2" {...register("password")} />
          {errors.password && <p className="text-sm text-red-600">{errors.password.message}</p>}
        </div>

        {err && <p className="text-sm text-red-600">{err}</p>}

        <button disabled={isSubmitting} className="w-full bg-black text-white py-2 rounded">
          {isSubmitting ? "Влизане..." : "Влез"}
        </button>
      </form>
    </div>
  );
}
