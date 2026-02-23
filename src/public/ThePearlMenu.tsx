// src/public/ThePearlMenu.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import api from "../lib/api";
import type { Category, Dish } from "../lib/types";
import NotFound from "../pages/NotFound";
import { fmtEUR } from "../lib/money";
import { MenuFooter } from "../components/MenuFooter";
import {
  logQrScanOnceForSlug,
  logMenuOpenForSlug,
  logSearchDebounced,
  logSearchImmediate,
} from "../lib/telemetry";
import { allergenIconUrl } from "../lib/allergenIcons";

import "./thepearl.css";

type DishAllergen = {
  id: number;
  code?: string | null;
  name?: string | null;
  image_url?: string | null;
};

type AllergenMaster = {
  id: number
  code: string;
  name: string;
  image_url?: string | null;
  is_active?: boolean;
};

type ViewMode = "menu" | "allergens";

type MenuConfig = {
  ui?: { langs?: string[]; default?: string };
  content?: { langs?: string[]; default?: string };
};

function uniqLower(list: any[]): string[] {
  return Array.from(
    new Set((list ?? []).map((x) => String(x ?? "").trim().toLowerCase()))
  ).filter(Boolean);
}

function normCode(code?: string | null) {
  return String(code || "").trim().toUpperCase();
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

// като Eres: g/ml -> гр/мл
function portionLabel(d: Dish) {
  const v = (d as any).portion_value as number | null | undefined;
  const u = (d as any).portion_unit as string | null | undefined;
  if (v == null || !u) return null;

  const unit = String(u).toLowerCase().trim();
  if (unit === "g") return `${v} гр`;
  if (unit === "ml") return `${v} мл`;
  return `${v} ${u}`;
}

/** local debounce (за UI филтър + telemetry) */
function useDebouncedValue<T>(value: T, delayMs: number) {
  const [deb, setDeb] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDeb(value), delayMs);
    return () => window.clearTimeout(t);
  }, [value, delayMs]);
  return deb;
}

