// src/components/AdminShell.tsx
import { Link, NavLink, Outlet, useParams, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { toast } from "react-hot-toast";
import Modal from "./Modal";

// 🆕 обща конфигурация за телеметрия (allow-list)
import { isTelemetryEnabledSlug } from "../lib/telemetry-config";

/* ---------- Профил в сайдбара + модал ---------- */
function ProfileInline() {
  const { user, updateProfile, refreshMe } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [saving, setSaving] = useState(false);
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(user?.name || "");
    setEmail(user?.email || "");
  }, [user]);

  const onSave = async () => {
    try {
      setSaving(true);
      await updateProfile({
        name,
        email,
        ...(password ? { password, password_confirmation: password2 } : {}),
      });
      await refreshMe();
      toast.success("Профилът е обновен.");
      setOpen(false);
      setPassword("");
      setPassword2("");
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Грешка при запис.");
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <>
      <div className="mt-3 rounded-lg bg-white/5 px-3 py-2">
        <div className="text-[11px] uppercase tracking-wide text-white/60">
          Моят профил
        </div>
        <div className="mt-1 text-sm">
          <div className="font-medium">{user.name}</div>
          <div className="text-white/70">{user.email}</div>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="mt-2 w-full rounded bg-white/10 px-2 py-1 text-xs hover:bg-white/15"
        >
          Редакция
        </button>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Редакция на профил"
        initialFocusRef={firstInputRef}
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <button
              className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50"
              onClick={() => setOpen(false)}
            >
              Отказ
            </button>
            <button
              className="rounded bg-black text-white px-3 py-1.5 text-sm disabled:opacity-60"
              onClick={onSave}
              disabled={saving}
            >
              {saving ? "Запис..." : "Запази"}
            </button>
          </div>
        }
      >
        <div className="space-y-3 text-neutral-800">
          <div>
            <label className="block text-sm mb-1">Име</label>
            <input
              ref={firstInputRef}
              className="w-full rounded border px-3 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Имейл</label>
            <input
              className="w-full rounded border px-3 py-2"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm mb-1">Нова парола</label>
              <input
                className="w-full rounded border px-3 py-2"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="(по избор)"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Потвърди парола</label>
              <input
                className="w-full rounded border px-3 py-2"
                type="password"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                placeholder="(по избор)"
              />
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}

