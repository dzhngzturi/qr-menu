// src/components/AdminShell.tsx
import { Link, NavLink, Outlet, useParams, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { toast } from "react-hot-toast";
import Modal from "./Modal";
import { useTranslation } from "react-i18next";
import LanguageSwitcherFancy from "./LanguageSwitcherFancy";

import { apiAdmin } from "../lib/api"; // ✅ for sidebar allergens check + check-restaurant

import i18n, { type AppLang } from "../i18n";
import { fetchUiLangs } from "../services/uiLangs";

/* ---------- Профил в сайдбара + модал ---------- */
function ProfileInline() {
  const { t } = useTranslation();
  const { user, updateProfile, refreshMe } = useAuth();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [saving, setSaving] = useState(false);
  const firstInputRef = useRef<HTMLInputElement>(null);

  const nameId = "sidebar-profile-name";
  const emailId = "sidebar-profile-email";
  const passId = "sidebar-profile-password";
  const pass2Id = "sidebar-profile-password2";

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
      toast.success(t("admin.profile.updated"));
      setOpen(false);
      setPassword("");
      setPassword2("");
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t("admin.common.save_error"));
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <>
      <div className="mt-3 rounded-lg bg-white/5 px-3 py-2">
        <div className="text-[11px] uppercase tracking-wide text-white/60">
          {t("admin.profile.my_profile")}
        </div>

        <div className="mt-1 text-sm">
          <div className="font-medium">{user.name}</div>
          <div className="text-white/70">{user.email}</div>
        </div>

        <button
          onClick={() => setOpen(true)}
          className="mt-2 w-full rounded bg-white/10 px-2 py-1 text-xs hover:bg-white/15"
        >
          {t("admin.common.edit")}
        </button>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t("admin.profile.edit_title")}
        initialFocusRef={firstInputRef}
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <button
              className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50"
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              {t("admin.common.cancel")}
            </button>

            <button
              className="rounded bg-black text-white px-3 py-1.5 text-sm disabled:opacity-60"
              onClick={onSave}
              disabled={saving}
            >
              {saving ? t("admin.common.saving") : t("admin.common.save")}
            </button>
          </div>
        }
      >
        <div className="space-y-3 text-neutral-800">
          <div>
            <label className="block text-sm mb-1" htmlFor={nameId}>
              {t("admin.profile.name")}
            </label>
            <input
              id={nameId}
              ref={firstInputRef}
              className="w-full rounded border px-3 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              disabled={saving}
            />
          </div>

          <div>
            <label className="block text-sm mb-1" htmlFor={emailId}>
              {t("admin.profile.email")}
            </label>
            <input
              id={emailId}
              className="w-full rounded border px-3 py-2"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              disabled={saving}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm mb-1" htmlFor={passId}>
                {t("admin.profile.new_password")}
              </label>
              <input
                id={passId}
                className="w-full rounded border px-3 py-2"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("admin.profile.optional")}
                autoComplete="new-password"
                disabled={saving}
              />
            </div>

            <div>
              <label className="block text-sm mb-1" htmlFor={pass2Id}>
                {t("admin.profile.confirm_password")}
              </label>
              <input
                id={pass2Id}
                className="w-full rounded border px-3 py-2"
                type="password"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                placeholder={t("admin.profile.optional")}
                autoComplete="new-password"
                disabled={saving}
              />
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}

/* ------------------- Shell ------------------- */
function normalizeLang(raw: unknown): AppLang {
  const v = String(raw ?? "").trim().toLowerCase();
  if (!v) return "bg";
  const base = v.split("-")[0];
  return (base || "bg") as AppLang;
}

async function applyUiLang(lang: AppLang) {
  localStorage.setItem("lang", lang);
  await i18n.changeLanguage(lang);
  document.documentElement.lang = lang;
}

