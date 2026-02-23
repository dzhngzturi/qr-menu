// src/context/PublicConfigContext.tsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import i18next from "i18next";
import api from "../lib/api";
import { type AppLang } from "../i18n";

async function applyUiLang(lang: AppLang) {
  // global (admin + public)
  localStorage.setItem("lang", lang);

  // i18next changeLanguage returns a promise; we await it so UI doesn't flash in a wrong language
  await i18next.changeLanguage(lang);

  // keep <html lang=".."> correct
  document.documentElement.lang = lang;
}

type PublicConfig = {
  restaurant?: { id: number; slug: string; name?: string };
  ui: { langs: AppLang[]; default: AppLang };
  content: { langs: AppLang[]; default: AppLang };
};

type Ctx = {
  slug?: string | null;

  loading: boolean;
  error: string | null;

  notFound: boolean; // 404 (invalid restaurant)
  isReady: boolean; // cfg loaded for CURRENT slug
  langReady: boolean; // i18n language applied for CURRENT slug

  langs: AppLang[];
  defaultLang: AppLang;
  lang: AppLang;

  restaurantId: number | null;
  restaurantSlug: string | null;

  setPublicLang: (next: AppLang) => void;
};

const PublicConfigContext = createContext<Ctx | null>(null);

/* ----------------- caches ----------------- */

// how long to cache successful config
const CFG_TTL_MS = 5 * 60 * 1000; // 5 min

// how long to cache 404 (negative cache)
const NOTFOUND_TTL_MS = 5 * 60 * 1000; // 5 min

// success cache
const cfgCache = new Map<string, { ts: number; cfg: PublicConfig }>();

// negative cache (404)
const nfCache = new Map<string, { ts: number }>();

// blocked cache (429) - store until timestamp
const blockCache = new Map<string, { until: number }>();

// in-flight dedupe (for ALL outcomes)
const inFlight = new Map<
  string,
  Promise<{ ok: true; cfg: PublicConfig } | { ok: false; status: number; retryAfter?: number }>
>();

function cacheGetCfg(slug: string): PublicConfig | null {
  const hit = cfgCache.get(slug);
  if (!hit) return null;
  if (Date.now() - hit.ts > CFG_TTL_MS) {
    cfgCache.delete(slug);
    return null;
  }
  return hit.cfg;
}
function cacheSetCfg(slug: string, cfg: PublicConfig) {
  cfgCache.set(slug, { ts: Date.now(), cfg });
}

function isNotFoundCached(slug: string) {
  const hit = nfCache.get(slug);
  if (!hit) return false;
  if (Date.now() - hit.ts > NOTFOUND_TTL_MS) {
    nfCache.delete(slug);
    return false;
  }
  return true;
}
function setNotFoundCached(slug: string) {
  nfCache.set(slug, { ts: Date.now() });
}

function getBlockedUntil(slug: string): number | null {
  const hit = blockCache.get(slug);
  if (!hit) return null;
  if (Date.now() > hit.until) {
    blockCache.delete(slug);
    return null;
  }
  return hit.until;
}
function setBlockedUntil(slug: string, seconds: number) {
  const until = Date.now() + seconds * 1000;
  blockCache.set(slug, { until });
}

/* ----------------- helpers ----------------- */

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr));
}

function normalizeLang(raw: string | null | undefined, fallback: AppLang): AppLang {
  const v = String(raw ?? "").trim().toLowerCase();
  if (!v) return fallback;

  // allow "de-DE" -> "de"
  const base = v.split("-")[0];
  return (base || fallback) as AppLang;
}

function lsKey(slug: string) {
  return `public.lang.${slug}`;
}

function getUrlLang(): AppLang | null {
  const url = new URL(window.location.href);
  const v = url.searchParams.get("lang");
  return v ? (normalizeLang(v, "bg") as AppLang) : null;
}

function setUrlLangConditionally(lang: AppLang, shouldShow: boolean) {
  const url = new URL(window.location.href);
  if (!shouldShow) {
    url.searchParams.delete("lang");
  } else {
    url.searchParams.set("lang", lang);
  }
  window.history.replaceState({}, "", url.toString());
}

