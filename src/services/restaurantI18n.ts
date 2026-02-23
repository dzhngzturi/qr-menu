// src/services/restaurantI18n.ts
import api, { apiAdmin } from "../lib/api";

export type RestaurantLangs = {
  default_lang: string;
  langs: string[];
};

function normLang(x: any) {
  return String(x ?? "").trim().toLowerCase();
}

function uniqLower(list: any): string[] {
  const arr = Array.isArray(list) ? list : [];
  return Array.from(new Set(arr.map(normLang).filter(Boolean)));
}

/**
 * Normalizes many possible backend shapes into:
 * { default_lang, langs }
 */
function normalizeLangsPayload(payload: any): RestaurantLangs {
  const root = payload ?? {};
  const data = root.data ?? root;

  // candidates for langs
  const c1 = data?.content; // can be array OR object
  const c2 = data?.langs;
  const c3 = data?.content?.langs;

  let langs: string[] = [];

  if (Array.isArray(c1)) langs = uniqLower(c1);
  if (!langs.length) langs = uniqLower(c2);
  if (!langs.length) langs = uniqLower(c3);

  // if content is object: { langs: [...], default: "bg" }
  if (!langs.length && c1 && typeof c1 === "object") {
    langs = uniqLower((c1 as any).langs);
  }

  if (!langs.length) langs = ["bg"];

  // candidates for default
  const d1 = data?.default_lang; // restaurant response
  const d2 = data?.default; // platform response
  const d3 = data?.content?.default;
  const d4 = c1 && typeof c1 === "object" ? (c1 as any).default : undefined;

  const defRaw = normLang(d1 ?? d2 ?? d3 ?? d4 ?? langs[0] ?? "bg");
  const default_lang = langs.includes(defRaw) ? defRaw : langs[0];

  return { default_lang, langs };
}

/** restaurant scoped (read) */
export async function fetchRestaurantLangs(slug: string): Promise<RestaurantLangs> {
  const { data } = await apiAdmin.get(`restaurants/${slug}/langs`);
  return normalizeLangsPayload(data);
}

/** restaurant scoped (write) - superadmin in backend (under /admin/platform/...) */
export async function updateRestaurantLangs(slug: string, payload: RestaurantLangs) {
  // backend expects: langs + default (or default_lang) depending on controller
  // safest: send both
  const body: any = {
    langs: payload.langs,
    default_lang: payload.default_lang,
    default: payload.default_lang,
  };

  const { data } = await apiAdmin.put(`platform/restaurants/${slug}/langs`, body);
  return data;
}

/** PLATFORM allowed content langs (global / master) */
export async function fetchPlatformLangs(): Promise<RestaurantLangs> {
  const { data } = await apiAdmin.get(`platform/langs`);
  return normalizeLangsPayload(data);
}

export async function updatePlatformLangs(payload: RestaurantLangs) {
  // backend platformUpdate най-често работи с "content.default" / "default"
  // safest: send both (server will pick what it uses)
  const body: any = {
    langs: payload.langs,
    default_lang: payload.default_lang,
    default: payload.default_lang,
  };

  const { data } = await apiAdmin.put(`platform/langs`, body);
  return data;
}

export async function fetchActiveContentLangs(): Promise<string[]> {
  const res = await apiAdmin.get("platform/active-content-langs");
  return Array.isArray((res as any).data?.langs) ? (res as any).data.langs : ["bg"];
}