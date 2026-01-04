// src/pages/Telemetry.tsx
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { apiAdmin } from "../lib/api";
import type { TelemetryOverview } from "../lib/types";
import { isTelemetryEnabledSlug } from "../lib/telemetry-config";

/**
 * Страница Телеметрия за /admin/r/:slug/telemetry
 * ВАЖНО: ползваме apiAdmin (=> /api/admin), за да няма достъп между ресторанти.
 */
export default function Telemetry() {
  const { slug } = useParams<{ slug: string }>();

  // allow-list за фронтенд (само UI)
  const telemetryEnabled = isTelemetryEnabledSlug(slug ?? null);

  const [data, setData] = useState<TelemetryOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);

  useEffect(() => {
    if (!slug || !telemetryEnabled) {
      setData(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        setLoading(true);

        // ✅ admin protected endpoint
        const res = await apiAdmin.get<TelemetryOverview>("/telemetry/overview", {
          params: { restaurant: slug, days },
        });

        if (!cancelled) setData(res.data);
      } catch (e) {
        if (cancelled) return;
        console.error("Telemetry overview error", e);
        setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [slug, days, telemetryEnabled]);

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("bg-BG", {
      day: "2-digit",
      month: "2-digit",
    });

  if (!telemetryEnabled) {
    return (
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">Телеметрия</h1>
        <p className="text-sm text-gray-500">Телеметрията не е активирана за този ресторант.</p>
      </div>
    );
  }

  if (!data && loading) {
    return <div>Зареждане...</div>;
  }

  const totals = data?.totals ?? {
    all: 0,
    qr_scan: 0,
    menu_open: 0,
    search: 0,
  };

  const events = data?.events_by_day ?? [];

  return (
    <div className="space-y-6">
      {/* Header + избор на период */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Телеметрия</h1>
          {data && (
            <p className="text-sm text-gray-500">
              Период: <strong>{fmtDate(data.range.from)}</strong> –{" "}
              <strong>{fmtDate(data.range.to)}</strong> ({data.range.days} дни)
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500">Период (дни):</span>
          {[7, 14, 30].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              className={`rounded-full border px-3 py-1 text-sm transition
                ${
                  days === d
                    ? "border-black bg-black text-white"
                    : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* ГРИД: донът + ритъм + популярни търсения */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr),minmax(0,2fr),minmax(0,1.6fr)]">
        {/* Ляво: донът + легенда */}
        <div className="rounded-2xl border bg-white p-6 shadow-sm flex flex-col md:flex-row md:items-center">
          <div className="flex justify-center md:justify-start md:w-1/2">
            <DonutChart totals={totals} />
          </div>

          <div className="mt-6 md:mt-0 md:w-1/2 md:pl-8">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Разпределение</h2>
            <div className="space-y-2 text-sm">
              <LegendRow colorClass="bg-amber-500" label="QR сканирания" value={totals.qr_scan} />
              <LegendRow colorClass="bg-sky-500" label="Отваряния меню" value={totals.menu_open} />
              <LegendRow colorClass="bg-rose-500" label="Търсения" value={totals.search} />
            </div>
          </div>
        </div>

        {/* Център: таблица „Ритъм по дни“ */}
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Ритъм по дни ({days} дни)</h2>

          {!data ? (
            <p className="text-sm text-gray-400">Зареждане...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b text-gray-500">
                  <tr>
                    <th className="py-2 text-left">Дата</th>
                    <th className="py-2 text-right">QR сканирания</th>
                    <th className="py-2 text-right">Отваряния меню</th>
                    <th className="py-2 text-right">Търсения</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((d) => (
                    <tr key={d.date} className="border-b last:border-0">
                      <td className="py-1.5">{fmtDate(d.date)}</td>
                      <td className="py-1.5 text-right">{d.qr_scan}</td>
                      <td className="py-1.5 text-right">{d.menu_open}</td>
                      <td className="py-1.5 text-right">{d.search}</td>
                    </tr>
                  ))}

                  {data && (
                    <tr className="font-semibold">
                      <td className="pt-2">Общо</td>
                      <td className="pt-2 text-right">{data.totals.qr_scan}</td>
                      <td className="pt-2 text-right">{data.totals.menu_open}</td>
                      <td className="pt-2 text-right">{data.totals.search}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Дясно: популярни търсения */}
        <div className="rounded-2xl border bg-white p-6 shadow-sm flex flex-col">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Популярни търсения</h2>

          {!data || data.popular_searches.length === 0 ? (
            <p className="text-sm text-gray-400">Все още няма данни.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {data.popular_searches.map((s) => (
                <span
                  key={s.term}
                  className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-gray-700"
                >
                  {s.term}
                  <span className="ml-1 text-gray-400">×{s.count}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- помощни компоненти ---------- */

type LegendRowProps = {
  colorClass: string;
  label: string;
  value: number;
};

function LegendRow({ colorClass, label, value }: LegendRowProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className={`h-3 w-3 rounded-sm ${colorClass}`} />
        <span className="text-gray-600">{label}</span>
      </div>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  );
}

function DonutChart({ totals }: { totals: { qr_scan: number; menu_open: number; search: number } }) {
  const totalSum = totals.qr_scan + totals.menu_open + totals.search;
  const safeSum = totalSum || 1;

  const angleQr = (totals.qr_scan / safeSum) * 360;
  const angleMenu = (totals.menu_open / safeSum) * 360;

  const a1 = angleQr;
  const a2 = angleQr + angleMenu;

  const background = totalSum
    ? `conic-gradient(
        #f59e0b 0deg ${a1}deg,
        #0ea5e9 ${a1}deg ${a2}deg,
        #ef4444 ${a2}deg 360deg
      )`
    : "conic-gradient(#e5e7eb 0deg 360deg)";

  return (
    <div className="relative h-40 w-40 md:h-48 md:w-48">
      <div className="h-full w-full rounded-full" style={{ background }} />
      <div className="absolute inset-6 md:inset-7 bg-white rounded-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-xs text-gray-500">Общо</div>
          <div className="text-2xl font-semibold text-gray-900">{totalSum}</div>
        </div>
      </div>
    </div>
  );
}