/* ------------------- Shell ------------------- */
export default function AdminShell() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { isAdmin, logout } = useAuth();

  const [restaurant, setRestaurant] = useState<string>("");
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // контролирано поле за "Use"
  const [slugInput, setSlugInput] = useState<string>("");
  const quickSlugRef = useRef<HTMLInputElement>(null);

  // кои ресторанти да скрием Алергените
  const HIDE_ALLERGENS_FOR = new Set<string>(["viva"]);
  const shouldShowAllergens = (slug?: string | null) =>
    !!slug && !HIDE_ALLERGENS_FOR.has(slug.toLowerCase());

  useEffect(() => {
    const fromUrl = slug || "";
    const fromLS =
      localStorage.getItem("restaurant_slug") ||
      localStorage.getItem("restaurant") ||
      "";
    const s = fromUrl || (isAdmin ? fromLS : "");
    setRestaurant(s);
  }, [slug, isAdmin]);

  // когато се смени текущият ресторант – попълваме полето по подразбиране
  useEffect(() => {
    setSlugInput(restaurant || "");
  }, [restaurant]);

  const handleQuickUse = (s?: string) => {
    const v = (s || restaurant || "").trim();
    if (!v) return;
    localStorage.setItem("restaurant_slug", v);
    localStorage.setItem("restaurant", v);
    toast.success(`Избран ресторант: ${v}`);
    navigate(`/admin/r/${v}/categories`);
    setSidebarOpen(false);
    setRestaurant(v);
    setSlugInput(v);
    if (quickSlugRef.current) quickSlugRef.current.blur();
  };

  const doLogout = async () => {
    try {
      await logout();
    } finally {
      // чистим всички наши “ресторантски” данни от localStorage
      try {
        localStorage.removeItem("restaurant_slug");
        localStorage.removeItem("restaurant");
        // ако имаш други ключове свързани с ресторанта / телеметрията – добави ги тук
        // localStorage.removeItem("telemetry_session_id");
      } catch (e) {
        console.warn("Cannot access localStorage on logout:", e);
      }

      // нулираме и локалния state, за да не остава стар slug в UI
      setRestaurant("");
      setSlugInput("");

      setLogoutOpen(false);
      navigate("/login", { replace: true });
    }
  };


  const showPlatformTools = isAdmin === true;

  // 🆕 тук ползваме allow-list-а за телеметрия
  const telemetryEnabled = isTelemetryEnabledSlug(restaurant);

  /* ---------- Sidebar (общо съдържание) ---------- */
  const SidebarContent = (
    <>
      <div className="px-4 py-4 border-b border-white/10">
        <Link
          to={showPlatformTools ? "/admin/platform/restaurants" : "#"}
          className="text-lg font-semibold"
          onClick={() => setSidebarOpen(false)}
        >
          Admin
        </Link>

        {!showPlatformTools && <ProfileInline />}

        {showPlatformTools && (
          <div className="mt-3 text-xs text-white/80 space-y-2">
            <div>
              Ресторант:{" "}
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-2 py-0.5">
                <strong>{restaurant || "(не е избран)"}</strong>
              </span>
            </div>

            {/* Смени / Use – контролиран input + надежден submit */}
            <form
              className="flex items-center gap-2 relative z-[200] pointer-events-auto"
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const v = (slugInput || restaurant || "").trim();
                if (!v) {
                  toast.error("Въведи slug на ресторанта.");
                  return;
                }
                handleQuickUse(v);
              }}
              onClickCapture={(e) => e.stopPropagation()}
              onPointerDownCapture={(e) => e.stopPropagation()}
              onTouchStartCapture={(e) => e.stopPropagation()}
            >
              <span className="text-[11px]">Смени</span>

              <input
                ref={quickSlugRef}
                name="slug"
                className="w-28 rounded bg-white/10 px-2 py-1 text-[11px] placeholder-white/40 outline-none"
                placeholder="slug..."
                value={slugInput}
                onChange={(e) => setSlugInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    e.stopPropagation();
                    (e.currentTarget as HTMLInputElement).blur();
                    const v = (slugInput || restaurant || "").trim();
                    if (!v) return;
                    handleQuickUse(v);
                  }
                }}
              />

              <button
                type="submit"
                className="select-none rounded bg-white/10 px-2 py-1 text-[11px] hover:bg-white/15 active:bg-white/20
                           focus:outline-none focus:ring-2 focus:ring-white/30 touch-manipulation"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                onTouchEnd={(e) => e.stopPropagation()}
              >
                Use
              </button>
            </form>
          </div>
        )}
      </div>

      <nav className="px-2 py-3 space-y-1">
        {/* 🆕 Линкът Телеметрия се показва само ако allow-list казва ОК */}
        {restaurant && telemetryEnabled && (
          <NavLink
            to={`/admin/r/${restaurant}/telemetry`}
            className={({ isActive }) =>
              `block rounded px-4 py-2 text-sm ${isActive ? "bg-white/10 font-medium" : "hover:bg-white/5"
              }`
            }
            onClick={() => setSidebarOpen(false)}
          >
            Телеметрия
          </NavLink>
        )}

        <NavLink
          to={
            restaurant
              ? `/admin/r/${restaurant}/categories`
              : "/admin/platform/restaurants"
          }
          className={({ isActive }) =>
            `block rounded px-4 py-2 text-sm ${isActive ? "bg-white/10 font-medium" : "hover:bg-white/5"
            }`
          }
          onClick={() => setSidebarOpen(false)}
        >
          Категории
        </NavLink>

        <NavLink
          to={
            restaurant
              ? `/admin/r/${restaurant}/dishes`
              : "/admin/platform/restaurants"
          }
          className={({ isActive }) =>
            `block rounded px-4 py-2 text-sm ${isActive ? "bg-white/10 font-medium" : "hover:bg-white/5"
            }`
          }
          onClick={() => setSidebarOpen(false)}
        >
          Ястия
        </NavLink>

        {shouldShowAllergens(restaurant) && (
          <NavLink
            to={
              restaurant
                ? `/admin/r/${restaurant}/allergens`
                : "/admin/platform/restaurants"
            }
            className={({ isActive }) =>
              `block rounded px-4 py-2 text-sm ${isActive ? "bg-white/10 font-medium" : "hover:bg-white/5"
              }`
            }
            onClick={() => setSidebarOpen(false)}
          >
            Алергени
          </NavLink>
        )}

        {showPlatformTools && (
          <>
            <div className="mt-4 px-4 text-[11px] uppercase tracking-wide text-white/50">
              Платформа
            </div>
            <NavLink
              to="/admin/platform/restaurants"
              className={({ isActive }) =>
                `block rounded px-4 py-2 text-sm ${isActive ? "bg-white/10 font-medium" : "hover:bg-white/5"
                }`
              }
              onClick={() => setSidebarOpen(false)}
            >
              Ресторанти
            </NavLink>

            <NavLink
              to="/admin/profile"
              className={({ isActive }) =>
                `block rounded px-4 py-2 text-sm ${isActive ? "bg-white/10 font-medium" : "hover:bg-white/5"
                }`
              }
              onClick={() => setSidebarOpen(false)}
            >
              Профил
            </NavLink>
          </>
        )}
      </nav>
    </>
  );

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Off-canvas sidebar (mobile) */}
      <div
        className={`fixed inset-0 z-[60] lg:hidden ${sidebarOpen ? "" : "pointer-events-none"
          }`}
      >
        {/* backdrop */}
        <div
          className={`absolute inset-0 bg-black/40 transition-opacity z-[60] ${sidebarOpen ? "opacity-100" : "opacity-0"
            }`}
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
        {/* panel */}
        <aside
          className={`absolute left-0 top-0 h-full w-72 bg-[#0f172a] text-white
                      transform transition-transform z-[80] pointer-events-auto
                      ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
          role="dialog"
          aria-label="Sidebar"
          onClick={(e) => e.stopPropagation()}
        >
          {SidebarContent}
        </aside>
      </div>

      {/* Static sidebar (>= lg) */}
      <aside className="hidden lg:block w-64 bg-[#0f172a] text-white flex-shrink-0">
        {SidebarContent}
      </aside>

      {/* Content column */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <header className="h-14 bg-white border-b flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            {/* hamburger */}
            <button
              className="lg:hidden inline-flex h-9 w-9 items-center justify-center rounded-md border hover:bg-gray-50"
              onClick={() => setSidebarOpen(true)}
              aria-label="Отвори меню"
            >
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M3 6h18v2H3V6m0 5h18v2H3v-2m0 5h18v2H3v-2"
                />
              </svg>
            </button>
            <h1 className="text-lg font-semibold">Админ панел</h1>
          </div>
          <button
            onClick={() => setLogoutOpen(true)}
            className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50"
            title="Изход"
          >
            Изход
          </button>
        </header>

        <main className="p-4 lg:p-8 h-[calc(100vh-56px)] overflow-auto">
          <Outlet />
        </main>
      </div>

      {/* Confirm Logout */}
      <Modal
        open={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        title="Излизане"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <button
              className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50"
              onClick={() => setLogoutOpen(false)}
            >
              Отказ
            </button>
            <button
              className="rounded bg-black text-white px-3 py-1.5 text-sm"
              onClick={doLogout}
            >
              Излез
            </button>
          </div>
        }
      >
        <div className="text-neutral-800">
          Сигурни ли сте, че искате да излезете?
        </div>
      </Modal>
    </div>
  );
}
