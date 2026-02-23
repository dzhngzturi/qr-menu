// src/pages/Telemetry.tsx
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { apiAdmin } from "../lib/api";
import type { TelemetryOverview } from "../lib/types";
import { useTranslation } from "react-i18next";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

type TelemetryWindowPoint = { start: string; end: string; count: number };
type TelemetryWindowResponse = {
  timezone?: string;
  range: {
    from: string;
    to: string;
    hours: number;
    bucket_minutes: number;
    type: "menu_open" | "qr_scan" | "search";
  };
  series: TelemetryWindowPoint[];
  peak_bucket: { start: string | null; end: string | null; count: number };
};

export default function Telemetry() {
  const { slug } = useParams<{ slug: string }>();
  const { t, i18n } = useTranslation();

  // ✅ DB truth (от backend)
  const [telemetryEnabled, setTelemetryEnabled] = useState<boolean>(false);
  const [telemetryChecked, setTelemetryChecked] = useState<boolean>(false);

  const [data, setData] = useState<TelemetryOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);

  const HOURS = 12;
  const BUCKET = 5;

  const [win, setWin] = useState<TelemetryWindowResponse | null>(null);
  const [winLoading, setWinLoading] = useState(true);

  // ---------- check telemetry flag (DB) ----------
  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!slug) {
        if (!cancelled) {
          setTelemetryEnabled(false);
          setTelemetryChecked(true);
        }
        return;
      }

      try {
        setTelemetryChecked(false);
        const { data } = await apiAdmin.get("auth/check-restaurant", {
          params: { restaurant: slug },
        });

        if (cancelled) return;
        setTelemetryEnabled(!!data?.restaurant?.telemetry_enabled);
        setTelemetryChecked(true);
      } catch {
        if (cancelled) return;
        setTelemetryEnabled(false);
        setTelemetryChecked(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  // ---------- load overview ----------
  useEffect(() => {
    if (!slug || !telemetryChecked || !telemetryEnabled) {
      setData(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const res = await apiAdmin.get<TelemetryOverview>("/telemetry/overview", {
          params: { restaurant: slug, days },
        });
        if (!cancelled) setData(res.data);
      } catch (e) {
        if (!cancelled) setData(null);
        console.error("Telemetry overview error", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug, days, telemetryEnabled, telemetryChecked]);

  // ---------- load window chart + auto refresh 120s ----------
  useEffect(() => {
    if (!slug || !telemetryChecked || !telemetryEnabled) {
      setWin(null);
      setWinLoading(false);
      return;
    }

    let cancelled = false;
    let timer: any;

    const loadWindow = async () => {
      try {
        setWinLoading(true);
        const res = await apiAdmin.get<TelemetryWindowResponse>("/telemetry/window", {
          params: { restaurant: slug, hours: HOURS, bucket: BUCKET, type: "menu_open" },
        });
        if (!cancelled) setWin(res.data);
      } catch (e) {
        if (!cancelled) setWin(null);
        console.error("Telemetry window error", e);
      } finally {
        if (!cancelled) setWinLoading(false);
      }
    };

    loadWindow();
    timer = setInterval(loadWindow, 120_000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [slug, telemetryEnabled, telemetryChecked]);

  const locale = useMemo(() => {
    const base = (i18n.language || "en").split("-")[0];
    switch (base) {
      case "bg":
        return "bg-BG";
      case "de":
        return "de-DE";
      case "fr":
        return "fr-FR";
      case "tr":
        return "tr-TR";
      case "en":
      default:
        return "en-GB";
    }
  }, [i18n.language]);

  const restaurantTz = win?.timezone || "UTC";

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, { day: "2-digit", month: "2-digit" });

  function fmtTimeTz(iso: string) {
    const d = new Date(iso);
    return new Intl.DateTimeFormat(locale, {
      timeZone: restaurantTz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(d);
  }

  const totals = (data as any)?.totals ?? { qr_scan: 0, menu_open: 0, search: 0 };
  const events = (data as any)?.events_by_day ?? [];

  const windowSeries = useMemo(() => {
    const s = win?.series ?? [];
    return s.map((p) => ({
      ...p,
      x: fmtTimeTz(p.start),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [win?.series, locale, restaurantTz]);

  const peakText = useMemo(() => {
    const p = win?.peak_bucket;
    if (!p?.start || !p?.end) return null;
    return `${fmtTimeTz(p.start)} – ${fmtTimeTz(p.end)} · ${p.count}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [win?.peak_bucket, locale, restaurantTz]);

  if (!telemetryChecked) return <div>{t("admin.common.loading")}</div>;

  if (!telemetryEnabled) {
    return (
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">{t("admin.telemetry.title")}</h1>
        <p className="text-sm text-gray-500">{t("admin.telemetry.not_enabled")}</p>
      </div>
    );
  }

  if (!data && loading) return <div>{t("admin.common.loading")}</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">{t("admin.telemetry.title")}</h1>

          {data && (
            <p className="text-sm text-gray-500">
              {t("admin.telemetry.period")}: <strong>{fmtDate((data as any).range.from)}</strong> –{" "}
              <strong>{fmtDate((data as any).range.to)}</strong> ({(data as any).range.days}{" "}
              {t("admin.telemetry.days")})
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500">{t("admin.telemetry.period_days")}:</span>
          {[7, 14, 30].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              className={`rounded-full border px-3 py-1 text-sm transition ${days === d
                  ? "border-black bg-black text-white"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Popular searches */}
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">{t("admin.telemetry.popular_searches")}</h2>

        {!data || (data as any).popular_searches.length === 0 ? (
          <p className="text-sm text-gray-400">{t("admin.telemetry.no_data_yet")}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {(data as any).popular_searches.map((s: any) => (
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

      {/* 12h chart */}
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-sm font-semibold text-gray-700">
            {t("admin.telemetry.peak_window_title", { defaultValue: "Отваряния на меню (последните 12ч.)" })}
          </h2>

          {peakText && (
            <div className="text-xs text-gray-600">
              <span className="text-gray-500">
                {t("admin.telemetry.peak_interval", { defaultValue: "Пиков час" })}:
              </span>{" "}
              <span className="font-semibold text-gray-900">{peakText}</span>
              <span> {t("admin.telemetry.times")} </span>
            </div>
          )}
        </div>

        {/* ✅ стабилен контейнер (без 0 width/height) */}
        <div className="mt-4 w-full rounded-xl border bg-white p-3" style={{ height: 260, minWidth: 0 }}>
          {winLoading && !win ? (
            <p className="text-sm text-gray-400">{t("admin.common.loading")}</p>
          ) : !win || windowSeries.length === 0 ? (
            <p className="text-sm text-gray-400">{t("admin.telemetry.no_data_yet")}</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={windowSeries} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="x" tick={{ fontSize: 12 }} interval="preserveStartEnd" />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={30} />
                <Tooltip content={<WindowTooltip fmtTime={(iso: string) => fmtTimeTz(iso)} />} />
                <Area type="monotone" dataKey="count" strokeWidth={2} fillOpacity={0.2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Donut + legend */}
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col items-center gap-6 md:flex-row md:items-center">
          <div className="flex justify-center md:w-1/2">
            <DonutChart
              totals={{ qr_scan: totals.qr_scan, menu_open: totals.menu_open, search: totals.search }}
              t={t}
            />
          </div>

          <div className="w-full md:w-1/2 md:pl-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">{t("admin.telemetry.distribution")}</h2>
            <div className="space-y-2 text-sm">
              <LegendRow colorClass="bg-amber-500" label={t("admin.telemetry.qr_scans")} value={totals.qr_scan} />
              <LegendRow colorClass="bg-sky-500" label={t("admin.telemetry.menu_opens")} value={totals.menu_open} />
              <LegendRow colorClass="bg-rose-500" label={t("admin.telemetry.searches")} value={totals.search} />
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-700 mb-2">{t("admin.telemetry.daily_rhythm", { days })}</h2>
        <p className="text-xs text-gray-400 mb-4">{t("admin.common.scroll_hint", { defaultValue: "На мобилно: плъзни таблицата наляво/надясно →" })}</p>

        {!data ? (
          <p className="text-sm text-gray-400">{t("admin.common.loading")}</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border">
            <table className="min-w-[600px] w-full text-sm">
              <thead className="border-b text-gray-500 bg-gray-50">
                <tr>
                  <th className="py-2 px-3 text-left whitespace-nowrap w-[120px]">{t("admin.telemetry.th_date")}</th>
                  <th className="py-2 px-3 text-center whitespace-nowrap w-[140px]">{t("admin.telemetry.th_qr_scans")}</th>
                  <th className="py-2 px-3 text-center whitespace-nowrap w-[180px]">{t("admin.telemetry.th_menu_opens")}</th>
                  <th className="py-2 px-3 text-center whitespace-nowrap w-[140px]">{t("admin.telemetry.th_searches")}</th>
                </tr>
              </thead>
              <tbody>
                {events.map((d: any) => (
                  <tr key={d.date} className="border-b last:border-0">
                    <td className="py-2 px-3 whitespace-nowrap">{fmtDate(d.date)}</td>
                    <td className="py-2 px-3 text-center tabular-nums whitespace-nowrap">{d.qr_scan}</td>
                    <td className="py-2 px-3 text-center tabular-nums whitespace-nowrap">{d.menu_open}</td>
                    <td className="py-2 px-3 text-center tabular-nums whitespace-nowrap">{d.search}</td>
                  </tr>
                ))}

                <tr className="font-semibold bg-white">
                  <td className="py-3 px-3 whitespace-nowrap">{t("admin.telemetry.total")}</td>
                  <td className="py-3 px-3 text-center tabular-nums whitespace-nowrap">{totals.qr_scan}</td>
                  <td className="py-3 px-3 text-center tabular-nums whitespace-nowrap">{totals.menu_open}</td>
                  <td className="py-3 px-3 text-center tabular-nums whitespace-nowrap">{totals.search}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function WindowTooltip({ active, payload, fmtTime }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload as TelemetryWindowPoint & { x: string };
  if (!p) return null;

  return (
    <div className="rounded-xl border bg-white px-3 py-2 text-xs shadow-sm">
      <div className="font-semibold text-gray-900">
        {fmtTime(p.start)} – {fmtTime(p.end)}
      </div>
      <div className="text-gray-600 mt-0.5">{p.count} opens</div>
    </div>
  );
}

type LegendRowProps = { colorClass: string; label: string; value: number };

function LegendRow({ colorClass, label, value }: LegendRowProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className={`h-3 w-3 rounded-sm ${colorClass}`} />
        <span className="text-gray-600">{label}</span>
      </div>
      <span className="font-medium text-gray-900 tabular-nums">{value}</span>
    </div>
  );
}

function DonutChart({
  totals,
  t,
}: {
  totals: { qr_scan: number; menu_open: number; search: number };
  t: (key: string, opts?: any) => string;
}) {
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
          <div className="text-xs text-gray-500">{t("admin.telemetry.total")}</div>
          <div className="text-2xl font-semibold text-gray-900 tabular-nums">{totalSum}</div>
        </div>
      </div>
    </div>
  );
}