export default function ThePearlMenu() {
  const nav = useNavigate();
  const { slug, cid } = useParams<{ slug: string; cid?: string }>();
  const [sp, setSp] = useSearchParams();

  const [cats, setCats] = useState<Category[]>([]);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [loadingAllergens, setLoadingAllergens] = useState(false);
  const [masterAllergens, setMasterAllergens] = useState<AllergenMaster[]>([]);

  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [activeAllergenKey, setActiveAllergenKey] = useState<string | null>(null);

  // ✅ Allergens view
  const [view, setView] = useState<ViewMode>("menu");
  const [selectedAllergenCode, setSelectedAllergenCode] = useState<string | null>(
    null
  );

  // ✅ Search (client-side) + debounce
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 350);
  const lastLoggedRef = useRef<string>("");

  const cidNum = cid ? Number(cid) : null;

  // ✅ multilingual (public)
  const [cfg, setCfg] = useState<MenuConfig | null>(null);
  const [langs, setLangs] = useState<string[]>(["bg"]);
  const [lang, setLang] = useState<string>("bg");
  const hasLangSwitcher = langs.length > 1;

  /* ---------- telemetry open ---------- */
  useEffect(() => {
    if (!slug) return;
    logQrScanOnceForSlug(slug);
    logMenuOpenForSlug(slug);
  }, [slug]);

  /* ---------- telemetry search (debounced) ---------- */
  useEffect(() => {
    const q = debouncedQuery.trim();
    if (!slug) return;
    if (q.length < 2) return;

    if (lastLoggedRef.current === q) return;
    lastLoggedRef.current = q;

    logSearchDebounced(q, slug);
  }, [debouncedQuery, slug]);

  // ✅ Load config -> langs -> initial lang + URL hygiene
  useEffect(() => {
    if (!slug) return;

    (async () => {
      try {
        const res = await api.get(`/menu/${slug}/config`);
        const data: MenuConfig = res.data;

        const uiLangs = uniqLower(data?.ui?.langs ?? []);
        const contentLangs = uniqLower(data?.content?.langs ?? []);

        let allowed: string[] = [];
        if (uiLangs.length && contentLangs.length) {
          allowed = uiLangs.filter((l) => contentLangs.includes(l));
        }
        if (!allowed.length) allowed = contentLangs.length ? contentLangs : uiLangs;

        const uniqAllowed = Array.from(new Set(allowed)).filter(Boolean);
        const effectiveLangs = uniqAllowed.length ? uniqAllowed : ["bg"];

        const def = String(
          data?.content?.default ?? data?.ui?.default ?? "bg"
        )
          .trim()
          .toLowerCase();

        const urlLang =
          effectiveLangs.length > 1 ? String(sp.get("lang") ?? "").trim().toLowerCase() : "";

        const initial =
          urlLang && effectiveLangs.includes(urlLang)
            ? urlLang
            : effectiveLangs.includes(def)
              ? def
              : effectiveLangs[0];

        setCfg(data);
        setLangs(effectiveLangs);
        setLang(initial);

        // URL hygiene:
        const next = new URLSearchParams(sp);
        if (effectiveLangs.length <= 1) {
          next.delete("lang"); // ✅ no ?lang= when not multilingual
        } else {
          next.set("lang", initial);
        }
        setSp(next, { replace: true });
      } catch {
        setCfg(null);
        setLangs(["bg"]);
        setLang("bg");

        const next = new URLSearchParams(sp);
        next.delete("lang");
        setSp(next, { replace: true });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  /* ---------- load menu + allergens (refetch on lang only if multi) ---------- */
  useEffect(() => {
    if (!slug) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    const langQS = hasLangSwitcher ? `&lang=${encodeURIComponent(lang)}` : "";

    (async () => {
      try {
        setLoading(true);
        setNotFound(false);

        const [cRes, dRes] = await Promise.all([
          api.get(
            `/menu/${slug}/categories?only_active=1&sort=position,name&per_page=-1${langQS}`
          ),
          api.get(
            `/menu/${slug}/dishes?only_active=1&sort=position,name&per_page=-1${langQS}`
          ),
        ]);

        const catsData: Category[] = cRes.data.data ?? cRes.data;
        const dishesData: Dish[] = (dRes.data.data ?? dRes.data).filter(
          (d: Dish) => d.is_active
        );

        // only categories that have dishes
        const dishCategoryIds = new Set<number>();
        for (const d of dishesData) {
          const cId = (d as any).category?.id ?? (d as any).category_id;
          if (cId) dishCategoryIds.add(cId);
        }

        const onlyActiveCats = catsData.filter(
          (c) => c.is_active && dishCategoryIds.has(c.id)
        );
        setCats(onlyActiveCats);
        setDishes(dishesData);

        if (!onlyActiveCats.length) setNotFound(true);
      } catch (e: any) {
        const status = e?.response?.status;
        if (status === 404 || status === 422) setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();

    setLoadingAllergens(true);
    api
      .get(`/menu/${slug}/allergens?only_active=1&per_page=-1${langQS}`)
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
  }, [slug, lang, hasLangSwitcher]);

  const hasAllergens = (masterAllergens?.length ?? 0) > 0;

  // ако няма алергени – не стоим в allergens view
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

  function showDishAllergenCode(dishId: number, code: string) {
    const c = normCode(code);
    if (!c) return;

    const key = `${dishId}:${c}`;
    setActiveAllergenKey(key);

    window.setTimeout(() => {
      setActiveAllergenKey((cur) => (cur === key ? null : cur));
    }, 2200);
  }

  const activeCategory = useMemo(() => {
    if (!cidNum) return null;
    return cats.find((c) => c.id === cidNum) ?? null;
  }, [cats, cidNum]);

  /* ---------- search filtering ---------- */
  const filteredCategoryDishes = useMemo(() => {
    if (!cidNum) return [];
    const base = dishes.filter((d) => {
      const cId = (d as any).category?.id ?? (d as any).category_id;
      return Number(cId) === cidNum;
    });

    const q = debouncedQuery.trim().toLowerCase();
    if (q.length < 2) return base;

    return base.filter((d: any) => {
      const name = String(d.name || "").toLowerCase();
      const desc = String(d.description || "").toLowerCase();
      return name.includes(q) || desc.includes(q);
    });
  }, [dishes, cidNum, debouncedQuery]);

  const filteredCatsForGrid = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (q.length < 2) return cats;

    const byName = new Set<number>();

    cats.forEach((c) => {
      if (String(c.name || "").toLowerCase().includes(q)) byName.add(c.id);
    });

    dishes.forEach((d: any) => {
      const name = String(d.name || "").toLowerCase();
      const desc = String(d.description || "").toLowerCase();
      if (name.includes(q) || desc.includes(q)) {
        const cId = (d as any).category?.id ?? (d as any).category_id;
        if (cId) byName.add(Number(cId));
      }
    });

    return cats.filter((c) => byName.has(c.id));
  }, [cats, dishes, debouncedQuery]);

  const filteredAllergens = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (q.length < 2) return masterAllergens;
    return masterAllergens.filter((a) => {
      const name = String(a.name || "").toLowerCase();
      const code = String(a.code || "").toLowerCase();
      return name.includes(q) || code.includes(q);
    });
  }, [masterAllergens, debouncedQuery]);

  const flagSrc = (l: string) => `/flags/${l}.svg`;

  if (notFound) return <NotFound />;

  return (
    <div className="tp-page">
      <header className="tp-header">
        {(cid || (!cid && view === "allergens")) ? (
          <button
            className="tp-back"
            onClick={() => {
              if (cid) {
                const suffix = hasLangSwitcher ? `?lang=${encodeURIComponent(lang)}` : "";
                nav(`/menu/${slug}${suffix}`);
              } else {
                setView("menu");
                setSelectedAllergenCode(null);
              }
            }}
          >
            Назад
          </button>
        ) : null}

        <img src="/assets/thepearl/logo.png" alt="The Pearl" className="tp-logo" />

        {/* ✅ Flags only when multilingual */}
        {hasLangSwitcher ? (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
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
                title={l.toUpperCase()}
                aria-label={`Switch language to ${l}`}
                style={{
                  width: 34,
                  height: 24,
                  borderRadius: 6,
                  overflow: "hidden",
                  border:
                    l === lang ? "2px solid rgba(215,180,106,0.95)" : "1px solid rgba(255,255,255,.35)",
                  background: "rgba(0,0,0,.25)",
                  padding: 0,
                }}
              >
                <img
                  src={flagSrc(l)}
                  alt={l}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
              </button>
            ))}
          </div>
        ) : null}
      </header>

      {/* SEARCH BAR (solid) */}
      <div className="tp-searchbar">
        <div className="tp-searchwrap">
          <input
            className="tp-searchinput"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Търси по ястие, категория или алерген…"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                const q = query.trim();
                if (slug && q.length >= 2) logSearchImmediate(q, slug);
                (e.currentTarget as HTMLInputElement).blur();
              }
              if (e.key === "Escape") setQuery("");
            }}
            aria-label="Search"
          />
          {query ? (
            <button className="tp-searchclear" onClick={() => setQuery("")} aria-label="Clear">
              ✕
            </button>
          ) : (
            <span className="tp-searchicon">🔎</span>
          )}
        </div>

        {!cid && hasAllergens ? (
          <div className="tp-top-tabs">
            <button
              className={`tp-tab ${view === "allergens" ? "is-active" : ""}`}
              onClick={openAllergens}
              type="button"
            >
              Алергени
            </button>
          </div>
        ) : null}
      </div>

      <div className="tp-body">
        {loading ? (
          <div className="tp-loading">Зареждане…</div>
        ) : !cid && view === "allergens" && hasAllergens ? (
          /* ALLERGENS VIEW */
          <section className="tp-allergens-page">
            <div className="tp-allergens-head">
              <div className="tp-allergens-title">Алергени</div>
              {selectedAllergenCode ? (
                <span className="tp-allergens-selected">{selectedAllergenCode}</span>
              ) : (
                <span className="tp-allergens-hint">Кликни ред за code</span>
              )}
            </div>

            {loadingAllergens ? <div className="tp-loading">Зареждане…</div> : null}

            {!loadingAllergens && (
              <div className="tp-allergens-list">
                {filteredAllergens.map((a) => {
                  const code = normCode(a.code);
                  const name = String(a.name || "").trim();
                  const src = allergenSrc(code, a.image_url ?? null);
                  const isSelected = !!code && selectedAllergenCode === code;

                  return (
                    <button
                      key={`${code || a.id}`}
                      type="button"
                      className={`tp-allergen-row ${isSelected ? "is-selected" : ""}`}
                      onClick={() => {
                        if (!code) return;
                        setSelectedAllergenCode(code);
                      }}
                    >
                      <div className="tp-allergen-row-iconwrap">
                        <span className="tp-allergen-row-iconbg" title={code}>
                          {src ? <img src={src} alt={code} className="tp-allergen-row-icon" /> : null}
                        </span>
                      </div>

                      <div className="tp-allergen-row-main">
                        <div className="tp-allergen-row-name">{name || "—"}</div>
                        <div className="tp-allergen-row-code">{code || "—"}</div>
                      </div>
                    </button>
                  );
                })}

                {!filteredAllergens.length ? (
                  <div className="tp-empty">
                    {debouncedQuery.trim().length >= 2 ? "Няма алергени за това търсене." : "Няма алергени."}
                  </div>
                ) : null}
              </div>
            )}
          </section>
        ) : cid && cidNum ? (
          /* CATEGORY DISHES VIEW */
          <section className="tp-category-view">
            <h2 className="tp-category-title">{activeCategory?.name ?? ""}</h2>

            {!filteredCategoryDishes.length ? (
              <div className="tp-empty">
                {debouncedQuery.trim().length >= 2
                  ? "Няма резултати за търсенето в тази категория."
                  : "Няма продукти в тази категория."}
              </div>
            ) : (
              <div className="tp-dish-grid">
                {filteredCategoryDishes.map((d: any) => {
                  const img = d.image_url || null;
                  const pLabel = portionLabel(d);
                  const aList = dishAllergens(d);

                  return (
                    <article key={d.id} className="tp-dish-card">
                      {img ? (
                        <button
                          type="button"
                          className="tp-dish-card-imgbtn"
                          onClick={() => setLightboxImage(img)}
                          aria-label="Open image"
                        >
                          <img src={img} alt={d.name} className="tp-dish-card-img" loading="lazy" />
                        </button>
                      ) : null}

                      <div className="tp-dish-card-body">
                        <div className="tp-dish-card-title">{d.name}</div>

                        {d.description ? <div className="tp-dish-card-desc">{d.description}</div> : null}

                        {(pLabel || (hasAllergens && aList.length)) ? (
                          <div className="tp-dish-card-meta">
                            {pLabel ? <div className="tp-portion">{pLabel}</div> : null}

                            {hasAllergens && aList.length > 0 ? (
                              <div className="tp-allergens">
                                {aList.map((a) => {
                                  const code = normCode(a.code);
                                  if (!code) return null;

                                  const src = allergenSrc(code, a.image_url ?? null);
                                  if (!src) return null;

                                  const isActive = activeAllergenKey === `${d.id}:${code}`;

                                  return (
                                    <div key={`${d.id}:${a.id}:${code}`} className="tp-allergen">
                                      <button
                                        type="button"
                                        onClick={() => showDishAllergenCode(d.id, code)}
                                        className="tp-allergen-btn"
                                        title={code}
                                        aria-label={code}
                                      >
                                        <img src={src} alt={code} className="tp-allergen-icon" loading="lazy" />
                                      </button>

                                      {isActive ? (
                                        <div className="tp-allergen-code">
                                          <span>{code}</span>
                                        </div>
                                      ) : null}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : null}
                          </div>
                        ) : null}

                        {!!d.price && <div className="tp-dish-card-price">{fmtEUR.format(d.price)}</div>}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        ) : (
          /* CATEGORIES GRID (default) */
          <section className="tp-cat-grid">
            {filteredCatsForGrid.length === 0 ? (
              <div className="tp-empty">
                {debouncedQuery.trim().length >= 2 ? "Няма резултати за търсенето." : "Няма категории."}
              </div>
            ) : (
              filteredCatsForGrid.map((c) => (
                <button
                  key={c.id}
                  className="tp-cat-card"
                  onClick={() => {
                    const suffix = hasLangSwitcher ? `?lang=${encodeURIComponent(lang)}` : "";
                    nav(`/menu/${slug}/c/${c.id}${suffix}`);
                  }}
                  style={c.image_url ? { backgroundImage: `url(${c.image_url})` } : undefined}
                >
                  <div className="tp-cat-title">{c.name}</div>
                </button>
              ))
            )}
          </section>
        )}
      </div>

      {lightboxImage && (
        <div className="tp-lightbox" onClick={() => setLightboxImage(null)}>
          <img src={lightboxImage} alt="" className="tp-lightbox-img" />
        </div>
      )}

      <MenuFooter />
    </div>
  );
}
