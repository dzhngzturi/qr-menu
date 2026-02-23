// src/lib/api.ts
import axios, { AxiosHeaders, type AxiosRequestConfig } from "axios";
import { toast } from "react-hot-toast";
import type { TelemetryOverview } from "./types";

/* ----------------- axios meta typing ----------------- */
declare module "axios" {
  export interface AxiosRequestConfig {
    meta?: {
      silent?: boolean; // ✅ do not toast on error
    };
  }
}

/* ---------- helpers ---------- */
function getRestaurantSlug(): string | undefined {
  const mAdmin = window.location.pathname.match(/\/admin\/r\/([^/]+)/);
  if (mAdmin?.[1]) return mAdmin[1];

  const mMenu = window.location.pathname.match(/\/menu\/([^/]+)/);
  if (mMenu?.[1]) return mMenu[1];

  return undefined;
}

/** normalize url for checks (remove base, ensure no leading slash) */
function normUrl(url: string) {
  return (url || "").replace(/^\/+/, "");
}

/**
 * Public GET: allow unauthenticated only for menu endpoints.
 * (Admin lists MUST go through /admin/* pages with auth.)
 */
const isPublicGet = (method: AxiosRequestConfig["method"], url: string) => {
  const m = (method || "get").toUpperCase();
  if (m !== "GET") return false;

  const u = normUrl(url);
  return /^menu\b/.test(u);
};

const API_BASE = String(import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");
const ADMIN_BASE = `${API_BASE}/admin`;

/* ---------- safe header setters for Axios v1 ---------- */
function setHeader(headers: AxiosRequestConfig["headers"], key: string, val: string) {
  if (!headers) return;
  if (headers instanceof AxiosHeaders) headers.set(key, val);
  else (headers as Record<string, string>)[key] = val;
}

function deleteHeader(headers: AxiosRequestConfig["headers"], key: string) {
  if (!headers) return;
  if (headers instanceof AxiosHeaders) headers.delete?.(key);
  else delete (headers as Record<string, unknown>)[key];
}

/* ---------- interceptors builder ---------- */
function attachInterceptors(
  client: ReturnType<typeof axios.create>,
  opts?: { alwaysAuth?: boolean }
) {
  client.interceptors.request.use((config) => {
    const url = config.url || "";
    const method = config.method;

    // 0) ✅ Rewrite ONLY for public client (NOT for apiAdmin)
    // This prevents breaking /api/admin/* endpoints.
    if (!opts?.alwaysAuth) {
      const slug0 = getRestaurantSlug();
      if (slug0) {
        const [pathOnly, qs] = String(config.url || "").split("?");
        const p = normUrl(pathOnly);

        // rewrite ONLY legacy endpoints (non-menu)
        if (p === "categories") {
          config.url = `/menu/${slug0}/categories${qs ? `?${qs}` : ""}`;
        } else if (p === "dishes") {
          config.url = `/menu/${slug0}/dishes${qs ? `?${qs}` : ""}`;
        } else if (p === "allergens") {
          config.url = `/menu/${slug0}/allergens${qs ? `?${qs}` : ""}`;
        }
      }
    }

    // 1) Authorization (after rewrite)
    const token = localStorage.getItem("token");
    const finalUrl = config.url || "";
    if (token && (opts?.alwaysAuth || !isPublicGet(method, finalUrl))) {
      setHeader(config.headers, "Authorization", `Bearer ${token}`);
    } else {
      deleteHeader(config.headers, "Authorization");
    }

    // 2) Auto ?restaurant=:slug (exclude platform/auth AND public menu/*)
    const u = normUrl(finalUrl);
    const isPlatform = u.startsWith("platform") || u.includes("/platform/");
    const isAuth = u.startsWith("auth") || u.includes("/auth/");
    const isMenu = /^menu\b/.test(u); // ✅ public endpoints like menu/:slug/config

    // ✅ Only attach ?restaurant=... for NON-menu endpoints (mostly admin/scoped)
    if (!isPlatform && !isAuth && !isMenu) {
      const alreadyHasParam =
        (config.params && Object.prototype.hasOwnProperty.call(config.params, "restaurant")) ||
        (typeof config.url === "string" && /[?&]restaurant=/.test(config.url));

      if (!alreadyHasParam) {
        const slug = getRestaurantSlug();
        if (slug) {
          config.params = { ...(config.params || {}), restaurant: slug };
        }
      }
    }

    // 3) ✅ Public menu language (global)
    if (!opts?.alwaysAuth) {
      const u2 = normUrl(config.url || "");
      const isMenu = /^menu\b/.test(u2);
      if (isMenu) {
        const urlHasLang = typeof config.url === "string" && /[?&]lang=/.test(config.url);
        const paramsHasLang = !!(
          config.params && Object.prototype.hasOwnProperty.call(config.params, "lang")
        );
        if (!urlHasLang && !paramsHasLang) {
          const sp = new URLSearchParams(window.location.search || "");
          const lang = String(sp.get("lang") || "").trim().toLowerCase();
          if (lang) {
            config.params = { ...(config.params || {}), lang };
          }
        }
      }
    }

    return config;
  });

  client.interceptors.response.use(
    (res) => res,
    (err) => {
      const status = err?.response?.status as number | undefined;
      const silent = !!err?.config?.meta?.silent;

      // ✅ 1) if request is marked silent -> never toast
      if (silent) return Promise.reject(err);

      // ✅ 2) public client: do NOT toast for "not found / invalid slug" cases
      // this is exactly your public /menu/:slug/* 404 spam case
      if (!opts?.alwaysAuth && (status === 404 || status === 422)) {
        return Promise.reject(err);
      }

      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.response?.data?.errors?.[0] ||
        "Възникна грешка. Опитайте отново.";

      toast.error(String(msg));
      return Promise.reject(err);
    }
  );
}

/* ---------- axios clients ---------- */

// Public / normal client -> base: /api
const api = axios.create({
  baseURL: API_BASE,
  headers: { Accept: "application/json" },
});
attachInterceptors(api, { alwaysAuth: false });

// Admin client -> base: /api/admin
export const apiAdmin = axios.create({
  baseURL: ADMIN_BASE,
  headers: { Accept: "application/json" },
});
attachInterceptors(apiAdmin, { alwaysAuth: true });

/* ---------- helpers ---------- */

export async function getTelemetryOverview(slug: string, days: number) {
  const res = await apiAdmin.get<TelemetryOverview>("telemetry/overview", {
    params: { restaurant: slug, days },
  });
  return res.data;
}

export default api;