export function PublicConfigProvider({
  slug,
  children,
}: {
  slug?: string | null;
  children: React.ReactNode;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [cfg, setCfg] = useState<PublicConfig | null>(null);
  const [loadedSlug, setLoadedSlug] = useState<string | null>(null);

  const [lang, setLangState] = useState<AppLang>("bg");
  const [langReady, setLangReady] = useState(false);

  const langs = useMemo<AppLang[]>(() => {
    const ui = cfg?.ui?.langs ?? [];
    const content = cfg?.content?.langs ?? [];
    const inter = ui.filter((l) => content.includes(l));
    return uniq(inter);
  }, [cfg]);

  const defaultLang = useMemo<AppLang>(() => {
    const defUi = cfg?.ui?.default;
    const defContent = cfg?.content?.default;

    const candidate = defUi && defContent && defUi === defContent ? defUi : defUi || defContent;

    if (candidate && langs.includes(candidate)) return candidate;
    return (langs[0] || "bg") as AppLang;
  }, [cfg, langs]);

  const hasMultipleLangs = langs.length > 1;

  const isReady = useMemo(() => {
    return !!slug && !loading && !error && !notFound && loadedSlug === slug;
  }, [slug, loading, error, notFound, loadedSlug]);

  const restaurantId = cfg?.restaurant?.id ?? null;
  const restaurantSlug = cfg?.restaurant?.slug ?? null;

  useEffect(() => {
    let mounted = true;

    // close gate immediately on slug change
    setLoading(true);
    setError(null);
    setNotFound(false);
    setCfg(null);
    setLoadedSlug(null);
    setLangReady(false);

    (async () => {
      if (!slug) {
        if (!mounted) return;
        setLoading(false);
        setNotFound(true);
        setError("Missing slug");
        setLangReady(true);
        return;
      }

      // ✅ 0) if blocked (429 cached) -> DO NOT request
      const blockedUntil = getBlockedUntil(slug);
      if (blockedUntil) {
        if (!mounted) return;
        setLoading(false);
        setNotFound(true);
        setError(null);
        setLangReady(true);
        return;
      }

      // ✅ 1) negative cache (404) -> DO NOT request
      if (isNotFoundCached(slug)) {
        if (!mounted) return;
        setLoading(false);
        setNotFound(true);
        setError(null);
        setLangReady(true);
        return;
      }

      // ✅ 2) success cache -> no network
      const cached = cacheGetCfg(slug);
      if (cached) {
        if (!mounted) return;
        setCfg(cached);
        setLoadedSlug(slug);
        setLoading(false);
        return;
      }

      // ✅ 3) in-flight dedupe (StrictMode / remount safe)
      const existing = inFlight.get(slug);
      if (existing) {
        const r = await existing;
        if (!mounted) return;

        if (r.ok) {
          setCfg(r.cfg);
          setLoadedSlug(slug);
          setNotFound(false);
          setError(null);
          setLoading(false);
          return;
        }

        if (r.status === 404) {
          setNotFoundCached(slug);
          setNotFound(true);
          setError(null);
        } else if (r.status === 429) {
          setBlockedUntil(slug, r.retryAfter ?? 300);
          setNotFound(true);
          setError(null);
        } else {
          setError("Failed to load public config");
        }

        setLoading(false);
        setLangReady(true);
        return;
      }

      // ✅ 4) real request
      const p = (async () => {
        try {
          const res = await api.get(`/menu/${slug}/config`, {
            meta: { silent: true },
          });
          const data = res.data as PublicConfig;
          return { ok: true as const, cfg: data };
        } catch (e: any) {
          const status = e?.response?.status ?? 0;
          let retryAfter: number | undefined;

          if (status === 429) {
            const ra = e?.response?.headers?.["retry-after"];
            const parsed = Number(ra);
            retryAfter = Number.isFinite(parsed) && parsed > 0 ? parsed : 300;
          }

          return { ok: false as const, status, retryAfter };
        }
      })();

      inFlight.set(slug, p);

      const r = await p;
      inFlight.delete(slug);

      if (!mounted) return;

      if (r.ok) {
        cacheSetCfg(slug, r.cfg);
        setCfg(r.cfg);
        setLoadedSlug(slug);
        setNotFound(false);
        setError(null);
        setLoading(false);
        return;
      }

      if (r.status === 404) {
        setNotFoundCached(slug);
        setNotFound(true);
        setError(null);
      } else if (r.status === 429) {
        setBlockedUntil(slug, r.retryAfter ?? 300);
        setNotFound(true);
        setError(null);
      } else {
        setError("Failed to load public config");
      }

      setLoading(false);
      setLangReady(true);
    })();

    return () => {
      mounted = false;
    };
  }, [slug]);

  // pick initial lang AFTER cfg is available (AND for current slug)
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!slug) return;
      if (!cfg) return;
      if (loadedSlug !== slug) return;

      const fromQuery = hasMultipleLangs ? getUrlLang() : null;
      const fromLs = localStorage.getItem(lsKey(slug));
      const candidate = fromQuery || fromLs || defaultLang;

      const safe = normalizeLang(candidate, defaultLang);
      const finalLang = (langs.includes(safe) ? safe : defaultLang) as AppLang;

      // Apply i18n language BEFORE we open the UI gate (prevents BG -> DE flash)
      await applyUiLang(finalLang);

      if (cancelled) return;

      setLangState(finalLang);
      localStorage.setItem(lsKey(slug), finalLang);
      setUrlLangConditionally(finalLang, hasMultipleLangs);

      setLangReady(true);
    };

    run();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg, slug, loadedSlug, defaultLang, langs.join("|")]);

  const setPublicLang = (next: AppLang) => {
    if (!slug) return;
    if (!isReady) return;

    const v = normalizeLang(next, defaultLang);
    const finalLang = (langs.includes(v) ? v : defaultLang) as AppLang;

    setLangState(finalLang);
    void applyUiLang(finalLang);
    localStorage.setItem(lsKey(slug), finalLang);

    setUrlLangConditionally(finalLang, hasMultipleLangs);
  };

  const value: Ctx = {
    slug,
    loading,
    error,
    notFound,
    isReady,
    langReady,

    langs,
    defaultLang,
    lang,

    restaurantId,
    restaurantSlug,

    setPublicLang,
  };

  return <PublicConfigContext.Provider value={value}>{children}</PublicConfigContext.Provider>;
}

export function usePublicConfig() {
  const ctx = useContext(PublicConfigContext);
  if (!ctx) throw new Error("usePublicConfig must be used inside PublicConfigProvider");
  return ctx;
} 