// src/public/AvvaMenu.tsx
import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import api from "../lib/api";
import type { Category, Dish } from "../lib/types";
import { fmtEUR } from "../lib/money";
import NotFound from "../pages/NotFound";
import { MenuFooter } from "../components/MenuFooter";
import {
  logQrScanOnceForSlug,
  logMenuOpenForSlug,
  logSearchDebounced,
} from "../lib/telemetry";
import { allergenIconUrl } from "../lib/allergenIcons";

type Grouped = Record<number, Dish[]>;
type Pill = "food" | "bar" | "allergens";

type Allergen = {
  id: number;
  code: string;
  name: string;
  is_active?: boolean;
  image_url?: string | null;
};

type DishAllergen = {
  id: number;
  code?: string | null;
  name?: string | null;
  image_url?: string | null;
};

type MenuConfig = {
  ui?: { langs?: string[]; default?: string };
  content?: { langs?: string[]; default?: string };
};

const WRAP = "mx-auto max-w-4xl px-4";

function uniqLower(list: any[]): string[] {
  return Array.from(
    new Set((list ?? []).map((x) => String(x ?? "").trim().toLowerCase()))
  ).filter(Boolean);
}

export default function AvvaMenu() {
  const { slug } = useParams<{ slug: string }>();

  const [cats, setCats] = useState<Category[]>([]);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingAllergens, setLoadingAllergens] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [query, setQuery] = useState("");

  const [sp, setSp] = useSearchParams();
  const initialPill = (sp.get("tab") as Pill) || "food";
  const [pill, setPill] = useState<Pill>(initialPill);

  // ✅ multilingual (public)
  const [cfg, setCfg] = useState<MenuConfig | null>(null);
  const [langs, setLangs] = useState<string[]>([]);
  const [lang, setLang] = useState<string>("bg");
  const hasLangSwitcher = langs.length > 1;

  const [allergens, setAllergens] = useState<Allergen[]>([]);
  const [aQuery, setAQuery] = useState("");

  const [openedCatId, setOpenedCatId] = useState<number | null>(null);

  /**
   * ✅ FIX:
   * Previously: openAllergenCode (string) => clicking A1 opened A1 everywhere.
   * Now: openAllergen is scoped by (dishId, allergenId).
   * - dishId = -1 is used for the Allergens TAB (table), i.e. not tied to any dish.
   */
  const [openAllergen, setOpenAllergen] = useState<{
    dishId: number;
    allergenId: number;
  } | null>(null);

  const hasAllergensTab = loadingAllergens || (allergens?.length ?? 0) > 0;

  const BRAND = {
    name: "AVVA Cafe-Grill-Bar",
    coverUrl: "/avva.png",
    logoUrl: "",
    address: "ул. Лудогорие 11, 7400 гр. Исперих",
    phone: "089 200 1006",
    phoneTel: "+359892001006",
    color: { primary: "#161616", accent: "#FFC107", soft: "#f5f5f5" },
  };

  const SOCIAL = {
    instagram: "https://www.instagram.com/avva_cafe_bar_grill",
    facebook:
      "https://www.facebook.com/AVVAKaffeGrillBarOrginaL?mibextid=wwXIfr&rdid=cPr6pnP25u9ZDAxF&share_url=https%3A%2F%2Fwww.facebook.com%2Fshare%2F1JqS4D4AAo%2F%3Fmibextid%3DwwXIfr",
  };

  function mapsUrl(addr: string) {
    const q = encodeURIComponent(addr);
    const isiOS = /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent || "");
    return isiOS ? `maps://?q=${q}` : `https://maps.google.com/?q=${q}`;
  }

  function portionLabel(d: Dish) {
    const v = (d as any).portion_value as number | null | undefined;
    const u = (d as any).portion_unit as string | null | undefined;
    if (v == null || !u) return null;

    const unit = String(u).toLowerCase().trim();
    if (unit === "g") return `${v} гр`;
    if (unit === "ml") return `${v} мл`;
    return `${v} ${u}`;
  }

  function dishAllergens(d: Dish): DishAllergen[] {
    const list = ((d as any).allergens ?? []) as DishAllergen[];
    if (!Array.isArray(list)) return [];
    return list
      .map((a) => ({
        ...a,
        id: Number((a as any).id ?? 0),
        code: a.code ? String(a.code).trim().toUpperCase() : null,
        name: a.name ? String(a.name).trim() : null,
        image_url: a.image_url ? String(a.image_url) : null,
      }))
      .filter((a) => (a.id ?? 0) > 0 && (!!a.code || !!a.name || !!a.image_url));
  }

  function allergenSrc(code?: string | null, backendUrl?: string | null) {
    const local = allergenIconUrl(code);
    if (local) return local;
    if (backendUrl) return String(backendUrl);
    return null;
  }

  useEffect(() => {
    if (!slug) return;
    logQrScanOnceForSlug(slug);
    logMenuOpenForSlug(slug);
  }, [slug]);

  useEffect(() => {
    if (!slug) return;
    const q = query.trim();
    if (!q) return;
    logSearchDebounced(q, slug);
  }, [query, slug]);

  useEffect(() => {
    const next = new URLSearchParams(sp);
    next.set("tab", pill);
    setSp(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pill]);

  useEffect(() => {
    if (!hasAllergensTab && pill === "allergens") setPill("food");
  }, [hasAllergensTab, pill]);

  // ✅ Load public config -> allowed langs -> initial lang
  useEffect(() => {
    if (!slug) return;

    (async () => {
      try {
        const res = await api.get(`/menu/${slug}/config`);
        const data: MenuConfig = res.data;

        const uiLangs = uniqLower(data?.ui?.langs ?? []);
        const contentLangs = uniqLower(data?.content?.langs ?? []);

        // allowed = intersection(ui, content) when both exist; else fallback
        let allowed: string[] = [];
        if (uiLangs.length && contentLangs.length) {
          allowed = uiLangs.filter((l) => contentLangs.includes(l));
        }
        if (!allowed.length) allowed = contentLangs.length ? contentLangs : uiLangs;

        const uniqAllowed = Array.from(new Set(allowed)).filter(Boolean);

        const def = String(data?.content?.default ?? data?.ui?.default ?? "bg")
          .trim()
          .toLowerCase();

        const urlLang = String(sp.get("lang") ?? "").trim().toLowerCase();
        const initial =
          urlLang && uniqAllowed.includes(urlLang)
            ? urlLang
            : uniqAllowed.includes(def)
              ? def
              : uniqAllowed[0] || "bg";

        setCfg(data);
        setLangs(uniqAllowed.length ? uniqAllowed : ["bg"]);
        setLang(initial);

        // keep URL in sync only when multi-lang is enabled
        if ((uniqAllowed.length || 0) > 1) {
          const next = new URLSearchParams(sp);
          next.set("lang", initial);
          setSp(next, { replace: true });
        }
      } catch {
        setCfg(null);
        setLangs(["bg"]);
        setLang("bg");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // ✅ Fetch menu data (refetch on lang)
  useEffect(() => {
    if (!slug) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setLoading(true);
    (async () => {
      try {
        const [cRes, dRes] = await Promise.all([
          api.get(
            `/menu/${slug}/categories?only_active=1&sort=position,name&per_page=-1&lang=${encodeURIComponent(
              lang
            )}`
          ),
          api.get(
            `/menu/${slug}/dishes?only_active=1&sort=position,name&per_page=-1&lang=${encodeURIComponent(
              lang
            )}`
          ),
        ]);

        const catsData: Category[] = cRes.data.data ?? cRes.data;
        const dishesData: Dish[] = (dRes.data.data ?? dRes.data).filter(
          (d: Dish) => d.is_active
        );

        const onlyActiveCats = catsData.filter((c) => c.is_active);
        setCats(onlyActiveCats);
        setDishes(dishesData);

        if (!onlyActiveCats.length) setNotFound(true);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();

    setLoadingAllergens(true);
    api
      .get(
        `/menu/${slug}/allergens?only_active=1&per_page=-1&lang=${encodeURIComponent(
          lang
        )}`
      )
      .then((aRes) => setAllergens(aRes.data.data ?? aRes.data))
      .catch(() => setAllergens([]))
      .finally(() => setLoadingAllergens(false));
  }, [slug, lang]);

  const grouped: Grouped = useMemo(() => {
    const g: Grouped = {};
    for (const d of dishes) {
      const cid = (d as any).category?.id ?? (d as any).category_id;
      if (!cid) continue;
      (g[cid] ||= []).push(d);
    }
    return g;
  }, [dishes]);

  const getDishCategoryId = (d: Dish) =>
    (d as any).category?.id ?? (d as any).category_id ?? null;

  const isBarCategory = (name: string) => {
    const n = name.toLowerCase();
    const keys = [
      "drink",
      "drinks",
      "bar",
      "beer",
      "wine",
      "cocktail",
      "coffee",
      "tea",
      "alcohol",
      "spirit",
      "fresh",
      "milkshakes",
      "whiskey",
      "cognac",
      "jin",
      "vodka",
      "extras",
      "напит",
      "бар",
      "бира",
      "вино",
      "коктейл",
      "кафе",
      "чай",
      "алкохол",
      "ракия",
      "фрешове",
      "шейкове",
      "уиски",
      "коняк",
      "джин",
      "водка",
      "екстри",
    ];
    return keys.some((k) => n.includes(k));
  };

  const dishMatchCatIds = useMemo(() => {
    const s = query.trim().toLowerCase();
    const ids = new Set<number>();
    if (!s) return ids;
    for (const d of dishes) {
      const nameHit = d.name?.toLowerCase().includes(s);
      const descHit = d.description?.toLowerCase().includes(s);
      if (nameHit || descHit) {
        const cid = getDishCategoryId(d);
        if (cid != null) ids.add(cid);
      }
    }
    return ids;
  }, [dishes, query]);

  useEffect(() => {
    const s = query.trim().toLowerCase();
    if (!s) return;

    const match = dishes.find(
      (d) =>
        d.name?.toLowerCase().includes(s) ||
        d.description?.toLowerCase().includes(s)
    );
    if (!match) return;

    const cid = getDishCategoryId(match);
    if (!cid) return;

    const cat = cats.find((c) => c.id === cid);
    if (cat) {
      const desiredPill: Pill = isBarCategory(cat.name) ? "bar" : "food";
      if (pill !== desiredPill) setPill(desiredPill);
    }

    if (openedCatId !== cid) setOpenedCatId(cid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, dishes, cats]);

  const tilesToShow: Category[] = useMemo(() => {
    let list = cats;
    if (pill === "bar") list = cats.filter((c) => isBarCategory(c.name));
    if (pill === "food") list = cats.filter((c) => !isBarCategory(c.name));
    return list;
  }, [cats, pill]);

  const filteredTiles: Category[] = useMemo(() => {
    const s = query.trim().toLowerCase();
    if (!s) return tilesToShow;
    return cats.filter(
      (c) => c.name.toLowerCase().includes(s) || dishMatchCatIds.has(c.id)
    );
  }, [cats, tilesToShow, query, dishMatchCatIds]);

  const openCategory = (id: number) => setOpenedCatId(id);
  const backToTiles = () => setOpenedCatId(null);

  const filteredAllergens = useMemo(() => {
    const q = aQuery.trim().toLowerCase();
    if (!q) return allergens;
    return allergens.filter(
      (a) => a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q)
    );
  }, [allergens, aQuery]);

  // ✅ click outside -> close code badge
  useEffect(() => {
    const onDocClick = () => setOpenAllergen(null);
    document.addEventListener("click", onDocClick, true); // capture
    return () => document.removeEventListener("click", onDocClick, true);
  }, []);

  if (notFound) return <NotFound />;

  // ✅ shared classes for hover/tap effect
  const ICON_WRAP =
    "group relative inline-flex items-center justify-center rounded-xl bg-white border border-black/10 " +
    "transition-transform duration-150 ease-out " +
    "hover:scale-125 active:scale-150 " +
    "hover:border-[#FFC107] hover:ring-2 hover:ring-[#FFC107]/80 hover:shadow-[0_0_18px_rgba(255,193,7,.55)]";

  // ✅ badge shown on click (mobile-friendly)
  const CODE_BADGE =
    "pointer-events-none absolute -top-2 -right-2 z-50 " +
    "rounded-md bg-black text-white text-[11px] font-bold " +
    "px-1.5 py-0.5 shadow-lg border border-white/20";

  // ✅ simple flag src mapping (expects /public/flags/bg.svg, de.svg, en.svg...)
  const flagSrc = (l: string) => `/flags/${l}.svg`;

  const isOpenAt = (dishId: number, allergenId: number) =>
    openAllergen?.dishId === dishId && openAllergen?.allergenId === allergenId;

  const toggleOpenAt = (dishId: number, allergenId: number) => {
    setOpenAllergen((prev) =>
      prev?.dishId === dishId && prev?.allergenId === allergenId
        ? null
        : { dishId, allergenId }
    );
  };

  return (
    <div
      className="min-h-screen text-neutral-900"
      style={{
        backgroundImage: "url('/bg-dark.png')",
        backgroundSize: "cover",
        backgroundRepeat: "repeat",
        backgroundAttachment: "fixed",
        backgroundColor: "#0f0f10",
        fontFamily: "'Rubik', sans-serif",
      }}
    >
      {/* COVER */}
      <div className={`${WRAP} pt-2 sm:pt-4`}>
        <div className="relative h-[140px] sm:h-[200px] rounded-2xl overflow-hidden border border-black shadow-sm">
          {openedCatId !== null && (
            <div className="sticky top-0 z-40">
              <div className="border-b border-white/10">
                <div className={`${WRAP}`}>
                  <div className="flex items-center gap-3 py-2">
                    <button
                      onClick={backToTiles}
                      className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm bg-black/60 text-white border border-white/70 hover:bg-black/70 backdrop-blur"
                      title="Назад"
                    >
                      ← Назад
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <img
            src={BRAND.coverUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/25 to-transparent" />
        </div>
      </div>

      {/* HEADER CARD */}
      <div className={`${WRAP} -mt-3 sm:-mt-6 lg:-mt-10 pt-3 sm:pt-4`}>
        <div className="rounded-2xl bg-white shadow-[0_10px_30px_rgba(0,0,0,.07)] border border-black p-3 md:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              {BRAND.logoUrl ? (
                <img
                  src={BRAND.logoUrl}
                  className="h-10 w-10 rounded-full object-cover border"
                  alt=""
                />
              ) : null}
              <div>
                <h1
                  className="text-xl sm:text-2xl md:text-3xl font-bold"
                  style={{ color: BRAND.color.primary }}
                >
                  {BRAND.name}
                </h1>

                {/* ✅ language flags */}
                {hasLangSwitcher && (
                  <div className="mt-2 flex items-center gap-2">
                    {langs.map((l) => (
                      <button
                        key={l}
                        type="button"
                        onClick={() => {
                          setLang(l);
                          const next = new URLSearchParams(sp);
                          next.set("lang", l);
                          setSp(next, { replace: true });
                        }}
                        className={
                          "h-9 w-9 rounded-full border border-black bg-white overflow-hidden flex items-center justify-center " +
                          (lang === l ? "ring-2 ring-[#FFC107]" : "")
                        }
                        title={l.toUpperCase()}
                        aria-label={`Switch language to ${l}`}
                      >
                        <img
                          src={flagSrc(l)}
                          alt={l}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display =
                              "none";
                          }}
                        />
                        <span className="absolute text-[10px] font-bold text-black">
                          {l.toUpperCase()}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-neutral-600">
            <a
              href={mapsUrl(BRAND.address)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:underline"
            >
              <span>📍</span>
              {BRAND.address}
            </a>

            <a
              href={`tel:${BRAND.phoneTel}`}
              className="inline-flex items-center gap-1 hover:underline"
            >
              <span>📞</span>
              {BRAND.phone}
            </a>

            <div className="flex items-center gap-2">
              {SOCIAL.facebook && (
                <a
                  href={SOCIAL.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm bg-neutral-100 text-black border border-black hover:bg-neutral-200 transition"
                  aria-label="Facebook"
                  title="Facebook"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M22 12.06C22 6.477 17.523 2 11.94 2 6.356 2 1.88 6.477 1.88 12.06c0 5.018 3.66 9.177 8.44 9.94v-7.03H7.99v-2.91h2.33v-2.22c0-2.3 1.367-3.57 3.462-3.57.997 0 2.04.178 2.04.178v2.25h-1.149c-1.133 0-1.487.703-1.487 1.423v1.94h2.533l-.404 2.91h-2.129V22c4.78-.763 8.44-4.922 8.44-9.94Z" />
                  </svg>
                  <span className="font-medium">Facebook</span>
                </a>
              )}

              {SOCIAL.instagram && (
                <a
                  href={SOCIAL.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm bg-neutral-100 text-black border border-black hover:bg-neutral-200 transition"
                  aria-label="Instagram"
                  title="Instagram"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7Zm5 3.5A5.5 5.5 0 1 1 6.5 13 5.51 5.51 0 0 1 12 7.5Zm0 2A3.5 3.5 0 1 0 15.5 13 3.5 3.5 0 0 0 12 9.5Zm5.75-3.25a1.25 1.25 0 1 1-1.25 1.25 1.25 1.25 0 0 1 1.25-1.25Z" />
                  </svg>
                  <span className="font-medium">Instagram</span>
                </a>
              )}
            </div>
          </div>

          {/* PILLS */}
          <div className="mt-3 sm:mt-4 flex gap-2 flex-wrap">
            {[
              { key: "food", label: "Food" },
              { key: "bar", label: "Bar" },
              ...(hasAllergensTab ? [{ key: "allergens", label: "Allergens" }] : []),
            ].map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => {
                  setPill(p.key as Pill);
                  setOpenedCatId(null);
                  setOpenAllergen(null);
                }}
                className={
                  "rounded-full px-3 py-1.5 text-sm transition border " +
                  (pill === p.key
                    ? "bg-[#FFC107] text-white border-black"
                    : "bg-neutral-100 hover:bg-neutral-200 border-black")
                }
                aria-pressed={pill === p.key}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Search */}
          {pill !== "allergens" && (
            <div className="mt-3 sm:mt-4 relative">
              <input
                id="menu_search"
                name="menu_search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Търсене в категории и ястия"
                className="w-full rounded-full border border-black px-4 py-3 pr-11 outline-none focus:ring-2 focus:ring-[#FFC107]"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2">🔎</span>
            </div>
          )}
        </div>
      </div>

      {/* --------- CONTENT --------- */}
      <main className={`${WRAP} pb-28 sm:pb-32`}>
        {/* Allergens TAB */}
        {pill === "allergens" && (
          <div className="mt-6 rounded-2xl border border-black bg-white p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <h2 className="text-xl md:text-2xl font-semibold">Алергени</h2>
              <div className="relative w-full sm:w-80">
                <input
                  value={aQuery}
                  onChange={(e) => setAQuery(e.target.value)}
                  placeholder="Търсене по код или име…"
                  className="w-full rounded-full border border-black px-4 py-2 pr-11 outline-none focus:ring-2 focus:ring-[#FFC107]"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2">🔎</span>
              </div>
            </div>

            {loadingAllergens ? (
              <div className="py-10 text-center text-neutral-500">Зареждане…</div>
            ) : filteredAllergens.length === 0 ? (
              <div className="py-10 text-center text-neutral-500">Няма алергени.</div>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="min-w-full text-sm">
                  <thead className="bg-neutral-50 text-neutral-700">
                    <tr>
                      <th className="px-3 py-2 text-left w-20">Икона</th>
                      <th className="px-3 py-2 text-left w-28">Код</th>
                      <th className="px-3 py-2 text-left">Алерген</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAllergens.map((a, i) => {
                      const code = String(a.code || "").trim().toUpperCase();
                      const src = allergenSrc(code, a.image_url ?? null);

                      const isOpen = isOpenAt(-1, a.id);

                      return (
                        <tr
                          key={a.id}
                          className={i % 2 === 0 ? "bg-white" : "bg-neutral-50/60"}
                          title={`${a.code} — ${a.name}`}
                        >
                          <td className="px-3 py-2">
                            {src ? (
                              <button
                                type="button"
                                className={ICON_WRAP}
                                title={code}
                                aria-label={code}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  toggleOpenAt(-1, a.id);
                                }}
                              >
                                <img
                                  src={src}
                                  alt={code}
                                  className="h-16 w-16 md:h-14 md:w-14 object-contain p-1"
                                  loading="lazy"
                                />
                                {isOpen && <span className={CODE_BADGE}>{code}</span>}
                              </button>
                            ) : (
                              <span className="text-neutral-400">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2 font-semibold whitespace-nowrap">
                            {a.code}
                          </td>
                          <td className="px-3 py-2 break-words">{a.name}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tiles */}
        {pill !== "allergens" && openedCatId === null && (
          <>
            {loading && (
              <div className="py-10 text-center text-neutral-300">Зареждане…</div>
            )}
            {!loading && filteredTiles.length === 0 && (
              <div className="py-10 text-center text-neutral-300">Няма категории.</div>
            )}
            {!loading &&
              filteredTiles.map((c) => (
                <button
                  key={`tile-${c.id}`}
                  onClick={() => openCategory(c.id)}
                  className="relative h-[160px] md:h-[190px] w-full overflow-hidden rounded-2xl border border-black bg-white shadow-sm text-left mt-4"
                  title={c.name}
                >
                  {c.image_url ? (
                    <img
                      src={c.image_url}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-neutral-200" />
                  )}
                  <div className="absolute inset-0 bg-black/25" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span
                      className="text-white text-2xl md:text-[28px] font-bold tracking-wide"
                      style={{
                        textShadow: "0 0 3px #000, 0 0 3px #000, 0 0 3px #000",
                      }}
                    >
                      {c.name.toUpperCase()}
                    </span>
                  </div>
                </button>
              ))}
          </>
        )}

        {/* Category view */}
        {pill !== "allergens" &&
          openedCatId !== null &&
          (() => {
            const c = cats.find((x) => x.id === openedCatId);
            let list = (c && grouped[c.id]) || [];

            const s = query.trim().toLowerCase();
            if (s) {
              list = list.filter(
                (d) =>
                  d.name.toLowerCase().includes(s) ||
                  (d.description && d.description.toLowerCase().includes(s))
              );
            }

            const isGridLayout = !isBarCategory(c?.name ?? "");

            const AllergensIconsOnly = ({
              dishId,
              aList,
            }: {
              dishId: number;
              aList: DishAllergen[];
            }) => {
              if (!aList.length) return null;

              return (
                <div className="mt-3 flex flex-wrap gap-2">
                  {aList.map((a) => {
                    const code = String(a.code || "").trim().toUpperCase();
                    const src = allergenSrc(code, a.image_url ?? null);
                    if (!src) return null;

                    const isOpen = isOpenAt(dishId, a.id);

                    return (
                      <button
                        key={`${dishId}-${a.id}`}
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleOpenAt(dishId, a.id);
                        }}
                        className={ICON_WRAP}
                        title={code || "allergen"}
                        aria-label={code || "allergen"}
                      >
                        <img
                          src={src}
                          alt={code || "allergen"}
                          className="h-10 w-10 sm:h-11 sm:w-11 md:h-12 md:w-12 object-contain p-1"
                          loading="lazy"
                        />
                        {isOpen && <span className={CODE_BADGE}>{code}</span>}
                      </button>
                    );
                  })}
                </div>
              );
            };

            return (
              <section className="mt-6">
                <h2 className="text-xl md:text-2xl font-semibold mb-3 text-white">
                  {c?.name}
                </h2>

                {s && list.length === 0 && (
                  <div className="py-6 text-center text-neutral-400">
                    Няма ястия по това търсене.
                  </div>
                )}

                {isGridLayout ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {list.map((d) => {
                      const pLabel = portionLabel(d);
                      const aList = dishAllergens(d);

                      return (
                        <article
                          key={d.id}
                          className="rounded-2xl overflow-hidden border border-black bg-white shadow-sm"
                        >
                          {d.image_url && (
                            <div className="relative aspect-[16/9] w-full">
                              <img
                                src={d.image_url}
                                alt={d.name}
                                className="absolute inset-0 w-full h-full object-cover"
                              />
                            </div>
                          )}

                          <div className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <h3 className="text-lg md:text-xl font-semibold">
                                {d.name}
                              </h3>
                              {!!d.price && (
                                <div className="text-right text-sm font-semibold">
                                  <div className="text-[#FFC107]">
                                    {fmtEUR.format(d.price)}
                                  </div>
                                </div>
                              )}
                            </div>

                            {!!d.description && (
                              <p className="text-sm text-neutral-700 mt-2">
                                {d.description}
                              </p>
                            )}

                            {pLabel && (
                              <div className="mt-2 text-xs text-neutral-600">
                                {pLabel}
                              </div>
                            )}

                            <AllergensIconsOnly dishId={d.id} aList={aList} />

                            {!d.is_active && (
                              <div className="mt-2 text-xs uppercase text-neutral-500">
                                недостъпно
                              </div>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-2xl overflow-hidden border border-black bg-white">
                    <ul className="divide-y">
                      {list.map((d) => {
                        const pLabel = portionLabel(d);
                        const aList = dishAllergens(d);

                        return (
                          <li key={d.id} className="flex items-center gap-3 p-4">
                            {!!d.image_url && (
                              <img
                                src={d.image_url}
                                className="h-16 w-16 rounded-xl object-cover border border-black"
                                alt=""
                              />
                            )}
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className="text-[17px] font-medium">
                                  {d.name}
                                </h3>
                                {!d.is_active && (
                                  <span className="text-xs text-neutral-500 uppercase">
                                    недостъпно
                                  </span>
                                )}
                              </div>

                              {!!d.description && (
                                <p className="text-sm text-neutral-600 mt-0.5">
                                  {d.description}
                                </p>
                              )}

                              {pLabel && (
                                <div className="mt-1 text-xs text-neutral-600">
                                  {pLabel}
                                </div>
                              )}

                              {aList.length > 0 && (
                                <AllergensIconsOnly dishId={d.id} aList={aList} />
                              )}
                            </div>

                            {!!d.price && (
                              <div className="text-right text-sm font-semibold">
                                <div className="text-[#FFC107]">
                                  {fmtEUR.format(d.price)}
                                </div>
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </section>
            );
          })()}
      </main>

      <MenuFooter />
    </div>
  );
}