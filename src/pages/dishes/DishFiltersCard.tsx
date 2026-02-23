import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { Category } from "../../lib/types";
import AppSelect from "../../components/AppSelect";
import { normalizeTranslationsToMap } from "./dishI18n";

type SelectOption<T extends string | number> = { value: T; label: string };

function norm(x: any) {
  return String(x || "").toLowerCase().trim();
}

export function DishFiltersCard({
  cats,
  query,
  disableAll,
  onChangeQuery,

  // ✅ NEW: selected language for dropdown labels
  activeLang,
}: {
  cats: Category[];
  query: { page: number; category_id?: number; search?: string };
  disableAll: boolean;
  onChangeQuery: (next: { page: number; category_id?: number; search?: string }) => void;

  activeLang: string;
}) {
  const { t } = useTranslation();

  const lang = norm(activeLang || "bg");

  const getCategoryLabel = (c: Category) => {
    const map = normalizeTranslationsToMap((c as any).translations);
    const tr = map?.[lang]?.name?.trim();
    return tr || (c.name ?? "").toString();
  };

  const filterCategoryOptions = useMemo<SelectOption<number | -1>[]>(() => {
    return [
      { value: -1, label: t("admin.dishes.filters.all") },
      ...cats.map((c) => ({ value: c.id, label: getCategoryLabel(c) })),
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cats, t, lang]);

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3">
        <div className="w-full sm:w-[320px]">
          <label className="flex items-center gap-2 mb-2 text-sm font-semibold text-gray-900">
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden className="text-gray-500">
              <path fill="currentColor" d="M3 5h18v2l-7 7v5l-4 2v-7L3 7V5Z" />
            </svg>
            <span>
              {t("admin.dishes.filters.title")} {t("admin.dishes.th_category").toLowerCase()}
            </span>
          </label>

          <div className="h-11 flex items-stretch [&_button]:h-11">
            <AppSelect<number | -1>
              value={(query.category_id ?? -1) as number | -1}
              onChange={(val) =>
                onChangeQuery({
                  ...query,
                  page: 1,
                  category_id: val === -1 ? undefined : Number(val),
                })
              }
              options={filterCategoryOptions}
              placeholder={t("admin.dishes.filters.all")}
              disabled={disableAll}
              buttonClassName="h-11 w-full rounded-lg px-3 border border-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-black/10"
            />
          </div>
        </div>
      </div>

      <div className="mt-4">
        <label className="mb-1 flex items-center gap-2 text-sm font-medium text-gray-700">
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
            <path
              fill="currentColor"
              d="M10 2a8 8 0 1 0 4.9 14.3l4.4 4.4 1.4-1.4-4.4-4.4A8 8 0 0 0 10 2Zm0 2a6 6 0 1 1 0 12a6 6 0 0 1 0-12Z"
            />
          </svg>
          {t("admin.dishes.filters.search")}
        </label>

        <input
          className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-black/10"
          placeholder={t("admin.dishes.filters.search_placeholder")}
          value={query.search ?? ""}
          onChange={(e) =>
            onChangeQuery({
              ...query,
              page: 1,
              search: e.target.value || undefined,
            })
          }
          disabled={disableAll}
        />
      </div>
    </div>
  );
}
