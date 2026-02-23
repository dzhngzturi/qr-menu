// src/pages/PlatformRestaurantAllergens.tsx
import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { toast } from "react-hot-toast";

import type { Allergen } from "../lib/types";
import { fetchPlatformAllergens } from "../services/platformAllergens";
import {
  fetchRestaurantAllergens,
  updateRestaurantAllergens,
  type RestaurantAllergenConfig,
} from "../services/platformRestaurantAllergens";

type Translation = { lang: string; name: string };

function norm(s: any) {
  return String(s ?? "").toLowerCase().trim();
}

function normLang(v: any) {
  const x = norm(v);
  return x.includes("-") ? x.split("-")[0] : x;
}

/**
 * ✅ Robust display name resolver:
 * Supports:
 * - allergen.translations: {lang,name}[]
 * - allergen.name_by_lang: Record<string,string>
 * - allergen.name: string
 */
function getAllergenName(a: any, lang: string, fallback: string): string {
  const l = normLang(lang);
  const f = normLang(fallback);

  // 1) translations[]
  const tr: Translation[] = Array.isArray(a?.translations) ? a.translations : [];
  if (tr.length) {
    const hit = tr.find((x) => normLang(x?.lang) === l)?.name;
    if (norm(hit)) return String(hit);

    const fb = tr.find((x) => normLang(x?.lang) === f)?.name;
    if (norm(fb)) return String(fb);

    const any = tr.find((x) => norm(x?.name))?.name;
    if (norm(any)) return String(any);
  }

  // 2) name_by_lang map
  const m = a?.name_by_lang;
  if (m && typeof m === "object") {
    const hit = m[l];
    if (norm(hit)) return String(hit);

    const fb = m[f];
    if (norm(fb)) return String(fb);

    const any = Object.values(m).find((x: any) => norm(x));
    if (norm(any)) return String(any);
  }

  // 3) plain name
  if (norm(a?.name)) return String(a.name);

  // last resort
  return "";
}

