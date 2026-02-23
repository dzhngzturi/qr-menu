import type { Dish } from "../../lib/types";
import { useTranslation } from "react-i18next";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { fmtEUR } from "../../lib/money";
import { Pencil, Trash2 } from "lucide-react";

type Props = {
  d: Dish;
  onEdit: (d: Dish) => void;
  onDelete: (id: number, name: string) => void;
  disableAll: boolean;
  displayName: string;

  // ✅ NEW
  activeId?: number | null;
};

export function SortableDishRow({
  d,
  onEdit,
  onDelete,
  disableAll,
  displayName,
  activeId = null,
}: Props) {
  const { t } = useTranslation();

  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: d.id,
    disabled: disableAll,
  });

  const isActive = activeId === d.id;

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    willChange: "transform",
  };

  const btnBase =
    "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition whitespace-nowrap";
  const btnDisabled = disableAll ? "opacity-60 cursor-not-allowed" : "";

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={[
        "border-t transition-colors",
        isActive ? "bg-gray-100" : "bg-white hover:bg-gray-50",
      ].join(" ")}
    >
      <td className="p-2 w-12 text-gray-500 align-middle">
        <button
          type="button"
          className={[
            "select-none inline-flex items-center justify-center rounded-lg border px-2 py-2 leading-none",
            disableAll ? "opacity-60 cursor-not-allowed" : "cursor-grab active:cursor-grabbing",
          ].join(" ")}
          title={disableAll ? t("admin.common.busy") : t("admin.dishes.drag")}
          style={{ touchAction: "none" }}
          disabled={disableAll}
          {...(!disableAll ? { ...attributes, ...listeners } : {})}
        >
          ⋮⋮
        </button>
      </td>

      <td className="p-2 text-[15px] font-medium text-gray-900">{displayName}</td>

      <td className="p-2 text-center text-[14px] text-gray-700">
        {d.category?.name ?? d.category?.id ?? "—"}
      </td>

      <td className="p-2 text-center text-[14px]">
        <div className="font-medium text-gray-900">{fmtEUR.format(d.price)}</div>
      </td>

      <td style={{ width: "6rem" }} className="p-2">
        {d.image_url ? (
          <img
            src={d.image_url}
            className="h-10 w-16 object-cover rounded-lg border"
            alt={displayName}
          />
        ) : (
          <span className="text-gray-300">—</span>
        )}
      </td>

      <td className="p-2 text-center text-[14px]">{d.is_active ? "✓" : "—"}</td>

      <td className="p-2">
        <div className="flex justify-end items-center gap-2 whitespace-nowrap">
          {/* EDIT — warning on hover */}
          <button
            type="button"
            disabled={disableAll}
            onClick={() => onEdit(d)}
            className={[
              btnBase,
              "hover:bg-amber-50 hover:border-amber-300 hover:text-amber-800",
              btnDisabled,
            ].join(" ")}
          >
            <Pencil size={16} strokeWidth={2} />
            {t("admin.common.edit")}
          </button>

          {/* DELETE — danger on hover */}
          <button
            type="button"
            disabled={disableAll}
            onClick={() => onDelete(d.id, displayName)}
            className={[
              btnBase,
              "hover:bg-red-50 hover:border-red-200 hover:text-red-600",
              btnDisabled,
            ].join(" ")}
          >
            <Trash2 size={16} strokeWidth={2} />
            {t("admin.common.delete")}
          </button>
        </div>
      </td>
    </tr>
  );
}
