// src/pages/AllergensReadOnly.tsx (Restaurant admin - READ ONLY)
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import type { Allergen } from "../lib/types";
import { fetchAllergens } from "../services/allergens";
import { useT } from "../i18n/useT";
import { norm } from "./allergens/allergensUtils";
import { allergenIconUrl } from "../lib/allergenIcons";
import { fetchActiveContentLangs, fetchRestaurantLangs } from "../services/restaurantI18n";

function normLang(x: any) {
  return String(x ?? "").trim().toLowerCase();
}

function uniq(list: string[]) {
  return Array.from(new Set(list));
}

export default function AllergensPage() {
  const { msg } = useT();
  const params = useParams();
  const slug = (params as any)?.slug as string | undefined;

  const [rows, setRows] = useState<Allergen[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [langs, setLangs] = useState<string[]>(["bg"]);
  const [defaultLang, setDefaultLang] = useState<string>("bg");

  const storageKey = slug ? `admin:restaurant:${slug}:allergens:lang` : "admin:restaurant:allergens:lang";

  const [activeLang, setActiveLang] = useState<string>(() => {
    const saved = normLang(localStorage.getItem(storageKey));
    return saved || "bg";
  });

  async function loadLangs() {
    if (!slug) return;

    // ✅ 1) allowed by superadmin (platform)
    const platformAllowed = uniq((await fetchActiveContentLangs()).map(normLang).filter(Boolean));

    // ✅ 2) restaurant config
    const r = await fetchRestaurantLangs(slug);
    const restaurantLangs = uniq((r.langs ?? []).map(normLang).filter(Boolean));
    const restaurantDefault = normLang(r.default_lang || restaurantLangs[0] || "bg");

    // ✅ 3) intersection: only what superadmin allows AND restaurant uses
    const inter = restaurantLangs.filter((l) => platformAllowed.includes(l));
    const safeLangs = inter.length ? inter : ["bg"];

    const safeDef = safeLangs.includes(restaurantDefault) ? restaurantDefault : safeLangs[0] || "bg";
    const ordered = [safeDef, ...safeLangs.filter((l) => l !== safeDef)];

    setLangs(ordered);
    setDefaultLang(safeDef);

    // ✅ keep active valid: saved -> current -> default
    setActiveLang((cur) => {
      const c = normLang(cur);
      if (ordered.includes(c)) return c;

      const saved = normLang(localStorage.getItem(storageKey));
      if (saved && ordered.includes(saved)) return saved;

      return safeDef;
    });
  }

  async function loadAllergens(lang: string) {
    setLoading(true);
    try {
      const res: any = await fetchAllergens({
        per_page: -1,
        sort: "position,code",
        lang,
      } as any);

      const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
      setRows(list);
    } finally {
      setLoading(false);
    }
  }

  // load langs once (needs slug)
  useEffect(() => {
    if (!slug) return;

    let mounted = true;
    (async () => {
      try {
        await loadLangs();
      } catch {
        if (!mounted) return;
        setLangs(["bg"]);
        setDefaultLang("bg");
        setActiveLang("bg");
      }
    })();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // persist active tab
  useEffect(() => {
    const a = normLang(activeLang);
    if (a) localStorage.setItem(storageKey, a);
  }, [activeLang, storageKey]);

  // reload allergens when language changes
  useEffect(() => {
    const l = normLang(activeLang || defaultLang || "bg");
    loadAllergens(l);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLang, defaultLang]);

  const filteredRows = useMemo(() => {
    const q = norm(search);
    if (!q) return rows;
    return rows.filter((x) => norm(x.code).includes(q) || norm(x.name).includes(q));
  }, [rows, search]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
        {/* LEFT */}
        <div className="min-w-0 w-full">
          <h1 className="text-2xl font-semibold">
            {msg("admin.allergens.title", { defaultValue: "Алергени" })}
          </h1>

          {/* MOBILE: tabs inline (optional) */}
          {langs.length > 1 ? (
            <div className="mt-3 flex items-center gap-2 md:hidden">
              {langs.map((l) => {
                const isActive = normLang(l) === normLang(activeLang);
                return (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setActiveLang(l)}
                    className={[
                      "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                      isActive
                        ? "bg-black text-white border-black"
                        : "bg-white text-gray-900 border-gray-200 hover:border-gray-300",
                    ].join(" ")}
                    title={l.toUpperCase()}
                  >
                    <span
                      className={[
                        "h-2 w-2 rounded-full",
                        isActive ? "bg-white" : "bg-gray-300",
                      ].join(" ")}
                      aria-hidden
                    />
                    {l.toUpperCase()}
                  </button>
                );
              })}
            </div>
          ) : null}

          {/* DESKTOP: tabs under title */}
          {langs.length > 1 ? (
            <div className="mt-3 hidden md:flex items-center gap-2">
              {langs.map((l) => {
                const isActive = normLang(l) === normLang(activeLang);
                return (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setActiveLang(l)}
                    className={[
                      "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                      isActive
                        ? "bg-black text-white border-black"
                        : "bg-white text-gray-900 border-gray-200 hover:border-gray-300",
                    ].join(" ")}
                    title={l.toUpperCase()}
                  >
                    <span
                      className={[
                        "h-2 w-2 rounded-full",
                        isActive ? "bg-white" : "bg-gray-300",
                      ].join(" ")}
                      aria-hidden
                    />
                    {l.toUpperCase()}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        {/* RIGHT: search */}
        <div className="w-full max-w-sm md:pt-1">
          <div className="w-full max-w-sm space-y-2">
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <svg className="h-4 w-4 text-gray-400" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>{msg("admin.allergens.search", { defaultValue: "Търсене" })}</span>
            </div>

            <div className="relative">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setSearch("");
                }}
                placeholder={msg("admin.allergens.search_placeholder", { defaultValue: "код или име..." })}
                className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-black/10"
              />

              {search.trim() ? (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                >
                  ✕
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* MOBILE CARDS */}
      <div className="md:hidden space-y-3">
        {loading && (
          <div className="rounded-2xl border bg-white p-4 text-sm text-gray-600 shadow-sm">
            {msg("admin.common.loading", { defaultValue: "Зареждане…" })}
          </div>
        )}

        {!loading && filteredRows.length === 0 && (
          <div className="rounded-2xl border bg-white p-6 text-center text-sm text-gray-500 shadow-sm">
            {msg("admin.allergens.no_results", { defaultValue: "Няма намерени резултати." })}
          </div>
        )}

        {!loading &&
          filteredRows.map((a) => {
            const url = allergenIconUrl(a.code);

            return (
              <div key={a.id} className="rounded-2xl border bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  {url ? (
                    <div className="h-10 w-10 rounded-lg border bg-gray-50 flex items-center justify-center overflow-hidden">
                      <img
                        src={url}
                        alt={a.name}
                        className="h-7 w-7 object-contain"
                        loading="lazy"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                        }}
                      />
                    </div>
                  ) : (
                    <div className="h-10 w-10 rounded bg-gray-100" />
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-gray-500 font-mono">{a.code}</div>
                    <div className="text-sm font-semibold truncate">{a.name}</div>
                  </div>
                </div>
              </div>
            );
          })}
      </div>

      {/* DESKTOP TABLE */}
      <div className="hidden md:block overflow-x-auto rounded-2xl border bg-white shadow-sm">
        <div className="border-b p-4 text-sm text-gray-600">
          {loading
            ? msg("admin.common.loading", { defaultValue: "Зареждане…" })
            : `${msg("admin.common.total", { defaultValue: "Общо" })}: ${filteredRows.length}`}
        </div>

        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 w-16"></th>
              <th className="p-2 text-left">{msg("admin.allergens.th_code", { defaultValue: "Код" })}</th>
              <th className="p-2 text-left">{msg("admin.allergens.th_name", { defaultValue: "Име" })}</th>
            </tr>
          </thead>

          <tbody>
            {loading && (
              <tr>
                <td className="p-4 text-gray-600" colSpan={3}>
                  {msg("admin.common.loading", { defaultValue: "Зареждане…" })}
                </td>
              </tr>
            )}

            {!loading && filteredRows.length === 0 && (
              <tr>
                <td className="p-6 text-center text-gray-500" colSpan={3}>
                  {msg("admin.allergens.no_results", { defaultValue: "Няма намерени резултати." })}
                </td>
              </tr>
            )}

            {!loading &&
              filteredRows.map((a) => {
                const url = allergenIconUrl(a.code);

                return (
                  <tr key={a.id} className="border-t">
                    <td className="p-2">
                      {url ? (
                        <div className="h-9 w-9 rounded-lg border bg-gray-50 flex items-center justify-center mx-auto overflow-hidden">
                          <img
                            src={url}
                            alt={a.name}
                            className="h-6 w-6 object-contain"
                            loading="lazy"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.display = "none";
                            }}
                          />
                        </div>
                      ) : (
                        <div className="h-9 w-9 rounded bg-gray-100 mx-auto" />
                      )}
                    </td>

                    <td className="p-2 text-left">
                      <span className="font-mono text-xs text-gray-600">{a.code}</span>
                    </td>

                    <td className="p-2 text-left">
                      <div className="font-medium">{a.name}</div>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}