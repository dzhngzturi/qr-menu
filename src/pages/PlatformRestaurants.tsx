import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiAdmin } from "../lib/api";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";

type Row = {
  id: number;
  name: string;
  slug: string;
  timezone?: string | null;
  telemetry_enabled?: boolean;
};

export default function PlatformRestaurants() {
  const { t } = useTranslation();

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // fixed: 10 restaurants per page
  const perPage = 10;

  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);

  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const tzOptions = useMemo(
    () => [
      { value: "Europe/Sofia", label: "Europe/Sofia (BG)" },
      { value: "Europe/Berlin", label: "Europe/Berlin (DE)" },
      { value: "Europe/London", label: "Europe/London (UK)" },
      { value: "Europe/Paris", label: "Europe/Paris (FR)" },
      { value: "Europe/Istanbul", label: "Europe/Istanbul (TR)" },
      { value: "UTC", label: "UTC" },
      { value: "America/New_York", label: "America/New_York" },
      { value: "Asia/Dubai", label: "Asia/Dubai" },
    ],
    []
  );

  const [form, setForm] = useState({
    name: "",
    slug: "",
    timezone: "Europe/Sofia",
  });

  async function load() {
    setLoading(true);
    try {
      const { data } = await apiAdmin.get("platform/restaurants", {
        params: {
          search: debouncedSearch || undefined,
          page,
          per_page: perPage,
        },
      });

      setRows(data?.data ?? []);
      setTotal(data?.meta?.total ?? 0);
      setLastPage(data?.meta?.last_page ?? 1);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, page]);

  async function create() {
    if (!form.name || !form.slug) return;

    try {
      await apiAdmin.post("platform/restaurants", form);
      toast.success(t("admin.platform_restaurants.toasts.created", { defaultValue: "Създаден ресторант" }));
      setForm({ name: "", slug: "", timezone: "Europe/Sofia" });
      load();
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ||
        (e?.response?.data?.errors
          ? t("admin.common.validation_error", { defaultValue: "Validation error" })
          : t("admin.platform_restaurants.toasts.create_error", { defaultValue: "Грешка при създаване" }));
      toast.error(msg);
    }
  }

  async function destroy(id: number) {
    if (!confirm(t("admin.platform_restaurants.confirm_delete", { defaultValue: "Изтриване?" }))) return;

    await apiAdmin.delete(`platform/restaurants/${id}`);
    toast.success(t("admin.platform_restaurants.toasts.deleted", { defaultValue: "Изтрит ресторант" }));
    load();
  }

  async function toggleTelemetry(id: number, next: boolean) {
    try {
      await apiAdmin.patch(`platform/restaurants/${id}`, { telemetry_enabled: next });
      setRows((prev) => prev.map((x) => (x.id === id ? { ...x, telemetry_enabled: next } : x)));
      toast.success(
        next
          ? t("admin.platform_restaurants.toasts.telemetry_on", { defaultValue: "Telemetry включена" })
          : t("admin.platform_restaurants.toasts.telemetry_off", { defaultValue: "Telemetry изключена" })
      );
    } catch (e: any) {
      toast.error(
        t("admin.platform_restaurants.toasts.telemetry_error", { defaultValue: "Грешка при промяна на telemetry" })
      );
    }
  }

  function useRestaurant(slug: string) {
    localStorage.setItem("restaurant", slug);
    toast.success(t("admin.shell.selected_restaurant", { slug, defaultValue: `Избран ресторант: ${slug}` }));
  }

  function getPageItems(current: number, last: number): Array<number | "…"> {
    if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1);

    const items: Array<number | "…"> = [1];

    const left = Math.max(2, current - 1);
    const right = Math.min(last - 1, current + 1);

    if (left > 2) items.push("…");
    for (let p = left; p <= right; p++) items.push(p);
    if (right < last - 1) items.push("…");

    items.push(last);
    return items;
  }

  const canPrev = page > 1;
  const canNext = page < lastPage;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold tracking-tight">
        {t("admin.platform_restaurants.title", { defaultValue: "Ресторанти" })}
      </h2>

      {/* Search */}
      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <input
            placeholder={t("admin.platform_restaurants.search_placeholder", {
              defaultValue: "Търси по име или slug…",
            })}
            className="w-full rounded-lg border px-3 py-2"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      {/* Create */}
      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            create();
          }}
          className="grid grid-cols-1 gap-3 sm:grid-cols-4"
        >
          <input
            placeholder={t("admin.platform_restaurants.form.name", { defaultValue: "Name" })}
            className="w-full rounded-lg border px-3 py-2"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            placeholder={t("admin.platform_restaurants.form.slug", { defaultValue: "Slug" })}
            className="w-full rounded-lg border px-3 py-2"
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
          />

          <select
            className="w-full rounded-lg border px-3 py-2 bg-white"
            value={form.timezone}
            onChange={(e) => setForm({ ...form, timezone: e.target.value })}
            title={t("admin.platform_restaurants.form.timezone", { defaultValue: "Timezone" })}
          >
            {tzOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <button
            type="submit"
            className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 sm:w-auto"
          >
            {t("admin.common.create", { defaultValue: "Създай" })}
          </button>
        </form>

        <p className="mt-3 text-xs text-gray-500">
          {t("admin.platform_restaurants.timezone_hint", {
            defaultValue: "Timezone се използва за Telemetry графиките (да показват правилен локален час).",
          })}
        </p>
      </div>

      {/* List */}
      <div className="rounded-2xl border bg-white shadow-sm">
        {/* Mobile */}
        <ul className="md:hidden divide-y">
          {rows.length === 0 && !loading && (
            <li className="p-6 text-center text-sm text-gray-500">
              {t("admin.common.no_results", { defaultValue: "Няма данни." })}
            </li>
          )}

          {rows.map((r) => (
            <li key={r.id} className="p-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-medium truncate">{r.name}</div>
                  <div className="text-xs text-neutral-500">
                    ID: {r.id} • slug: <span className="font-mono rounded bg-neutral-100 px-1">{r.slug}</span>
                  </div>
                  <div className="mt-1 text-xs text-neutral-500">
                    TZ: <span className="font-mono rounded bg-neutral-100 px-1">{r.timezone ?? "—"}</span>
                  </div>

                  <div className="mt-1 text-xs text-neutral-500 flex items-center gap-2">
                    <span>Telemetry:</span>
                    <button
                      type="button"
                      className={[
                        "rounded px-2 py-0.5 text-xs border",
                        !!r.telemetry_enabled
                          ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                          : "bg-rose-50 border-rose-200 text-rose-700",
                        loading ? "opacity-60 cursor-not-allowed" : "hover:opacity-90",
                      ].join(" ")}
                      onClick={() => toggleTelemetry(r.id, !r.telemetry_enabled)}
                      disabled={loading}
                      title={t("admin.platform_restaurants.telemetry_toggle", { defaultValue: "Toggle telemetry" })}
                    >
                      {!!r.telemetry_enabled ? "ON" : "OFF"}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:ml-auto shrink-0 whitespace-nowrap">
                  <Link
                    to={`/admin/platform/restaurants/${r.id}/users`}
                    className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50"
                  >
                    {t("admin.platform_restaurants.actions.users", { defaultValue: "Users" })}
                  </Link>

                  <Link
                    to={`/admin/platform/restaurants/${r.slug}/allergens`}
                    className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50"
                  >
                    {t("admin.platform_restaurants.actions.allergens", { defaultValue: "Allergens" })}
                  </Link>

                  <button
                    onClick={() => useRestaurant(r.slug)}
                    className="rounded bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-700"
                  >
                    {t("admin.platform_restaurants.actions.use", { defaultValue: "Use" })}
                  </button>

                  <button
                    onClick={() => destroy(r.id)}
                    className="rounded bg-rose-600 px-3 py-1.5 text-sm text-white hover:bg-rose-700"
                  >
                    {t("admin.common.delete", { defaultValue: "Изтрий" })}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        {/* Desktop */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full table-auto text-left text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">{t("admin.platform_restaurants.th_name", { defaultValue: "Name" })}</th>
                <th className="px-4 py-3">{t("admin.platform_restaurants.th_slug", { defaultValue: "Slug" })}</th>
                <th className="px-4 py-3">
                  {t("admin.platform_restaurants.th_timezone", { defaultValue: "Timezone" })}
                </th>
                <th className="px-4 py-3">{t("admin.platform_restaurants.th_telemetry", { defaultValue: "Telemetry" })}</th>
                <th className="px-4 py-3 text-right">{t("admin.platform_restaurants.th_actions", { defaultValue: "Действия" })}</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className={i % 2 ? "bg-white" : "bg-gray-50/50"}>
                  <td className="px-4 py-3">{r.id}</td>
                  <td className="px-4 py-3">{r.name}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{r.slug}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="font-mono rounded bg-neutral-100 px-2 py-1 text-xs">
                      {r.timezone ?? "—"}
                    </span>
                  </td>

                  <td className="px-4 py-3 whitespace-nowrap">
                    <button
                      type="button"
                      className={[
                        "rounded px-2 py-1 text-xs border",
                        !!r.telemetry_enabled
                          ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                          : "bg-rose-50 border-rose-200 text-rose-700",
                        loading ? "opacity-60 cursor-not-allowed" : "hover:opacity-90",
                      ].join(" ")}
                      onClick={() => toggleTelemetry(r.id, !r.telemetry_enabled)}
                      disabled={loading}
                    >
                      {!!r.telemetry_enabled ? "ON" : "OFF"}
                    </button>
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        to={`/admin/platform/restaurants/${r.id}/users`}
                        className="rounded border px-3 py-1.5 hover:bg-gray-50"
                      >
                        {t("admin.platform_restaurants.actions.users", { defaultValue: "Users" })}
                      </Link>

                      <Link
                        to={`/admin/platform/restaurants/${r.slug}/allergens`}
                        className="rounded border px-3 py-1.5 hover:bg-gray-50"
                      >
                        {t("admin.platform_restaurants.actions.allergens", { defaultValue: "Allergens" })}
                      </Link>

                      <button
                        onClick={() => useRestaurant(r.slug)}
                        className="rounded bg-emerald-600 px-3 py-1.5 text-white hover:bg-emerald-700"
                      >
                        {t("admin.platform_restaurants.actions.use", { defaultValue: "Use" })}
                      </button>

                      <button
                        onClick={() => destroy(r.id)}
                        className="rounded bg-rose-600 px-3 py-1.5 text-white hover:bg-rose-700"
                      >
                        {t("admin.common.delete", { defaultValue: "Изтрий" })}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {!rows.length && !loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    {t("admin.common.no_results", { defaultValue: "Няма данни." })}
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Pagination */}
          <div className="border-t p-4 flex items-center justify-end gap-1">
            <button
              className="rounded border px-3 py-1.5 transition hover:border-gray-400 disabled:opacity-50"
              disabled={!canPrev || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              type="button"
            >
              {t("admin.common.prev", { defaultValue: "Prev" })}
            </button>

            {getPageItems(page, lastPage).map((it, idx) =>
              it === "…" ? (
                <span key={`dots-${idx}`} className="px-2 text-gray-400 select-none">
                  …
                </span>
              ) : (
                <button
                  key={it}
                  type="button"
                  disabled={loading}
                  onClick={() => setPage(it)}
                  className={[
                    "min-w-[36px] rounded border px-3 py-1.5 transition",
                    it === page
                      ? "bg-black text-white border-black"
                      : "bg-white text-gray-800 hover:bg-white hover:text-black hover:border-gray-400",
                    loading ? "opacity-60 cursor-not-allowed" : "",
                  ].join(" ")}
                >
                  {it}
                </button>
              )
            )}

            <button
              className="rounded border px-3 py-1.5 transition hover:border-gray-400 disabled:opacity-50"
              disabled={!canNext || loading}
              onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
              type="button"
            >
              {t("admin.common.next", { defaultValue: "Next" })}
            </button>
          </div>

          {/* Optional summary (ако решиш да го ползваш някъде) */}
          {total > 0 && (
            <div className="px-4 pb-4 text-xs text-gray-500">
              {t("admin.platform_restaurants.pagination_summary", {
                defaultValue: `Общо: ${total}`,
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
