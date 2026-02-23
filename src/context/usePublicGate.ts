// src/context/usePublicGate.ts
import { useMemo } from "react";
import { usePublicConfig } from "../public/PublicConfigContext";

function isNotFoundError(msg: string | null) {
  if (!msg) return false;
  const m = msg.toLowerCase();
  return (
    m.includes("not found") ||
    m.includes("404") ||
    m.includes("missing slug") ||
    m.includes("restaurant not found")
  );
}

export function usePublicGate() {
  const cfg = usePublicConfig();

  const notFound = useMemo(() => isNotFoundError(cfg.error), [cfg.error]);

// ✅ ready = имаме config + езикът е приложен + няма error + имаме slug
const isReady = useMemo(() => {
  return !cfg.loading && !cfg.error && cfg.langReady && !!cfg.slug;
}, [cfg.loading, cfg.error, cfg.langReady, cfg.slug]);

  // ✅ canFetch = само това ползвай в Public страниците преди API заявки
  const canFetch = useMemo(() => {
    return isReady && !notFound;
  }, [isReady, notFound]);

  return {
    // status
    isReady,
    notFound,
    loading: cfg.loading,
    error: cfg.error,

    // payload
    slug: cfg.slug ?? null,
    lang: cfg.lang,
    langs: cfg.langs,
    defaultLang: cfg.defaultLang,
    hasMultipleLangs: cfg.langs.length > 1,

    // actions
    setPublicLang: cfg.setPublicLang,

    // helper
    canFetch,
  };
}