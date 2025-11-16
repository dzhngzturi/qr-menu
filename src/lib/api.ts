// src/lib/api.ts
import axios, { AxiosHeaders, type AxiosRequestConfig } from "axios";
import { toast } from "react-hot-toast";
import type { TelemetryOverview } from "./types";

/* ---------- helpers ---------- */
function getRestaurantSlug(): string | undefined {
  const mAdmin = window.location.pathname.match(/\/admin\/r\/([^/]+)/);
  if (mAdmin?.[1]) return mAdmin[1];
  const mMenu = window.location.pathname.match(/\/menu\/([^/]+)/);
  if (mMenu?.[1]) return mMenu[1];

  return (
    localStorage.getItem("restaurant_slug") ||
    localStorage.getItem("restaurant") ||
    undefined
  );
}

const isPublicGet = (method: AxiosRequestConfig["method"], url: string) => {
  const m = (method || "get").toUpperCase();
  if (m !== "GET") return false;
  // публични пътища: /menu, /categories, /dishes, /allergens
  return /^\/(menu|categories|dishes|allergens)\b/.test(url);
};

const fallbackBase = `http://${window.location.hostname}:8000/api`;
const API_BASE = (import.meta.env.VITE_API_BASE_URL || fallbackBase).replace(/\/+$/, "");

/* ---------- axios client ---------- */
const api = axios.create({
  baseURL: API_BASE,
  headers: { Accept: "application/json" },
});

/* ---------- safe header setters for Axios v1 ---------- */
function setHeader(headers: AxiosRequestConfig["headers"], key: string, val: string) {
  if (!headers) return;
  if (headers instanceof AxiosHeaders) {
    headers.set(key, val);
  } else {
    (headers as Record<string, string>)[key] = val;
  }
}

function deleteHeader(headers: AxiosRequestConfig["headers"], key: string) {
  if (!headers) return;
  if (headers instanceof AxiosHeaders) {
    headers.delete?.(key);
  } else {
    delete (headers as Record<string, unknown>)[key];
  }
}

/* ---------- interceptors ---------- */
api.interceptors.request.use((config) => {
  const url = config.url || "";
  const method = config.method;

  // 1) Authorization само ако НЕ е публичен GET
  const token = localStorage.getItem("token");
  if (token && !isPublicGet(method, url)) {
    setHeader(config.headers, "Authorization", `Bearer ${token}`);
  } else {
    deleteHeader(config.headers, "Authorization");
  }

  // 2) Авто ?restaurant=:slug (извън platform/auth)
  const isPlatform = url.startsWith("/platform") || url.includes("/platform/");
  const isAuth = url.startsWith("/auth") || url.includes("/auth/");

  if (!isPlatform && !isAuth) {
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

  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const msg =
      err?.response?.data?.message ||
      err?.response?.data?.error ||
      err?.response?.data?.errors?.[0] ||
      "Възникна грешка. Опитайте отново.";
    toast.error(String(msg));
    return Promise.reject(err);
  }
);

// GET /telemetry/overview
export async function getTelemetryOverview(slug: string, days: number) {
  const res = await api.get<TelemetryOverview>("/telemetry/overview", {
    params: { restaurant: slug, days },
  });
  return res.data;
}

export default api;
