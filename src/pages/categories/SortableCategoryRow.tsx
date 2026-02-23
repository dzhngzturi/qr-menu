// src/pages/categories/SortableCategoryRow.tsx
import type { Category } from "../../lib/types";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { CSSProperties } from "react";
import { Pencil, Trash2 } from "lucide-react";

type Props = {
  c: Category;
  onEdit: (c: Category) => void;
  onDelete: (id: number, name: string) => void;
  disableAll: boolean;
  msg: (key: string, vars?: Record<string, any>) => string;
  displayName: string;
  activeId?: number | null;
};

export function SortableCategoryRow({
  c,
  onEdit,
  onDelete,
  disableAll,
  msg,
  displayName,
  activeId = null,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: c.id,
    disabled: disableAll,
  });

  const isActive = activeId === c.id;

  const style: CSSProperties = {
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
      {/* drag */}
      <td className="p-2 w-12 text-gray-500">
        <button
          type="button"
          className={[
            "select-none inline-flex items-center justify-center rounded-lg border px-2 py-2 leading-none",
            disableAll ? "opacity-60 cursor-not-allowed" : "cursor-grab active:cursor-grabbing",
          ].join(" ")}
          title={disableAll ? msg("admin.common.busy") : msg("admin.categories.drag")}
          style={{ touchAction: "none" }}
          disabled={disableAll}
          {...(!disableAll ? { ...attributes, ...listeners } : {})}
          aria-label={msg("admin.categories.drag")}
        >
          ⋮⋮
        </button>
      </td>

      <td className="p-2 text-[15px] font-medium">{displayName}</td>

      <td style={{ width: "6rem" }} className="p-2">
        {c.image_url ? (
          <img
            className="h-10 w-16 object-cover rounded-lg border"
            src={c.image_url}
            alt={displayName}
            loading="lazy"
          />
        ) : (
          <span className="text-gray-400">—</span>
        )}
      </td>

      <td className="p-2 text-center text-[14px]">{c.dishes_count ?? "-"}</td>
      <td className="p-2 text-center text-[14px]">{c.is_active ? "✓" : "—"}</td>

      {/* actions */}
      <td className="p-2">
        <div className="flex justify-end items-center gap-2">
          {/* EDIT */}
          <button
            type="button"
            disabled={disableAll}
            onClick={() => onEdit(c)}
            className={[
              btnBase,
              "hover:bg-amber-50 hover:border-amber-300 hover:text-amber-800",
              btnDisabled,
            ].join(" ")}
          >
            <Pencil size={16} strokeWidth={2} />
            {msg("admin.common.edit")}
          </button>

          {/* DELETE */}
          <button
            type="button"
            disabled={disableAll}
            onClick={() => onDelete(c.id, displayName)}
            className={[
              btnBase,
              "hover:bg-red-50 hover:border-red-200 hover:text-red-600",
              btnDisabled,
            ].join(" ")}
          >
            <Trash2 size={16} strokeWidth={2} />
            {msg("admin.common.delete")}
          </button>
        </div>
      </td>
    </tr>
  );
}
