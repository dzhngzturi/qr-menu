import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import type { Category, Paginated } from "../../../lib/types";
import { fetchCategories } from "../../../services/categories";
import { fetchRestaurantLangs as fetchRestaurantLangsApi } from "../../../services/restaurantI18n";

const norm = (s: any) => String(s || "").trim().toLowerCase();

export function useCategoriesPage() {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useTranslation();

  // pagination/list
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<Category> | null>(null);
  const [loading, setLoading] = useState(false);

  // langs (like dishes)
  const [list, setList] = useState<string[]>([]);
  const [defLang, setDefLang] = useState<string>("bg");
  const [activeLang, setActiveLang] = useState<string>("bg");
  const [nameByLang, setNameByLang] = useState<Record<string, string>>({ bg: "" });

  const totalPages = useMemo(() => data?.meta.last_page ?? 1, [data?.meta.last_page]);

  async function fetchData(p = page) {
    setLoading(true);
    try {
      const res = await fetchCategories({ page: p, sort: "position,name" });
      setData(res);
    } finally {
      setLoading(false);
    }
  }

  // load categories
  useEffect(() => {
    fetchData(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // load restaurant langs (like dishes)
  useEffect(() => {
    if (!slug) return;

    const storageKey = `admin:categories:lang:${slug}`;

    (async () => {
      try {
        const res = await fetchRestaurantLangsApi(slug);

        const incoming = (res?.langs ?? []).map(norm).filter(Boolean);
        const safeLangs = incoming.length ? incoming : ["bg"];

        const def = norm(res?.default_lang || safeLangs[0] || "bg");
        const safeDef = safeLangs.includes(def) ? def : safeLangs[0];

        const ordered = [safeDef, ...safeLangs.filter((l) => l !== safeDef)];

        setList(ordered);
        setDefLang(safeDef);

        const saved = norm(localStorage.getItem(storageKey));
        const initial = ordered.includes(saved) ? saved : safeDef;

        setActiveLang((cur) => {
          const curNorm = norm(cur);
          return ordered.includes(curNorm) ? curNorm : initial;
        });

        setNameByLang((prev) => {
          const next: Record<string, string> = { ...prev };
          ordered.forEach((l) => (next[l] = next[l] ?? ""));
          // remove stale keys
          Object.keys(next).forEach((k) => {
            const kn = norm(k);
            if (!ordered.includes(kn)) delete next[k];
          });
          return next;
        });
      } catch {
        // fallback
        setList(["bg"]);
        setDefLang("bg");
        setActiveLang("bg");
      }
    })();
  }, [slug]);

  // ---------- Hint derived state (like dishes) ----------
  const active = list.includes(norm(activeLang)) ? norm(activeLang) : defLang;
  const activeLabel = active.toUpperCase();

  const activeName = (nameByLang[active] ?? "").trim();
  const fallbackName = (nameByLang[defLang] ?? "").trim(); // categories fallback is just default lang

  const nameMissing = active !== defLang && !activeName;

  const tMissingTitle = t("admin.categories.missing_translation_title", {
    defaultValue: "Missing translation for {{lang}}",
    lang: activeLabel,
  });

  const tFallbackLabel = t("admin.categories.fallback_label", {
    defaultValue: "Fallback ({{lang}}):",
    lang: defLang.toUpperCase(),
  });

  const tUseFallback = t("admin.categories.use_fallback", { defaultValue: "Use fallback" });
  const tCopyFallbackTitle = t("admin.categories.copy_fallback_title", {
    defaultValue: "Copy fallback into this language",
  });

  function onUseFallback() {
    setNameByLang((p) => ({ ...p, [active]: fallbackName }));
  }

  return {
    // list/pagination
    page,
    setPage,
    data,
    setData,
    loading,
    totalPages,
    fetchData,

    // i18n VM (like dishes)
    list,
    defLang,
    activeLang: active,
    setActiveLang,
    nameByLang,
    setNameByLang,

    // hint VM (like dishes)
    active,
    activeLabel,
    fallbackName,
    nameMissing,
    tMissingTitle,
    tFallbackLabel,
    tUseFallback,
    tCopyFallbackTitle,
    onUseFallback,

    // helper
    t,
  };
}