export default function AdminShell() {
  const { t } = useTranslation();
  const { slug } = useParams();
  const navigate = useNavigate();
  const { isAdmin, logout } = useAuth();

  const [restaurant, setRestaurant] = useState<string>("");
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [slugInput, setSlugInput] = useState<string>("");
  const quickSlugRef = useRef<HTMLInputElement>(null);
  const quickSlugId = "admin-quick-slug";

  // ✅ UI langs controlled by superadmin per restaurant
  const [uiLangs, setUiLangs] = useState<AppLang[]>(["bg"]);
  const [uiDefaultLang, setUiDefaultLang] = useState<AppLang>("bg");

  // ✅ gate: DO NOT render sidebar/pages until i18n language is applied
  const [uiLangReady, setUiLangReady] = useState(false);

  // ✅ show Allergens link only if API returns non-empty list
  const [hasAllergens, setHasAllergens] = useState(false);

  // ✅ NEW: show Telemetry only if API says telemetry_enabled=true for this restaurant
  const [telemetryEnabled, setTelemetryEnabled] = useState(false);

  useEffect(() => {
    const fromUrl = slug || "";
    const fromLS =
      localStorage.getItem("restaurant_slug") ||
      localStorage.getItem("restaurant") ||
      "";
    const s = fromUrl || (isAdmin ? fromLS : "");
    setRestaurant(s);
  }, [slug, isAdmin]);

  useEffect(() => {
    setSlugInput(restaurant || "");
  }, [restaurant]);

  // ✅ Load ui langs for this restaurant (and APPLY language BEFORE render)
  useEffect(() => {
    let mounted = true;

    (async () => {
      setUiLangReady(false);

      // if no restaurant selected -> default bg (and wait)
      if (!restaurant) {
        try {
          setUiLangs(["bg"]);
          setUiDefaultLang("bg");

          const cur = normalizeLang(i18n.language);
          if (cur !== "bg") await applyUiLang("bg");
        } finally {
          if (mounted) setUiLangReady(true);
        }
        return;
      }

      try {
        const res = await fetchUiLangs(restaurant);

        const list = (res.ui_langs ?? [])
          .map((x: any) => normalizeLang(x))
          .filter(Boolean) as AppLang[];

        const safeLangs: AppLang[] = list.length ? Array.from(new Set(list)) : ["bg"];

        const def = normalizeLang(res.ui_default_lang || safeLangs[0] || "bg");
        const safeDef: AppLang = safeLangs.includes(def) ? def : safeLangs[0];

        if (!mounted) return;

        setUiLangs(safeLangs);
        setUiDefaultLang(safeDef);

        // Decide what to apply:
        // - keep current if allowed
        // - else apply default from backend
        const cur = normalizeLang(i18n.language);
        const target = safeLangs.includes(cur) ? cur : safeDef;

        await applyUiLang(target);

        if (!mounted) return;
        setUiLangReady(true);
      } catch {
        // fallback: bg
        try {
          if (!mounted) return;

          setUiLangs(["bg"]);
          setUiDefaultLang("bg");

          const cur = normalizeLang(i18n.language);
          if (cur !== "bg") await applyUiLang("bg");
        } finally {
          if (mounted) setUiLangReady(true);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [restaurant]);

  // ✅ Check allergens availability for sidebar
  useEffect(() => {
    let mounted = true;

    (async () => {
      if (!restaurant) {
        setHasAllergens(false);
        return;
      }

      try {
        const { data } = await apiAdmin.get<{ data: any[] }>("allergens", {
          params: { restaurant }, // resolve.restaurant uses ?restaurant=slug
        });

        if (!mounted) return;
        setHasAllergens(Array.isArray(data?.data) && data.data.length > 0);
      } catch {
        if (!mounted) return;
        setHasAllergens(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [restaurant]);

  // ✅ NEW: Check telemetry flag (DB truth) for sidebar
  useEffect(() => {
    let mounted = true;

    (async () => {
      if (!restaurant) {
        setTelemetryEnabled(false);
        return;
      }

      try {
        const { data } = await apiAdmin.get("auth/check-restaurant", {
          params: { restaurant }, // resolve.restaurant uses ?restaurant=slug
        });

        if (!mounted) return;
        setTelemetryEnabled(!!data?.restaurant?.telemetry_enabled);
      } catch {
        if (!mounted) return;
        setTelemetryEnabled(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [restaurant]);

  const handleQuickUse = (s?: string) => {
    const v = (s || restaurant || "").trim();
    if (!v) return;

    localStorage.setItem("restaurant_slug", v);
    localStorage.setItem("restaurant", v);

    toast.success(t("admin.shell.selected_restaurant", { slug: v }));
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
      try {
        localStorage.removeItem("restaurant_slug");
        localStorage.removeItem("restaurant");
      } catch (e) {
        console.warn("Cannot access localStorage on logout:", e);
      }

      setRestaurant("");
      setSlugInput("");
      setLogoutOpen(false);

      navigate("/login", { replace: true });
    }
  };

  const showPlatformTools = isAdmin === true;

  /* ---------- Sidebar (общо съдържание) ---------- */
  const SidebarContent = (
    <>
      <div className="px-4 py-4 border-b border-white/10">
        <div className="flex items-center justify-between gap-2">
          <Link
            to={showPlatformTools ? "/admin/platform/restaurants" : "#"}
            className="text-lg font-semibold leading-tight"
            onClick={() => setSidebarOpen(false)}
          >
            {t("admin.shell.title")}
          </Link>

          <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/10 text-white/70">
            Admin
          </span>
        </div>

        <ProfileInline />

        {showPlatformTools && (
          <div className="mt-3 text-xs text-white/80 space-y-2">
            <div>
              {t("admin.shell.restaurant")}:{" "}
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-2 py-0.5">
                <strong>{restaurant || t("admin.shell.not_selected")}</strong>
              </span>
            </div>

            <form
              className="flex items-center gap-2 relative z-[200] pointer-events-auto"
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const v = (slugInput || restaurant || "").trim();
                if (!v) {
                  toast.error(t("admin.shell.enter_slug"));
                  return;
                }
                handleQuickUse(v);
              }}
              onClickCapture={(e) => e.stopPropagation()}
              onPointerDownCapture={(e) => e.stopPropagation()}
              onTouchStartCapture={(e) => e.stopPropagation()}
            >
              <label className="text-[11px]" htmlFor={quickSlugId}>
                {t("admin.shell.change")}
              </label>

              <input
                id={quickSlugId}
                ref={quickSlugRef}
                name="slug"
                autoComplete="off"
                className="w-28 rounded bg-white/10 px-2 py-1 text-[11px] placeholder-white/40 outline-none"
                placeholder={t("admin.shell.slug_placeholder")}
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
                {t("admin.shell.use")}
              </button>
            </form>
          </div>
        )}
      </div>

      <nav className="px-2 py-3 space-y-1">
        {restaurant && telemetryEnabled && (
          <NavLink
            to={`/admin/r/${restaurant}/telemetry`}
            className={({ isActive }) =>
              `block rounded px-4 py-2 text-sm ${isActive ? "bg-white/10 font-medium" : "hover:bg-white/5"
              }`
            }
            onClick={() => setSidebarOpen(false)}
          >
            {t("nav.telemetry")}
          </NavLink>
        )}

        <NavLink
          to={restaurant ? `/admin/r/${restaurant}/categories` : "/admin/platform/restaurants"}
          className={({ isActive }) =>
            `block rounded px-4 py-2 text-sm ${isActive ? "bg-white/10 font-medium" : "hover:bg-white/5"
            }`
          }
          onClick={() => setSidebarOpen(false)}
        >
          {t("admin.categories.title")}
        </NavLink>

        <NavLink
          to={restaurant ? `/admin/r/${restaurant}/dishes` : "/admin/platform/restaurants"}
          className={({ isActive }) =>
            `block rounded px-4 py-2 text-sm ${isActive ? "bg-white/10 font-medium" : "hover:bg-white/5"
            }`
          }
          onClick={() => setSidebarOpen(false)}
        >
          {t("nav.dishes")}
        </NavLink>

        {/* ✅ Allergens appears only if API returns a non-empty list */}
        {restaurant && hasAllergens && (
          <NavLink
            to={`/admin/r/${restaurant}/allergens`}
            className={({ isActive }) =>
              `block rounded px-4 py-2 text-sm ${isActive ? "bg-white/10 font-medium" : "hover:bg-white/5"
              }`
            }
            onClick={() => setSidebarOpen(false)}
          >
            {t("nav.allergens")}
          </NavLink>
        )}

        {showPlatformTools && (
          <>
            <div className="mt-4 px-4 text-[11px] uppercase tracking-wide text-white/50">
              {t("nav.platform")}
            </div>

            <NavLink
              to={restaurant ? `/admin/r/${restaurant}/langs` : "/admin/platform/restaurants"}
              className={({ isActive }) =>
                `block rounded px-4 py-2 text-sm ${isActive ? "bg-white/10 font-medium" : "hover:bg-white/5"
                }`
              }
              onClick={() => setSidebarOpen(false)}
            >
              {t("nav.langs")}
            </NavLink>

            <NavLink
              to="/admin/platform/restaurants"
              className={({ isActive }) =>
                `block rounded px-4 py-2 text-sm ${isActive ? "bg-white/10 font-medium" : "hover:bg-white/5"
                }`
              }
              onClick={() => setSidebarOpen(false)}
            >
              {t("nav.restaurants")}
            </NavLink>

            <NavLink
              to="/admin/profile"
              className={({ isActive }) =>
                `block rounded px-4 py-2 text-sm ${isActive ? "bg-white/10 font-medium" : "hover:bg-white/5"
                }`
              }
              onClick={() => setSidebarOpen(false)}
            >
              {t("admin.profile.my_profile")}
            </NavLink>

            <NavLink
              to="/admin/platform/allergens"
              className={({ isActive }) =>
                `block rounded px-4 py-2 text-sm ${isActive ? "bg-white/10 font-medium" : "hover:bg-white/5"
                }`
              }
              onClick={() => setSidebarOpen(false)}
            >
              {t("nav.platform_allergens")}
            </NavLink>
          </>
        )}
      </nav>
    </>
  );

  // ✅ Gate: avoid BG flash (don’t render UI until language is applied)
if (!uiLangReady) {
  return (
    <div className="min-h-[60vh] grid place-items-center">
      <div className="h-10 w-10 rounded-full border-4 border-gray-300 border-t-black animate-spin" />
    </div>
  );
}

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Off-canvas sidebar (mobile) */}
      <div className={`fixed inset-0 z-[60] lg:hidden ${sidebarOpen ? "" : "pointer-events-none"}`}>
        <div
          className={`absolute inset-0 bg-black/40 transition-opacity z-[60] ${sidebarOpen ? "opacity-100" : "opacity-0"
            }`}
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
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

      {/* Static sidebar */}
      <aside className="hidden lg:block w-64 bg-[#0f172a] text-white flex-shrink-0">
        {SidebarContent}
      </aside>

      {/* Content */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <header className="h-14 bg-white border-b flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <button
              className="lg:hidden inline-flex h-9 w-9 items-center justify-center rounded-md border hover:bg-gray-50"
              onClick={() => setSidebarOpen(true)}
              aria-label={t("admin.shell.open_menu")}
            >
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path fill="currentColor" d="M3 6h18v2H3V6m0 5h18v2H3v-2m0 5h18v2H3v-2" />
              </svg>
            </button>
          </div>

          {/* Language + Logout (top-right) */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              {uiLangs.length > 1 ? <LanguageSwitcherFancy langs={uiLangs} /> : null}
            </div>

            <button
              onClick={() => setLogoutOpen(true)}
              className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50"
              title={t("admin.shell.logout")}
            >
              {t("admin.shell.logout")}
            </button>
          </div>
        </header>

        <main className="p-4 lg:p-8 h-[calc(100vh-56px)] overflow-auto">
          <Outlet />
        </main>
      </div>

      {/* Confirm Logout */}
      <Modal
        open={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        title={t("admin.shell.logout_title")}
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <button
              className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50"
              onClick={() => setLogoutOpen(false)}
            >
              {t("admin.common.cancel")}
            </button>

            <button className="rounded bg-black text-white px-3 py-1.5 text-sm" onClick={doLogout}>
              {t("admin.shell.logout")}
            </button>
          </div>
        }
      >
        <div className="text-neutral-800">{t("admin.shell.logout_confirm")}</div>
      </Modal>
    </div>
  );
}