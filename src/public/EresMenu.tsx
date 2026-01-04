// src/public/EresMenu.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../lib/api";
import type { Category, Dish } from "../lib/types";
import { bgnToEur, fmtBGN, fmtEUR } from "../lib/money";
import NotFound from "../pages/NotFound";
import { MenuFooter } from "../components/MenuFooter";
import {
    logQrScanOnceForSlug,
    logMenuOpenForSlug,
    logSearchDebounced,
    logSearchImmediate,
} from "../lib/telemetry";

type Grouped = Record<number, Dish[]>;

export default function EresMenu() {
    const { slug } = useParams<{ slug: string }>();
    const [cats, setCats] = useState<Category[]>([]);
    const [dishes, setDishes] = useState<Dish[]>([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState("");
    const [activeCat, setActiveCat] = useState<number | null>(null);
    const [notFound, setNotFound] = useState(false);

    // ✅ за отваряне на снимка на ястие
    const [lightboxImage, setLightboxImage] = useState<string | null>(null);

    // смени тези стойности с реалните ти данни
    const RESTAURANT_NAME_LINE1 = "Bistro";
    const RESTAURANT_NAME_LINE2 = "ER & ES";
    // const RESTAURANT_NAME = "Bistro ER & ES";
    const ADDRESS = "23 1970, 7425 Тодорово";
    const PHONE_DISPLAY = "089 532 5933";
    const PHONE_TEL = "+359895325933";

    const sectionRefs = useRef<Record<number, HTMLDivElement | null>>({});

    function mapsUrl(addr: string) {
        const q = encodeURIComponent(addr);
        const ua = navigator.userAgent || "";
        const isiOS = /iPad|iPhone|iPod|Macintosh/.test(ua);
        return isiOS
            ? `maps://?q=${q}`
            : `https://www.google.com/maps/search/?api=1&query=${q}`;
    }

    /* ---------- ТЕЛЕМЕТРИЯ ---------- */

    // QR scan + отваряне на менюто (както при AvvaMenu)
    useEffect(() => {
        if (!slug) return;

        // веднъж на ден на устройство за този ресторант
        logQrScanOnceForSlug(slug);

        // всяко зареждане на менюто
        logMenuOpenForSlug(slug);
    }, [slug]);

    // търсене – дебоунснато
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
                    api.get("/categories?only_active=1&sort=position,name&per_page=-1"),
                    api.get("/dishes?only_active=1&sort=position,name&per_page=-1"),
                ]);

                const catsData: Category[] = cRes.data.data ?? cRes.data;
                const dishesData: Dish[] = (dRes.data.data ?? dRes.data).filter(
                    (d: Dish) => d.is_active
                );

                // събираме ID-тата на категориите, които ИМАТ поне едно ястие
                const dishCategoryIds = new Set<number>();
                for (const d of dishesData) {
                    const cid = (d as any).category?.id ?? (d as any).category_id;
                    if (cid) dishCategoryIds.add(cid);
                }

                // взимаме само активните категории, които имат ястия
                const onlyActiveCats = catsData.filter(
                    (c) => c.is_active && dishCategoryIds.has(c.id)
                );

                setCats(onlyActiveCats);
                setDishes(dishesData);
                setActiveCat(onlyActiveCats.length ? onlyActiveCats[0].id : null);

                if (!onlyActiveCats.length) setNotFound(true);

                setLoading(false);
            } catch (e: any) {
                const status = e?.response?.status;
                if (status === 404 || status === 422) setNotFound(true);
                setLoading(false);
            }
        })();
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
                (d) =>
                    d.name.toLowerCase().includes(q) ||
                    (d.description ?? "").toLowerCase().includes(q)
            );
            if (list.length) res[Number(cidStr)] = list;
        }
        return res;
    }, [grouped, query]);

    /* ---------- КОИ КАТЕГОРИИ ДА СЕ ВИЖДАТ В ДЯСНО ---------- */
    const visibleCats = useMemo(() => {
        // само категории, които имат поне 1 ястие след филтъра
        const withDishes = cats.filter((c) => (filteredGrouped[c.id] ?? []).length);

        // ако има търсене – показваме всички категории с резултат
        if (query.trim()) return withDishes;

        // без търсене – само активната категория
        if (activeCat != null) {
            return withDishes.filter((c) => c.id === activeCat);
        }

        return withDishes;
    }, [cats, filteredGrouped, query, activeCat]);

    /* ---------- СКРОЛ ДО КАТЕГОРИЯ ОТ ЛЯВОТО МЕНЮ ---------- */

    function scrollToCat(id: number) {
        setActiveCat(id);
        const el = sectionRefs.current[id];
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    /* ---------- AUTO-HIGHLIGHT ПРИ СКРОЛ ---------- */

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

    if (notFound) return <NotFound />;

    return (
        <div
            className="min-h-screen text-slate-900 flex flex-col">
            {/* HEADER */}
            <header className="bg-white border-b border-slate-200">
                <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {/* LOGO LEFT */}
                        <img
                            src="/eres-logo.png"
                            alt="Logo"
                            className="h-[108px] w-[108px] object-contain rounded-md"
                        />

                        {/* TEXT RIGHT */}
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
                                    if (slug && q) {
                                        logSearchImmediate(q, slug);
                                    }
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

            {/* MAIN */}
            <main className="flex-1 pb-10">
                <div className="max-w-6xl mx-auto px-4 py-4 grid grid-cols-1 md:grid-cols-[minmax(240px,280px)_minmax(0,1fr)] gap-4">
                    {/* SIDEBAR */}
                    <aside className="space-y-4">
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col items-start gap-3">
                            {/* LOGO */}
                            <img
                                src="/eres-logo.png"
                                alt="Logo"
                                className="h-14 w-14 object-contain rounded-md"
                            />

                            {/* CONTACTS */}
                            <div className="flex flex-col gap-2 mt-1">
                                {/* ADDRESS */}
                                <a
                                    href={mapsUrl(ADDRESS)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center justify-end gap-1 hover:text-slate-900 hover:underline"
                                >
                                    <svg
                                        width="16"
                                        height="16"
                                        viewBox="0 0 24 24"
                                        className="opacity-70"
                                    >
                                        <path
                                            fill="currentColor"
                                            d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7m0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5Z"
                                        />
                                    </svg>
                                    {ADDRESS}
                                </a>

                                {/* PHONE */}
                                <a
                                    href={`tel:${PHONE_TEL}`}
                                    className="inline-flex items-center gap-1 text-sm text-emerald-700 hover:text-emerald-800 font-medium"
                                >
                                    📞 {PHONE_DISPLAY}
                                </a>

                                {/* FACEBOOK */}
                                <a
                                    href="https://www.facebook.com/people/%D0%91%D0%B8%D1%81%D1%82%D1%80%D0%BE-%D0%9C%D0%B0%D0%B3%D0%B0%D0%B7%D0%B8%D0%BD-%D0%B5%D1%80%D0%B5%D1%81/100054468309366"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                                >
                                    <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M22 12a10 10 0 1 0-11.5 9.9v-7h-2v-3h2v-2.3c0-2 1.2-3.1 3-3.1 .9 0 1.8.1 1.8.1v2h-1c-1 0-1.3.6-1.3 1.2V12h2.3l-.4 3h-1.9v7A10 10 0 0 0 22 12" />
                                    </svg>
                                    Facebook
                                </a>

                                {/* INSTAGRAM */}
                                <a
                                    href="https://www.instagram.com/bistro.eres"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-sm text-pink-600 hover:text-pink-700"
                                >
                                    <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M7 2C4.2 2 2 4.2 2 7v10c0 2.8 2.2 5 5 5h10c2.8 0 5-2.2 5-5V7c0-2.8-2.2-5-5-5H7zm10 2c1.7 0 3 1.3 3 3v10c0 1.7-1.3 3-3 3H7c-1.7 0-3-1.3-3-3V7c0-1.7 1.3-3 3-3h10zm-5 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11zm0 2a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7zm4.8-.9a1.1 1.1 0 1 0 0-2.2 1.1 1.1 0 0 0 0 2.2z" />
                                    </svg>
                                    Instagram
                                </a>
                            </div>

                            {/* EXTRA TEXT */}
                            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                За резервации и запитвания – последвайте ни в социалните мрежи или се
                                свържете директно с нашия екип.
                            </p>
                        </div>

                        <nav className="bg-white rounded-xl shadow-sm border border-slate-200 max-height-[70vh] max-h-[70vh] overflow-y-auto">
                            {cats.map((c) => (
                                <button
                                    key={c.id}
                                    onClick={() => scrollToCat(c.id)}
                                    className={
                                        "w-full text-left px-3 py-2 text-sm border-b border-slate-100 last:border-b-0 transition " +
                                        (activeCat === c.id
                                            ? "bg-slate-900 text-white font-semibold"
                                            : "bg-white text-slate-700 hover:bg-slate-50")
                                    }
                                >
                                    {c.name}
                                </button>
                            ))}
                        </nav>
                    </aside>

                    {/* DISHES COLUMN */}
                    <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 md:p-5">
                        {loading && (
                            <div className="py-10 text-center text-slate-500 text-sm">
                                Зареждане…
                            </div>
                        )}

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
                                        {/* ГОЛЯМ БАНЕР НА КАТЕГОРИЯТА */}
                                        {c.image_url && (
                                            <div className="mb-4 rounded-2xl overflow-hidden relative h-40 md:h-52">
                                                <img
                                                    src={c.image_url}
                                                    alt={c.name}
                                                    className="w-full h-full object-cover"
                                                />
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                                                <div className="absolute bottom-3 left-4">
                                                    <p className="text-[10px] uppercase tracking-[0.3em] text-slate-200">
                                                        Категория
                                                    </p>
                                                    <h2 className="text-2xl md:text-3xl font-semibold text-white">
                                                        {c.name}
                                                    </h2>
                                                </div>
                                            </div>
                                        )}

                                        {!c.image_url && (
                                            <h2 className="text-lg font-semibold mb-4">{c.name}</h2>
                                        )}

                                        {/* ПРОДУКТИТЕ ПОД БАНЕРА */}
                                        <ul className="space-y-2">
                                            {list.map((d) => (
                                                <li
                                                    key={d.id}
                                                    className="flex gap-3 items-start py-2 border-b border-slate-100 last:border-b-0"
                                                >
                                                    {d.image_url && (
                                                        <img
                                                            src={d.image_url}
                                                            loading="lazy"
                                                            className="h-14 w-14 rounded-lg object-cover border border-slate-200 flex-shrink-0 cursor-pointer"
                                                            onClick={() => setLightboxImage(d.image_url!)} // ✅ lightbox
                                                        />
                                                    )}

                                                    <div className="flex-1">
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div>
                                                                <div className="flex items-center gap-2">
                                                                    <h3 className="text-sm font-semibold text-slate-900">
                                                                        {d.name}
                                                                    </h3>
                                                                    {!d.is_active && (
                                                                        <span className="text-[10px] uppercase tracking-wide text-slate-400">
                                                                            недостъпно
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {d.description && (
                                                                    <p className="mt-1 text-xs text-slate-600">
                                                                        {d.description}
                                                                    </p>
                                                                )}
                                                            </div>

                                                            {!!d.price && (
                                                                <div className="text-right text-xs font-semibold text-slate-900 whitespace-nowrap">
                                                                    <div>{fmtEUR.format(bgnToEur(d.price))}</div>
                                                                    <div className="text-[11px] text-slate-500">
                                                                        ({fmtBGN.format(d.price)})
                                                                    </div>
                                                                </div>
                                                            )}

                                                        </div>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    </section>
                                );
                            })}
                    </section>
                </div>
            </main>

            {/* ✅ прост lightbox за снимката на ястие */}
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
