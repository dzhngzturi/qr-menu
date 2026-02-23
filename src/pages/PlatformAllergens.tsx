// src/pages/PlatformAllergens.tsx
import { usePlatformAllergensPage } from "./allergens/hooks/usePlatformAllergensPage";
import { AllergenForm } from "./allergens/AllergenForm";
import { AllergensTable } from "./allergens/AllergensTable";

export default function PlatformAllergensPage() {
  const vm = usePlatformAllergensPage();

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div>
        <h1 className="text-2xl font-semibold">
          {vm.msg("admin.allergens.title", { defaultValue: "Алергени (Platform)" })}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Master списък (управлява се от Super Admin).
        </p>
      </div>

      {/* SEARCH (като Dishes: иконата е в label-а, не в input-а) */}
      <div className="max-w-sm">
        <label className="mb-1 flex items-center gap-2 text-sm font-medium text-gray-700">
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
            <path
              fill="currentColor"
              d="M10 2a8 8 0 1 0 4.9 14.3l4.4 4.4 1.4-1.4-4.4-4.4A8 8 0 0 0 10 2Zm0 2a6 6 0 1 1 0 12a6 6 0 0 1 0-12Z"
            />
          </svg>
          {vm.msg("admin.allergens.search", { defaultValue: "Търсене" })}
        </label>

        <input
          className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-black/10"
          placeholder={vm.msg("admin.allergens.search_placeholder", {
            defaultValue: "код или име...",
          })}
          value={vm.search ?? ""}
          onChange={(e) => vm.setSearch(e.target.value)}
        />
      </div>

      <AllergenForm vm={vm} />
      <AllergensTable vm={vm} />

      <p className="text-xs text-gray-500">
        {vm.msg("admin.allergens.tip", {
          defaultValue: "Tip: влачи редовете за подредба. Подредбата се запазва автоматично.",
        })}
      </p>
    </div>
  );
}
