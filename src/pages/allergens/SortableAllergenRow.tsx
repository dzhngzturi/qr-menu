import type { Allergen } from "../../lib/types";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { CSSProperties } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { allergenIconUrl } from "../../lib/allergenIcons";

type Props = {
  a: Allergen;
  onEdit: (a: Allergen) => void;
  onDelete: (a: Allergen) => void;
  disableAll: boolean;
  msg: (key: string, vars?: Record<string, any>) => string;
  displayName: string;
};

export function SortableAllergenRow({ a, onEdit, onDelete, disableAll, msg, displayName }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: a.id,
    disabled: disableAll,
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    willChange: "transform",
  };

  const btnBase = "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition whitespace-nowrap";
  const btnDisabled = disableAll ? "opacity-60 cursor-not-allowed" : "";

  return (
    <tr ref={setNodeRef} style={style} className="border-t bg-white hover:bg-gray-50 transition-colors">
      <td className="p-2 w-12 text-gray-500">
        <button
          type="button"
          className={[
            "select-none inline-flex items-center justify-center rounded-lg border px-2 py-2 leading-none",
            disableAll ? "opacity-60 cursor-not-allowed" : "cursor-grab active:cursor-grabbing",
          ].join(" ")}
          title={disableAll ? msg("admin.common.busy", { defaultValue: "Заето..." }) : msg("admin.allergens.drag", { defaultValue: "Влачи" })}
          style={{ touchAction: "none" }}
          disabled={disableAll}
          {...(!disableAll ? { ...attributes, ...listeners } : {})}
          aria-label={msg("admin.allergens.drag", { defaultValue: "Влачи" })}
        >
          ⋮⋮
        </button>
      </td>

      <td className="p-2 text-[15px] font-medium">{a.code}</td>
      <td className="p-2 text-[15px]">{displayName}</td>

      <td className="p-2">
        {(() => {
          const url = allergenIconUrl(a.code);
          if (!url) return <span className="text-gray-400">—</span>;

          return (
            <img
              className="h-10 w-16 object-contain rounded-lg border bg-white"
              src={url}
              alt={displayName}
              loading="lazy"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          );
        })()}
      </td>

      <td className="p-2 text-center text-[14px]">{a.is_active ? "✓" : "—"}</td>

      <td className="p-2">
        <div className="flex justify-end items-center gap-2">
          <button
            type="button"
            disabled={disableAll}
            onClick={() => onEdit(a)}
            className={[btnBase, "hover:bg-amber-50 hover:border-amber-300 hover:text-amber-800", btnDisabled].join(" ")}
          >
            <Pencil size={16} strokeWidth={2} />
            {msg("admin.common.edit", { defaultValue: "Редактирай" })}
          </button>

          <button
            type="button"
            disabled={disableAll}
            onClick={() => onDelete(a)}
            className={[btnBase, "hover:bg-red-50 hover:border-red-200 hover:text-red-600", btnDisabled].join(" ")}
          >
            <Trash2 size={16} strokeWidth={2} />
            {msg("admin.common.delete", { defaultValue: "Изтрий" })}
          </button>
        </div>
      </td>
    </tr>
  );
}
