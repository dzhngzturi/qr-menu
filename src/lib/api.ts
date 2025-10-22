// src/lib/api.ts
import axios from "axios";
import { toast } from "react-hot-toast";

function getRestaurantSlug(): string | undefined {
  // 1) от URL: /admin/r/:slug или /menu/:slug
  const mAdmin = window.location.pathname.match(/\/admin\/r\/([^/]+)/);
  if (mAdmin?.[1]) return mAdmin[1];
  const mMenu = window.location.pathname.match(/\/menu\/([^/]+)/);
  if (mMenu?.[1]) return mMenu[1];

  // 2) fallback от localStorage (нов ключ), после стария
  return (
    localStorage.getItem("restaurant_slug") ||
    localStorage.getItem("restaurant") || // съвместимост със стария код
    undefined
  );
}

// Динамичен fallback: взима IP/hostname от текущия адрес
const fallbackBase = `http://${window.location.hostname}:8000/api`;
const API_BASE = (import.meta.env.VITE_API_BASE_URL || fallbackBase).replace(/\/+$/, "");

const api = axios.create({
  baseURL: API_BASE,
  headers: { Accept: "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;

  const url = config.url || "";
  const isPlatform = url.startsWith("/platform") || url.includes("/platform/");
  const isAuth = url.startsWith("/auth") || url.includes("/auth/");

  // ако не е платформа/автентикация – добавяме ?restaurant=,
  // НО само ако клиентът не е подал вече restaurant в params
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

export default api;