export default function PlatformRestaurantAllergens() {
  const { slug } = useParams<{ slug: string }>();
  const restaurantSlug = slug || "";

  const [loading, setLoading] = useState(true);
  const [master, setMaster] = useState<Allergen[]>([]);
  const [cfg, setCfg] = useState<RestaurantAllergenConfig | null>(null);
  const [search, setSearch] = useState("");

  /**
   * Ако cfg ти връща default_lang, ще го ползваме.
   * Ако не – падаме на bg.
   */
  const restaurantDefaultLang = useMemo(() => {
    const d = normLang((cfg as any)?.default_lang || (cfg as any)?.defaultLang || "bg");
    return d || "bg";
  }, [cfg]);

  async function load() {
    if (!restaurantSlug) return;
    setLoading(true);
    try {
      const [m, c] = await Promise.all([
        fetchPlatformAllergens({ per_page: -1 }),
        fetchRestaurantAllergens(restaurantSlug),
      ]);
      setMaster(Array.isArray(m) ? m : []);
      setCfg(c);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Грешка при зареждане");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantSlug]);

  function toggle(id: number) {
    if (!cfg) return;
    const has = cfg.allergen_ids.includes(id);
    setCfg({
      ...cfg,
      allergen_ids: has ? cfg.allergen_ids.filter((x) => x !== id) : [...cfg.allergen_ids, id],
    });
  }

  /**
   * ✅ Save logic:
   * - if show_allergens === false -> always clear ids []
   * - if selectAll === true -> let backend select all (send select_all=true, do NOT send allergen_ids)
   * - else -> send explicit allergen_ids
   */
  async function save(opts?: { selectAll?: boolean }) {
    if (!cfg) return;
    const selectAll = !!opts?.selectAll;

    try {
      const payload =
        cfg.show_allergens === false
          ? {
              show_allergens: false,
              allergen_ids: [],
              select_all: false,
            }
          : selectAll
            ? {
                show_allergens: true,
                select_all: true,
              }
            : {
                show_allergens: true,
                allergen_ids: cfg.allergen_ids,
                select_all: false,
              };

      await updateRestaurantAllergens(restaurantSlug, payload as any);
      toast.success("Запазено");
      await load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Грешка при запис");
    }
  }

  const filtered = useMemo(() => {
    const q = norm(search);
    if (!q) return master;

    return master.filter((a: any) => {
      const name = getAllergenName(a, restaurantDefaultLang, "bg");
      return norm(a?.code).includes(q) || norm(name).includes(q);
    });
  }, [master, search, restaurantDefaultLang]);

  if (loading || !cfg) return <div className="p-4">Зареждане…</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Allergens • <span className="font-mono text-base">{restaurantSlug}</span>
          </h1>
          <p className="text-sm text-gray-500">
            Platform конфигурация за ресторант. (Default lang: {restaurantDefaultLang.toUpperCase()})
          </p>
        </div>

        <Link className="rounded border px-3 py-2 hover:bg-gray-50" to="/admin/platform/restaurants">
          Back
        </Link>
      </div>

      {/* Settings card */}
      <div className="rounded-2xl border bg-white p-4 shadow-sm space-y-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={cfg.show_allergens}
            onChange={(e) => {
              const checked = e.target.checked;
              setCfg((prev) =>
                prev
                  ? {
                      ...prev,
                      show_allergens: checked,
                      // ✅ ако ги изключиш - визуално чистим избора
                      allergen_ids: checked ? prev.allergen_ids : [],
                    }
                  : prev
              );
            }}
          />
          Show allergens for this restaurant
        </label>

        <div className="flex flex-wrap gap-2">
          {!cfg.show_allergens ? (
            <>
              <button
                onClick={() => save()}
                className="rounded bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
              >
                Save
              </button>

              <div className="text-xs text-gray-500 self-center">
                Алергените са изключени – няма да се показват в public менюто.
              </div>
            </>
          ) : (
            <>
              <button
                onClick={() => save({ selectAll: true })}
                className="rounded border px-3 py-2 hover:bg-gray-50"
              >
                Select all
              </button>

              <button
                onClick={() => save({ selectAll: false })}
                className="rounded bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
              >
                Save
              </button>
            </>
          )}
        </div>
      </div>

      {/* Table area */}
      {!cfg.show_allergens ? null : (
        <div className="space-y-3">
          {/* Search */}
          <div className="w-full max-w-sm">
            <label className="block text-sm text-gray-700 mb-1">Търсене</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="код или име…"
              className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-black/10"
            />
          </div>

          {/* MOBILE cards */}
          <div className="md:hidden space-y-3">
            {filtered.length === 0 ? (
              <div className="rounded-2xl border bg-white p-6 text-center text-sm text-gray-500 shadow-sm">
                Няма данни.
              </div>
            ) : (
              filtered.map((a: any) => {
                const checked = cfg.allergen_ids.includes(a.id);
                const name = getAllergenName(a, restaurantDefaultLang, "bg") || "(no name)";
                return (
                  <div key={a.id} className="rounded-2xl border bg-white p-4 shadow-sm">
                    <label className="flex items-center gap-3">
                      <input type="checkbox" checked={checked} onChange={() => toggle(a.id)} />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold truncate">{name}</div>
                        <div className="text-xs text-gray-500 font-mono">{a.code}</div>
                      </div>
                      <span
                        className={[
                          "text-xs rounded-full px-2 py-1",
                          checked ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600",
                        ].join(" ")}
                      >
                        {checked ? "selected" : "not selected"}
                      </span>
                    </label>
                  </div>
                );
              })
            )}
          </div>

          {/* DESKTOP table */}
          <div className="hidden md:block overflow-x-auto rounded-2xl border bg-white shadow-sm">
            <div className="border-b p-4 text-sm text-gray-600">Общо: {filtered.length}</div>

            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-2 w-16 text-center">Use</th>
                  <th className="p-2 text-left">Name</th>
                  <th className="p-2 text-left">Code</th>
                  <th className="p-2 text-center">Active</th>
                </tr>
              </thead>

              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-gray-500">
                      Няма данни.
                    </td>
                  </tr>
                ) : (
                  filtered.map((a: any) => {
                    const checked = cfg.allergen_ids.includes(a.id);
                    const name = getAllergenName(a, restaurantDefaultLang, "bg") || "(no name)";
                    return (
                      <tr key={a.id} className="border-t">
                        <td className="p-2 text-center">
                          <input type="checkbox" checked={checked} onChange={() => toggle(a.id)} />
                        </td>

                        <td className="p-2 text-left">
                          <div className="font-medium">{name}</div>
                        </td>

                        <td className="p-2 text-left">
                          <span className="font-mono text-xs text-gray-600">{a.code}</span>
                        </td>

                        <td className="p-2 text-center">
                          <span
                            className={[
                              "inline-flex items-center rounded-full px-2 py-1 text-xs",
                              a.is_active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600",
                            ].join(" ")}
                          >
                            {a.is_active ? "active" : "inactive"}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-gray-500">“Select all” включва всички platform алергени за ресторанта.</p>
        </div>
      )}
    </div>
  );
}
