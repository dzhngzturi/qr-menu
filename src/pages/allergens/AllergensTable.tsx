import { DndContext, closestCenter } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { DragEndEvent, SensorDescriptor } from "@dnd-kit/core";
import type { Allergen } from "../../lib/types";
import { SortableAllergenRow } from "./SortableAllergenRow";

type VM = {
  msg: (k: string, opts?: any) => string;
  loading: boolean;
  disableAll: boolean;
  filteredRows: Allergen[];
  sensors: SensorDescriptor<any>[];
  onDragEnd: (e: DragEndEvent) => void;
  onEdit: (a: Allergen) => void;
  onDelete: (a: Allergen) => void;

  // ✅ needed to display translated name
  defaultLang: string;
};

function normLang(v: unknown) {
  return String(v ?? "").trim().toLowerCase();
}

function displayAllergenName(a: Allergen, defaultLang: string) {
  const tr = Array.isArray(a.translations) ? a.translations : [];
  const dl = normLang(defaultLang);

  const hit = tr.find((x) => normLang(x.lang) === dl)?.name;
  if (hit && String(hit).trim()) return String(hit);

  const any = tr.find((x) => x?.name && String(x.name).trim())?.name;
  if (any && String(any).trim()) return String(any);

  // legacy fallback
  return String((a as any).name ?? "");
}

export function AllergensTable({ vm }: { vm: VM }) {
  const items = vm.filteredRows;

  return (
    <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <div className="text-sm font-semibold">
          {vm.msg("admin.allergens.list_title", { defaultValue: "Списък" })}
        </div>
        <div className="text-xs text-gray-500">
          {vm.loading
            ? vm.msg("admin.common.loading", { defaultValue: "Зареждане..." })
            : `${vm.msg("admin.common.total", { defaultValue: "Общо" })}: ${items.length}`}
        </div>
      </div>

      <div className="overflow-auto">
        <DndContext sensors={vm.sensors} collisionDetection={closestCenter} onDragEnd={vm.onDragEnd}>
          <SortableContext items={items.map((x) => x.id)} strategy={verticalListSortingStrategy}>
            <table className="min-w-[980px] w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs text-gray-600">
                  <th className="p-2 w-12" />
                  <th className="p-2 w-[120px]">{vm.msg("admin.allergens.th_code", { defaultValue: "Код" })}</th>
                  <th className="p-2">{vm.msg("admin.allergens.th_name", { defaultValue: "Име" })}</th>
                  <th className="p-2 w-[140px]">{vm.msg("admin.allergens.th_photo", { defaultValue: "Снимка" })}</th>
                  <th className="p-2 w-[120px] text-center">
                    {vm.msg("admin.allergens.th_active", { defaultValue: "Активно" })}
                  </th>
                  <th className="p-2 w-[260px]" />
                </tr>
              </thead>

              <tbody>
                {items.map((a) => (
                  <SortableAllergenRow
                    key={a.id}
                    a={a}
                    disableAll={vm.disableAll}
                    msg={vm.msg}
                    displayName={displayAllergenName(a, vm.defaultLang)}
                    onEdit={(x) => vm.onEdit(x)}
                    onDelete={(x) => vm.onDelete(x)}
                  />
                ))}

                {!vm.loading && items.length === 0 && (
                  <tr className="border-t">
                    <td className="p-6 text-center text-gray-500" colSpan={6}>
                      {vm.msg("admin.allergens.no_results", { defaultValue: "Няма намерени резултати." })}
                    </td>
                  </tr>
                )}

                {vm.loading && (
                  <tr className="border-t">
                    <td className="p-6 text-left text-gray-600" colSpan={6}>
                      {vm.msg("admin.common.loading", { defaultValue: "Зареждане..." })}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}
