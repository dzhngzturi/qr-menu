// src/public/EresMenu.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../lib/api";
import type { Category, Dish } from "../lib/types";
import { fmtEUR } from "../lib/money";
import NotFound from "../pages/NotFound";
import { MenuFooter } from "../components/MenuFooter";
import {
  logQrScanOnceForSlug,
  logMenuOpenForSlug,
  logSearchDebounced,
  logSearchImmediate,
} from "../lib/telemetry";
import { allergenIconUrl } from "../lib/allergenIcons";

type Grouped = Record<number, Dish[]>;

type DishAllergen = {
  id: number;
  code?: string | null;
  name?: string | null;
  image_url?: string | null;
};

type AllergenMaster = {
  id: number;
  code: string;
  name: string;
  image_url?: string | null;
  is_active?: boolean;
};

type ViewMode = "menu" | "allergens";

export default function EresMenu() {
  const { slug } = useParams<{ slug: string }>();

  const [cats, setCats] = useState<Category[]>([]);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState<number | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // ✅ view (menu / allergens) for BOTH mobile + desktop
  const [view, setView] = useState<ViewMode>("menu");

  // ✅ master allergens list from /menu/{slug}/allergens (like AvvaMenu)
  const [loadingAllergens, setLoadingAllergens] = useState(false);
  const [masterAllergens, setMasterAllergens] = useState<AllergenMaster[]>([]);

  // ✅ selected code inside Allergens list/table
  const [selectedAllergenCode, setSelectedAllergenCode] = useState<string | null>(null);

  // ✅ show code when tapping allergen icon under a dish (badge under clicked icon on mobile)
  const [activeAllergenKey, setActiveAllergenKey] = useState<string | null>(null);

  const RESTAURANT_NAME_LINE1 = "Bistro";
  const RESTAURANT_NAME_LINE2 = "ER & ES";
  const ADDRESS = "23 1970, 7425 Тодорово";
  const PHONE_DISPLAY = "089 532 5933";
  const PHONE_TEL = "+359895325933";

  const sectionRefs = useRef<Record<number, HTMLDivElement | null>>({});

  function mapsUrl(addr: string) {
    const q = encodeURIComponent(addr);
    const ua = navigator.userAgent || "";
    const isiOS = /iPad|iPhone|iPod|Macintosh/.test(ua);
    return isiOS ? `maps://?q=${q}` : `https://www.google.com/maps/search/?api=1&query=${q}`;
  }

  function normCode(code?: string | null) {
    return String(code || "").trim().toUpperCase();
  }

  // ✅ like AvvaMenu: g/ml -> гр/мл
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
        code: a.code ? normCode(a.code) : null,
        name: a.name ? String(a.name).trim() : null,
        image_url: a.image_url ? String(a.image_url) : null,
      }))
      .filter((a) => !!a.code || !!a.name || !!a.image_url);
  }

  function allergenSrc(code?: string | null, backendUrl?: string | null) {
    const local = allergenIconUrl(code);
    if (local) return local;
    if (backendUrl) return String(backendUrl);
    return null;
  }

  function showDishAllergenCode(dishId: number, code: string) {
    const c = normCode(code);
    if (!c) return;

    const key = `${dishId}:${c}`;
    setActiveAllergenKey(key);

    window.setTimeout(() => {
      setActiveAllergenKey((cur) => (cur === key ? null : cur));
    }, 2200);
  }

  /* ---------- ТЕЛЕМЕТРИЯ ---------- */
  useEffect(() => {
    if (!slug) return;
    logQrScanOnceForSlug(slug);
    logMenuOpenForSlug(slug);
  }, [slug]);

  useEffect(() => {
    const q = query.trim();
    if (!slug || !q) return;
    logSearchDebounced(q, slug);
  }, [query, slug]);

  /* ---------- ЗАРЕЖДАНЕ НА ДАННИ ---------- */
  useEffect(() => {
    if (!slug) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    (async () => {
      try {
        setLoading(true);
        setNotFound(false);

        const [cRes, dRes] = await Promise.all([
          api.get(`/menu/${slug}/categories?only_active=1&sort=position,name&per_page=-1`),
          api.get(`/menu/${slug}/dishes?only_active=1&sort=position,name&per_page=-1`),
        ]);

        const catsData: Category[] = cRes.data.data ?? cRes.data;
        const dishesData: Dish[] = (dRes.data.data ?? dRes.data).filter((d: Dish) => d.is_active);

        const dishCategoryIds = new Set<number>();
        for (const d of dishesData) {
          const cid = (d as any).category?.id ?? (d as any).category_id;
          if (cid) dishCategoryIds.add(cid);
        }

        const onlyActiveCats = catsData.filter((c) => c.is_active && dishCategoryIds.has(c.id));

        setCats(onlyActiveCats);
        setDishes(dishesData);
        setActiveCat(onlyActiveCats.length ? onlyActiveCats[0].id : null);

        if (!onlyActiveCats.length) setNotFound(true);
      } catch (e: any) {
        const status = e?.response?.status;
        if (status === 404 || status === 422) setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();

    // ✅ load master allergens (same logic as AvvaMenu)
    setLoadingAllergens(true);
    api
      .get(`/menu/${slug}/allergens?only_active=1&per_page=-1`)
      .then((aRes) => {
        const list = (aRes.data.data ?? aRes.data) as AllergenMaster[];
        const cleaned = (Array.isArray(list) ? list : [])
          .map((a) => ({
            ...a,
            code: normCode(a.code),
            name: String(a.name || "").trim(),
            image_url: a.image_url ? String(a.image_url) : null,
          }))
          .filter((a) => !!a.code || !!a.name || !!a.image_url);

        setMasterAllergens(cleaned);
      })
      .catch(() => setMasterAllergens([]))
      .finally(() => setLoadingAllergens(false));
  }, [slug]);

  /* ---------- ГРУПИРАНЕ ПО КАТЕГОРИЯ ---------- */
  const grouped: Grouped = useMemo(() => {
    const g: Grouped = {};
    for (const d of dishes) {
      const cid = (d as any).category?.id ?? (d as any).category_id;
      if (!cid) continue;
      (g[cid] ||= []).push(d);
    }
    return g;
  }, [dishes]);

  /* ---------- ФИЛТЪР ПО ТЪРСЕНЕ ---------- */
  const filteredGrouped: Grouped = useMemo(() => {
    if (!query.trim()) return grouped;
    const q = query.toLowerCase();
    const res: Grouped = {};
    for (const [cidStr, arr] of Object.entries(grouped)) {
      const list = arr.filter(
        (d) => d.name.toLowerCase().includes(q) || (d.description ?? "").toLowerCase().includes(q)
      );
      if (list.length) res[Number(cidStr)] = list;
    }
    return res;
  }, [grouped, query]);

  /* ---------- ВИДИМИ КАТЕГОРИИ ---------- */
  const visibleCats = useMemo(() => {
    const withDishes = cats.filter((c) => (filteredGrouped[c.id] ?? []).length);
    if (query.trim()) return withDishes;
    if (activeCat != null) return withDishes.filter((c) => c.id === activeCat);
    return withDishes;
  }, [cats, filteredGrouped, query, activeCat]);

  function scrollToCat(id: number) {
    setView("menu");
    setSelectedAllergenCode(null);
    setActiveCat(id);
    const el = sectionRefs.current[id];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  useEffect(() => {
    if (!visibleCats.length) return;

    const io = new IntersectionObserver(
      (entries) => {
        const firstVisible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (firstVisible) {
          const idAttr = firstVisible.target.getAttribute("data-cid");
          if (idAttr) setActiveCat(Number(idAttr));
        }
      },
      { threshold: 0.35 }
    );

    visibleCats.forEach((c) => {
      const el = sectionRefs.current[c.id];
      if (el) io.observe(el);
    });

    return () => io.disconnect();
  }, [visibleCats]);

  // ✅ show allergens menu ONLY if we have master allergens (restaurant allowed)
  const hasAllergens = (masterAllergens?.length ?? 0) > 0;

  // ✅ if allergens removed -> hide allergens view automatically
  useEffect(() => {
    if (!hasAllergens && view === "allergens") {
      setView("menu");
      setSelectedAllergenCode(null);
    }
  }, [hasAllergens, view]);

  function openAllergens() {
    if (!hasAllergens) return;
    setView("allergens");
    setSelectedAllergenCode(null);
  }

  if (notFound) return <NotFound />;

  return (
    <div className="min-h-screen text-slate-900 flex flex-col">
      {/* HEADER */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/eres-logo.png"
              alt="Logo"
              className="h-[108px] w-[108px] object-contain rounded-md"
            />

            <div className="flex flex-col">
              <span className="text-xs font-semibold tracking-[0.2em] uppercase text-slate-500">
                Digital Menu
              </span>
              <h1 className="text-xl font-bold leading-tight">
                <span className="block md:inline">{RESTAURANT_NAME_LINE1}</span>{" "}
                <span className="block md:inline">{RESTAURANT_NAME_LINE2}</span>
              </h1>
            </div>
          </div>
        </div>
      </header>

      {/* SEARCH BAR */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="relative">
            <input
              id="menu_search"
              name="menu_search"
              className="w-full border border-slate-300 rounded-full py-2.5 pl-4 pr-10 text-sm outline-none focus:ring-2 focus:ring-slate-300 focus:border-slate-400 bg-slate-50"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const q = query.trim();
                  if (slug && q) logSearchImmediate(q, slug);
                  e.currentTarget.blur();
                }
              }}
              placeholder="Search in the menu..."
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
              🔎
            </span>
          </div>
        </div>
      </div>

      {/* ✅ MOBILE: category slider (+ Allergens only if hasAllergens) */}
      <div className="md:hidden bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-3 py-2">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {cats.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => scrollToCat(c.id)}
                className={[
                  "shrink-0 px-4 py-2 rounded-full text-sm border transition",
                  view === "menu" && activeCat === c.id
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50",
                ].join(" ")}
              >
                {c.name}
              </button>
            ))}

            {hasAllergens && (
              <button
                type="button"
                onClick={openAllergens}
                className={[
                  "shrink-0 px-4 py-2 rounded-full text-sm border transition",
                  view === "allergens"
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50",
                ].join(" ")}
              >
                Алергени
              </button>
            )}
          </div>
        </div>
      </div>

      {/* MAIN */}
      <main className="flex-1 pb-10">
        <div className="max-w-6xl mx-auto px-4 py-4 grid grid-cols-1 md:grid-cols-[minmax(240px,280px)_minmax(0,1fr)] gap-4">
          {/* ✅ DESKTOP sidebar */}
          <aside className="hidden md:block space-y-4">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col items-start gap-3">
              <img src="/eres-logo.png" alt="Logo" className="h-14 w-14 object-contain rounded-md" />

              <div className="flex flex-col gap-2 mt-1">
                <a
                  href={mapsUrl(ADDRESS)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-end gap-1 hover:text-slate-900 hover:underline"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" className="opacity-70">
                    <path
                      fill="currentColor"
                      d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7m0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5Z"
                    />
                  </svg>
                  {ADDRESS}
                </a>

                <a
                  href={`tel:${PHONE_TEL}`}
                  className="inline-flex items-center gap-1 text-sm text-emerald-700 hover:text-emerald-800 font-medium"
                >
                  📞 {PHONE_DISPLAY}
                </a>
              </div>

              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                За резервации и запитвания – последвайте ни в социалните мрежи или се свържете
                директно с нашия екип.
              </p>
            </div>

            <nav className="bg-white rounded-xl shadow-sm border border-slate-200 max-height-[70vh] max-h-[70vh] overflow-y-auto">
              {cats.map((c) => (
                <button
                  key={c.id}
                  onClick={() => scrollToCat(c.id)}
                  className={
                    "w-full text-left px-3 py-2 text-sm border-b border-slate-100 last:border-b-0 transition " +
                    (view === "menu" && activeCat === c.id
                      ? "bg-slate-900 text-white font-semibold"
                      : "bg-white text-slate-700 hover:bg-slate-50")
                  }
                >
                  {c.name}
                </button>
              ))}

              {hasAllergens && (
                <button
                  type="button"
                  onClick={openAllergens}
                  className={[
                    "w-full text-left px-3 py-2 text-sm border-t border-slate-100 transition",
                    view === "allergens"
                      ? "bg-slate-900 text-white font-semibold"
                      : "bg-white text-slate-700 hover:bg-slate-50",
                  ].join(" ")}
                >
                  Алергени
                </button>
              )}
            </nav>
          </aside>

          {/* CONTENT */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 md:p-5">
            {/* ✅ ALLERGENS PAGE (mobile + desktop) */}
            {view === "allergens" && hasAllergens ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Алергени</div>
                    <div className="text-xs text-slate-500">Кликни икона за код</div>
                  </div>

                  {selectedAllergenCode ? (
                    <span className="text-xs font-mono rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700">
                      {selectedAllergenCode}
                    </span>
                  ) : null}
                </div>

                {(loading || loadingAllergens) && (
                  <div className="rounded-xl border bg-white p-4 text-sm text-slate-600">Зареждане…</div>
                )}

                {!loading && !loadingAllergens && (
                  <div className="overflow-hidden rounded-xl border border-slate-200">
                    <div className="grid grid-cols-[72px_1fr] bg-slate-50 text-xs text-slate-600">
                      <div className="px-3 py-2">Икона</div>
                      <div className="px-3 py-2">Име</div>
                    </div>

                    <div className="divide-y divide-slate-100 bg-white">
                      {masterAllergens.map((a) => {
                        const code = normCode(a.code);
                        const name = String(a.name || "").trim();
                        const src = allergenSrc(code, a.image_url ?? null);

                        return (
                          <button
                            key={`${code || a.id}`}
                            type="button"
                            onClick={() => {
                              if (!code) return;
                              setSelectedAllergenCode(code);
                            }}
                            className="w-full text-left grid grid-cols-[72px_1fr] items-center px-0 hover:bg-slate-50 active:bg-slate-100 transition"
                          >
                            <div className="px-3 py-3 flex items-center justify-center">
                              <span
                                className="h-14 w-14 rounded-full bg-white ring-1 ring-slate-200 shadow-sm inline-flex items-center justify-center
                                           transition hover:shadow-md hover:-translate-y-[1px] hover:ring-slate-300"
                                title={code}
                              >
                                {src ? (
                                  <img
                                    src={src}
                                    alt={code}
                                    className="h-8 w-8 object-contain"
                                    loading="lazy"
                                  />
                                ) : null}
                              </span>
                            </div>

                            <div className="px-3 py-3 min-w-0">
                              <div className="text-sm font-semibold text-slate-900 truncate">{name || "—"}</div>
                              <div className="text-[11px] text-slate-500 font-mono">{code || "—"}</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* ✅ MENU */
              <div>
                {loading && <div className="py-10 text-center text-slate-500 text-sm">Зареждане…</div>}

                {!loading &&
                  visibleCats.map((c) => {
                    const list = filteredGrouped[c.id] ?? [];
                    if (!list.length) return null;

                    return (
                      <section
                        key={c.id}
                        ref={(el: HTMLDivElement | null) => {
                          sectionRefs.current[c.id] = el;
                        }}
                        data-cid={c.id}
                        className="mb-8 last:mb-0"
                      >
                        {c.image_url && (
                          <div className="mb-4 rounded-2xl overflow-hidden relative h-40 md:h-52">
                            <img src={c.image_url} alt={c.name} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                            <div className="absolute bottom-3 left-4">
                              <p className="text-[10px] uppercase tracking-[0.3em] text-slate-200">Категория</p>
                              <h2 className="text-2xl md:text-3xl font-semibold text-white">{c.name}</h2>
                            </div>
                          </div>
                        )}

                        {!c.image_url && <h2 className="text-lg font-semibold mb-4">{c.name}</h2>}

                        <ul className="space-y-2">
                          {list.map((d) => {
                            const pLabel = portionLabel(d);
                            const aList = dishAllergens(d);

                            return (
                              <li
                                key={d.id}
                                className="flex gap-3 items-start py-2 border-b border-slate-100 last:border-b-0"
                              >
                                {d.image_url && (
                                  <img
                                    src={d.image_url}
                                    loading="lazy"
                                    className="h-14 w-14 rounded-lg object-cover border border-slate-200 flex-shrink-0 cursor-pointer"
                                    onClick={() => setLightboxImage(d.image_url!)}
                                    alt=""
                                  />
                                )}

                                <div className="flex-1">
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <h3 className="text-sm font-semibold text-slate-900">{d.name}</h3>

                                      {d.description && <p className="mt-1 text-xs text-slate-600">{d.description}</p>}

                                      {pLabel && <div className="mt-1 text-[11px] text-slate-600">{pLabel}</div>}

                                      {/* ✅ allergens under dish ONLY if restaurant actually has allergens enabled */}
                                      {hasAllergens && aList.length > 0 && (
                                        <div className="mt-2">
                                          <div className="flex flex-wrap gap-2">
                                            {aList.map((a) => {
                                              const code = normCode(a.code);
                                              if (!code) return null;

                                              const src = allergenSrc(code, a.image_url ?? null);
                                              if (!src) return null;

                                              const isActive = activeAllergenKey === `${d.id}:${code}`;

                                              return (
                                                <div
                                                  key={`${d.id}:${a.id}:${code}`}
                                                  className="relative inline-flex flex-col items-center"
                                                >
                                                  <button
                                                    type="button"
                                                    onClick={() => showDishAllergenCode(d.id, code)}
                                                    className="h-12 w-12 rounded-full bg-white ring-1 ring-slate-200 shadow-sm inline-flex items-center justify-center
                                                               transition hover:shadow-md hover:-translate-y-[1px] hover:ring-slate-300 active:shadow active:translate-y-0
                                                               focus:outline-none focus:ring-2 focus:ring-slate-300"
                                                    title={code}
                                                    aria-label={code}
                                                  >
                                                    <img src={src} alt={code} className="h-7 w-7 object-contain" loading="lazy" />
                                                  </button>

                                                  {/* ✅ code under the exact clicked icon (mobile only) */}
                                                  {isActive ? (
                                                    <div className="mt-1 md:hidden">
                                                      <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-mono text-slate-700">
                                                        {code}
                                                      </span>
                                                    </div>
                                                  ) : null}
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      )}
                                    </div>

                                    {!!d.price && (
                                      <div className="text-right text-xs font-semibold text-slate-900 whitespace-nowrap">
                                        <div>{fmtEUR.format(d.price)}</div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </section>
                    );
                  })}
              </div>
            )}
          </section>
        </div>
      </main>

      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4"
          onClick={() => setLightboxImage(null)}
        >
          <img
            src={lightboxImage}
            alt=""
            className="max-w-full max-h-[90vh] rounded-xl object-contain shadow-lg"
          />
        </div>
      )}

      <MenuFooter />
    </div>
  );
}
