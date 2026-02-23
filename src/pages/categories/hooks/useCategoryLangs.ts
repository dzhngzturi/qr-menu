import { useEffect, useMemo, useState } from "react";
import { fetchRestaurantLangs } from "../../../services/restaurantI18n";

function norm(x: any) {
  return String(x || "").toLowerCase().trim();
}

export function useCategoryLangs(slug?: string) {
  const [langs, setLangs] = useState<string[]>([]);
  const [defaultLang, setDefaultLang] = useState<string>("bg");

  // ✅ винаги ще е default при load
  const [activeLang, setActiveLang] = useState<string>("bg");
  const [nameByLang, setNameByLang] = useState<Record<string, string>>({ bg: "" });

  useEffect(() => {
    if (!slug) return;

    let mounted = true;

    (async () => {
      try {
        const res = await fetchRestaurantLangs(slug);

        const incoming = (res.langs ?? []).map(norm).filter(Boolean);
        const safeLangs = incoming.length ? incoming : ["bg"];

        const def = norm(res.default_lang || safeLangs[0] || "bg");
        const safeDef = safeLangs.includes(def) ? def : safeLangs[0];

        // ✅ defaultLang първи
        const ordered = [safeDef, ...safeLangs.filter((l) => l !== safeDef)];

        if (!mounted) return;

        setLangs(ordered);
        setDefaultLang(safeDef);

        // ✅ НЯМА localStorage: винаги старт = default
        setActiveLang(safeDef);

        // keys for inputs
        setNameByLang((prev) => {
          const next: Record<string, string> = { ...prev };
          ordered.forEach((l) => (next[l] = next[l] ?? ""));
          Object.keys(next).forEach((k) => {
            if (!ordered.includes(k)) delete next[k];
          });
          return next;
        });
      } catch {
        setLangs(["bg"]);
        setDefaultLang("bg");
        setActiveLang("bg");
        setNameByLang((p) => ({ bg: p.bg ?? "" }));
      }
    })();

    return () => {
      mounted = false;
    };
  }, [slug]);

  const list = useMemo(() => {
    const base = langs.length ? langs : [defaultLang || "bg"];
    return base.map(norm).filter(Boolean);
  }, [langs, defaultLang]);

  const defLang = useMemo(() => {
    return norm(defaultLang || list[0] || "bg");
  }, [defaultLang, list]);

  // ✅ setter, който приема само валиден език
  const setActiveLangSafe = (l: string) => {
    const v = norm(l);
    setActiveLang(list.includes(v) ? v : defLang);
  };

  return {
    langs,
    defaultLang,
    list,
    defLang,
    activeLang,
    setActiveLang: setActiveLangSafe,
    nameByLang,
    setNameByLang,
  };
}
