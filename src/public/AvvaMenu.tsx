// src/public/AvvaMenu.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import api from "../lib/api";
import type { Category, Dish } from "../lib/types";
import { bgnToEur, fmtBGN, fmtEUR } from "../lib/money";
import NotFound from "../pages/NotFound";
import { MenuFooter } from "../components/MenuFooter";

type Grouped = Record<number, Dish[]>;
type Pill = "food" | "bar" | "allergens";
type Allergen = { id: number; code: string; name: string; is_active?: boolean };

const WRAP = "mx-auto max-w-4xl px-4";

export default function AvvaMenu() {
  const { slug } = useParams<{ slug: string }>();

  const [cats, setCats] = useState<Category[]>([]);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true); // за категории+ястия
  const [loadingAllergens, setLoadingAllergens] = useState(false); // само алергени
  const [notFound, setNotFound] = useState(false);
  const [query, setQuery] = useState("");

  const [sp, setSp] = useSearchParams();
  const initialPill = (sp.get("tab") as Pill) || "food";
  const [pill, setPill] = useState<Pill>(initialPill);
  const [allergens, setAllergens] = useState<Allergen[]>([]);
  const [aQuery, setAQuery] = useState("");

  useEffect(() => {
    const next = new URLSearchParams(sp);
    next.set("tab", pill);
    setSp(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pill]);

  const [openedCatId, setOpenedCatId] = useState<number | null>(null);

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

  const sectionRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const setSectionRef = (id: number) => (el: HTMLDivElement | null) => {
    sectionRefs.current[id] = el;
  };

  // ---------- Зареждане на данни ----------
  useEffect(() => {
    if (!slug) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    // 1) Критично: категории + ястия
    setLoading(true);
    (async () => {
      try {
        const [cRes, dRes] = await Promise.all([
          api.get("/categories?only_active=1&sort=position,name&per_page=-1"),
          api.get("/dishes?only_active=1&sort=position,name&per_page=-1"),
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

    // 2) Некритично: алергени (ако падне — игнорираме)
    setLoadingAllergens(true);
    api
      .get("/allergens?only_active=1&per_page=-1")
      .then((aRes) => setAllergens(aRes.data.data ?? aRes.data))
      .catch(() => setAllergens([]))
      .finally(() => setLoadingAllergens(false));
  }, [slug]);

  // групиране на ястията по категория
  const grouped: Grouped = useMemo(() => {
    const g: Grouped = {};
    for (const d of dishes) {
      const cid = (d as any).category?.id ?? (d as any).category_id;
      if (!cid) continue;
      (g[cid] ||= []).push(d);
    }
    return g;
  }, [dishes]);

  // helper за category_id от ястие
  const getDishCategoryId = (d: Dish) =>
    (d as any).category?.id ?? (d as any).category_id ?? null;

  // ЛОГИКА ЗА BAR КАТЕГОРИИ
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

  // кои категории имат поне едно ястие, съвпадащо с търсенето (по име/описание)
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

  // При търсене: отваряме категорията на първото намерено ястие и сменяме таба при нужда
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
  }, [query, dishes, cats]); // не включваме pill/openedCatId — ще се сетнат вътре ако трябва

  const tilesToShow: Category[] = useMemo(() => {
    let list = cats;
    if (pill === "bar") list = cats.filter((c) => isBarCategory(c.name));
    if (pill === "food") list = cats.filter((c) => !isBarCategory(c.name));
    return list;
  }, [cats, pill]);

  // без търсене → плочките според таба
  // с търсене → показваме всички категории, които съвпадат по име ИЛИ имат съвпадащо ястие
  const filteredTiles: Category[] = useMemo(() => {
    const s = query.trim().toLowerCase();
    if (!s) return tilesToShow;
    return cats.filter(
      (c) => c.name.toLowerCase().includes(s) || dishMatchCatIds.has(c.id)
    );
  }, [cats, tilesToShow, query, dishMatchCatIds]);

  const openCategory = (id: number) => setOpenedCatId(id);
  const backToTiles = () => setOpenedCatId(null);

  // ⚠️ махаме авто-затварянето при търсене – то пречеше да се отвори намерената категория
  // useEffect(() => {
  //   if (query.trim()) setOpenedCatId(null);
  // }, [query]);

  const filteredAllergens = useMemo(() => {
    const q = aQuery.trim().toLowerCase();
    if (!q) return allergens;
    return allergens.filter(
      (a) => a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q)
    );
  }, [allergens, aQuery]);

  if (notFound) return <NotFound />;

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
          {/* STICKY TOP BAR (само вътре в категория) */}
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
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {BRAND.logoUrl ? (
                <img
                  src={BRAND.logoUrl}
                  className="h-10 w-10 rounded-full object-cover border"
                />
              ) : null}
              <h1
                className="text-xl sm:text-2xl md:text-3xl font-bold"
                style={{ color: BRAND.color.primary }}
              >
                {BRAND.name}
              </h1>
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
              {/* Facebook (неутрален стил) */}
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

              {/* Instagram (неутрален стил) */}
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
              { key: "allergens", label: "Allergens" },
            ].map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => {
                  setPill(p.key as Pill);
                  setOpenedCatId(null);
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
        {/* Allergens */}
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
                      <th className="px-3 py-2 text-left w-28">Код</th>
                      <th className="px-3 py-2 text-left">Алерген</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAllergens.map((a, i) => (
                      <tr
                        key={a.id}
                        className={i % 2 === 0 ? "bg-white" : "bg-neutral-50/60"}
                        title={`${a.code} — ${a.name}`}
                      >
                        <td className="px-3 py-2 font-semibold whitespace-nowrap">
                          {a.code}
                        </td>
                        <td className="px-3 py-2 break-words">{a.name}</td>
                      </tr>
                    ))}
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
              <div className="py-10 text-center text-neutral-300">
                Няма категории.
              </div>
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

            // филтър на ястията вътре в категория при търсене
            const s = query.trim().toLowerCase();
            if (s) {
              list = list.filter(
                (d) =>
                  d.name.toLowerCase().includes(s) ||
                  (d.description && d.description.toLowerCase().includes(s))
              );
            }

            // Grid Layout за Food категории, List Layout за Bar/Drinks
            const isGridLayout = !isBarCategory(c?.name ?? "");

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
                    {list.map((d) => (
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
                                  {fmtBGN.format(d.price)}
                                </div>
                                <div className="opacity-60">
                                  ({fmtEUR.format(bgnToEur(d.price))})
                                </div>
                              </div>
                            )}
                          </div>

                          {!!d.description && (
                            <p className="text-sm text-neutral-700 mt-2">
                              {d.description}
                            </p>
                          )}

                          {!d.is_active && (
                            <div className="mt-2 text-xs uppercase text-neutral-500">
                              недостъпно
                            </div>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl overflow-hidden border border-black bg-white">
                    <ul className="divide-y">
                      {list.map((d) => (
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
                          </div>
                          {!!d.price && (
                            <div className="text-right text-sm font-semibold">
                              <div className="text-[#FFC107]">
                                {fmtBGN.format(d.price)}
                              </div>
                              <div className="opacity-60">
                                ({fmtEUR.format(bgnToEur(d.price))})
                              </div>
                            </div>
                          )}
                        </li>
                      ))}
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
