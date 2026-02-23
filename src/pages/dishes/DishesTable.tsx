import { useTranslation } from "react-i18next";
import type { Dish } from "../../lib/types";

// dnd-kit
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { restrictToVerticalAxis, restrictToFirstScrollableAncestor } from "@dnd-kit/modifiers";

import { SortableDishRow } from "./SortableDishRow";

export function DishesTable({
  rows,
  loading,
  disableAll,
  onDragEnd,
  onEdit,
  onDelete,
  getDisplayName,
  activeId, // ✅ NEW
}: {
  rows: Dish[];
  loading: boolean;
  disableAll: boolean;
  onDragEnd: (e: DragEndEvent) => void;
  onEdit: (d: Dish) => void;
  onDelete: (id: number, name: string) => void;
  getDisplayName: (d: Dish) => string;
  activeId?: number | null; // ✅ NEW
}) {
  const { t } = useTranslation();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 140, tolerance: 6 } }),
    useSensor(KeyboardSensor)
  );

  return (
    <div className="overflow-x-auto rounded-2xl border bg-white shadow-sm">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
        modifiers={[restrictToVerticalAxis, restrictToFirstScrollableAncestor]}
      >
        <SortableContext items={rows.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-2 w-12"></th>
                <th className="p-2 text-left">{t("admin.dishes.th_name")}</th>
                <th className="p-2">{t("admin.dishes.th_category")}</th>
                <th className="p-2">{t("admin.dishes.th_price")}</th>
                <th className="p-2">{t("admin.dishes.th_photo")}</th>
                <th className="p-2">{t("admin.dishes.th_active")}</th>
                <th className="p-2"></th>
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td className="p-4 text-gray-600" colSpan={7}>
                    {t("admin.common.loading")}
                  </td>
                </tr>
              )}

              {!loading && rows.length === 0 && (
                <tr>
                  <td className="p-6 text-center text-gray-500" colSpan={7}>
                    {t("admin.common.no_results") ?? "No results"}
                  </td>
                </tr>
              )}

              {rows.map((d) => {
                const displayName = getDisplayName(d);
                return (
                  <SortableDishRow
                    key={d.id}
                    d={d}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    disableAll={disableAll}
                    displayName={displayName}
                    activeId={activeId ?? null} // ✅ NEW
                  />
                );
              })}
            </tbody>
          </table>
        </SortableContext>
      </DndContext>
    </div>
  );
}
