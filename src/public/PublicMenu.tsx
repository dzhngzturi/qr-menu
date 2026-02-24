import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../lib/api";
import type { Category, Dish } from "../lib/types";
import { fmtEUR } from "../lib/money";
import NotFound from "../pages/NotFound";
import { MenuFooter } from "../components/MenuFooter";
import {
  logQrScanOnceForSlug,
  logTelemetry,
  logSearchDebounced,
  logSearchImmediate,
} from "../lib/telemetry";
import { useTranslation } from "react-i18next";

import PublicLangSwitcherFlags from "./PublicLangSwitcherFlags";
import { usePublicGate } from "../context/usePublicGate";

type Grouped = Record<number, Dish[]>;

/** ✅ Fixed rate: 1 EUR = 1.95583 BGN */
const EUR_TO_BGN = 1.95583;

/** ✅ Formatter for BGN */
const fmtBGN = new Intl.NumberFormat("bg-BG", {
  style: "currency",
  currency: "BGN",
});

export default function PublicMenu() {
  const { t } = useTranslation();
  const { slug } = useParams<{ slug: string }>();

  // ✅ single gate for ALL public pages
  const gate = usePublicGate();
  const canFetchMenu = gate.canFetch && !!slug;

  const [cats, setCats] = useState<Category[]>([]);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(false);

  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState<number | null>(null);
  const heroUrl = "/cover.jpg";

  const ADDRESS = "ул. Васил Левски 115, 7400 Исперих";
  const PHONE_DISPLAY = "089 958 8389";
  const PHONE_TEL = "+359899588389";

  function mapsUrl(addr: string) {
    const q = encodeURIComponent(addr);
    const ua = navigator.userAgent || "";
    const isiOS = /iPad|iPhone|iPod|Macintosh/.test(ua);
    return isiOS ? `maps://?q=${q}` : `https://www.google.com/maps/search/?api=1&query=${q}`;
  }

  const sectionRefs = useRef<Record<number, HTMLDivElement | null>>({});

  /* ---------- ТЕЛЕМЕТРИЯ (само ако ресторантът е валиден) ---------- */
  useEffect(() => {
    if (!canFetchMenu) return;

    logQrScanOnceForSlug(slug!);
    logTelemetry("menu_open");
  }, [canFetchMenu, slug]);

  useEffect(() => {
    if (!canFetchMenu) return;
    const q = query.trim();
    if (!q) return;
    logSearchDebounced(q, slug!);
  }, [query, canFetchMenu, slug]);

  /* ---------- Зареждане на categories + dishes (само ако canFetchMenu) ---------- */
  useEffect(() => {
    if (!canFetchMenu) {
      setCats([]);
      setDishes([]);
      setActiveCat(null);
      setLoading(false);
      return;
    }

    let mounted = true;

    (async () => {
      try {
        setLoading(true);

        const [cRes, dRes] = await Promise.all([
          api.get(`/menu/${slug}/categories`, {
            params: {
              lang: gate.lang,
              only_active: 1,
              sort: "position,name",
              per_page: -1,
            },
          }),
          api.get(`/menu/${slug}/dishes`, {
            params: {
              lang: gate.lang,
              only_active: 1,
              sort: "position,name",
              per_page: -1,
            },
          }),
        ]);

        if (!mounted) return;

        const catsData: Category[] = cRes.data.data ?? cRes.data;
        const dishesData: Dish[] = (dRes.data.data ?? dRes.data).filter((d: Dish) => d.is_active);

        const onlyActiveCats = catsData.filter((c) => c.is_active);

        setCats(onlyActiveCats);
        setDishes(dishesData);
        setActiveCat(onlyActiveCats.length ? onlyActiveCats[0].id : null);
      } catch {
        if (!mounted) return;
        setCats([]);
        setDishes([]);
        setActiveCat(null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [canFetchMenu, slug, gate.lang]);

  const grouped: Grouped = useMemo(() => {
    const g: Grouped = {};
    for (const d of dishes) {
      const cid = (d as any).category?.id ?? (d as any).category_id;
      if (!cid) continue;
      (g[cid] ||= []).push(d);
    }
    return g;
  }, [dishes]);

  const filteredGrouped: Grouped = useMemo(() => {
    const s = query.trim();
    if (!s) return grouped;

    const q = s.toLowerCase();
    const res: Grouped = {};
    for (const [cidStr, arr] of Object.entries(grouped)) {
      const list = arr.filter(
        (d) => d.name.toLowerCase().includes(q) || (d.description ?? "").toLowerCase().includes(q)
      );
      if (list.length) res[Number(cidStr)] = list;
    }
    return res;
  }, [grouped, query]);

  function scrollToCat(id: number) {
    setActiveCat(id);
    const el = sectionRefs.current[id];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  useEffect(() => {
    if (!cats.length) return;

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

    cats.forEach((c) => {
      const el = sectionRefs.current[c.id];
      if (el) io.observe(el);
    });

    return () => io.disconnect();
  }, [cats, filteredGrouped]);

  // ✅ Единствената “not found” логика идва от gate
  if (gate.notFound) return <NotFound />;
  if (!gate.loading && gate.error) return <NotFound />;

  return (
    <div className="min-h-screen bg-neutral-900 text-white">
      <header className="bg-neutral-900/95 top-0 z-30 border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold tracking-wide">VIVA bar&dinner</h1>

            <PublicLangSwitcherFlags />
          </div>

          <div className="mt-2 text-sm text-white/70 flex flex-wrap gap-x-4 gap-y-1">
            <a
              href={mapsUrl(ADDRESS)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:text-white hover:underline"
              title={t("public.navigate_title")}
              aria-label={t("public.open_in_maps_aria", { address: ADDRESS })}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" className="opacity-70">
                <path
                  fill="currentColor"
                  d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7m0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"
                />
              </svg>
              {ADDRESS}
            </a>

            <span>•</span>

            <a
              href={`tel:${PHONE_TEL}`}
              className="inline-flex items-center gap-1 hover:text-white hover:underline"
              title={t("public.call_title")}
              aria-label={t("public.call_aria", { phone: PHONE_DISPLAY })}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" className="opacity-70">
                <path
                  fill="currentColor"
                  d="M20 15.5c-1.25 0-2.47-.2-3.6-.58a1 1 0 0 0-1 .25l-2.2 2.2a15.05 15.05 0 0 1-6.58-6.58l2.2-2.2a1 1 0 0 0 .25-1c-.38-1.13-.58-2.35-.58-3.6A1 1 0 0 0 7.5 2h-3A1.5 1.5 0 0 0 3 3.5 17.5 17.5 0 0 0 20.5 21a1.5 1.5 0 0 0 1.5-1.5v-3a1 1 0 0 0-1-1Z"
                />
              </svg>
              {PHONE_DISPLAY}
            </a>
          </div>

          {/* HERO */}
          <div className="mt-3 relative rounded-2xl overflow-hidden h-40 md:h-52 border border-white/10">
            <div className="relative w-full h-[240px] md:h-[280px] lg:h-[320px] rounded-2xl border border-white/10 overflow-hidden">
              <img
                src={heroUrl}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
                style={{ objectPosition: "center 75%" }}
              />
              <div className="absolute inset-0 bg-black/25" />
            </div>

            <div className="absolute inset-0 bg-black/40" />
            <div className="relative h-full flex flex-col justify-end">
              <div className="p-3 md:p-4 flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                {cats.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => scrollToCat(c.id)}
                    className={
                      `px-3 py-1 rounded-full border whitespace-nowrap backdrop-blur ` +
                      (activeCat === c.id
                        ? "bg-white text-black border-white"
                        : "bg-black/40 text-white border-white/30 hover:bg-black/55")
                    }
                    title={c.name}
                    disabled={!canFetchMenu}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="mt-4 relative">
            <input
              id="menu_search"
              name="menu_search"
              className="w-full bg-neutral-800/70 border border-white/10 rounded-xl py-3 pl-4 pr-10 outline-none focus:ring-2 focus:ring-white/20 disabled:opacity-60"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const q = query.trim();
                  if (canFetchMenu && q) logSearchImmediate(q, slug!);
                  e.currentTarget.blur();
                }
              }}
              placeholder={t("public.search_placeholder")}
              disabled={!canFetchMenu}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40">🔎</span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 pb-24">
        {gate.loading && <div className="py-10 text-center text-white/60">{t("public.loading")}</div>}

        {!gate.loading && canFetchMenu && loading && (
          <div className="py-10 text-center text-white/60">{t("public.loading")}</div>
        )}

        {!gate.loading &&
          canFetchMenu &&
          !loading &&
          cats.map((c) => {
            const list = filteredGrouped[c.id] ?? [];
            if (!list.length) return null;

            return (
              <section
                key={c.id}
                ref={(el: HTMLDivElement | null) => {
                  sectionRefs.current[c.id] = el;
                }}
                data-cid={c.id}
                className="mt-6"
              >
                <div className="rounded-2xl overflow-hidden bg-neutral-800/60 border border-white/10">
                  {c.image_url ? (
                    <div className="h-52 md:h-64 w-full relative">
                      <img src={c.image_url} loading="lazy" className="h-full w-full object-cover" />
                      <div className="absolute inset-0 bg-black/40" />
                      <div className="absolute inset-x-0 bottom-0 p-4">
                        <h2 className="text-2xl md:text-3xl font-bold drop-shadow">
                          {c.name.toUpperCase()}
                        </h2>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4">
                      <h2 className="text-xl md:text-2xl font-bold">{c.name}</h2>
                    </div>
                  )}

                  <ul className="divide-y divide-white/5">
                    {list.map((d) => (
                      <li key={d.id} className="flex items-center gap-3 p-4 hover:bg-white/5 transition">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="text-[18px] font-medium">{d.name}</h3>
                            {!d.is_active && (
                              <span className="text-xs text-white/50 uppercase tracking-wide">
                                {t("public.unavailable")}
                              </span>
                            )}
                          </div>

                          {d.description && (
                            <p className="text-sm text-white/70 mt-0.5">{d.description}</p>
                          )}

                          {!!d.price && (
                            <div className="text-sm font-semibold mt-1">
                              <div>
                                {fmtEUR.format(d.price)} / {fmtBGN.format(d.price * EUR_TO_BGN)}
                              </div>
                            </div>
                          )}
                        </div>

                        {d.image_url && (
                          <img
                            src={d.image_url}
                            className="h-16 w-16 rounded-xl object-cover border border-white/10"
                            alt=""
                          />
                        )}

                        <svg width="18" height="18" viewBox="0 0 24 24" className="text-white/30">
                          <path fill="currentColor" d="M9 18l6-6-6-6" />
                        </svg>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            );
          })}
      </main>

      <MenuFooter />
    </div>
  );
}