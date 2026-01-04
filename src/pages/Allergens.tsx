// src/pages/Allergens.tsx
import { useEffect, useMemo, useState } from "react";
import type { Paginated } from "../lib/types";
import { useForm } from "react-hook-form";
import { toast } from "react-hot-toast";

// ✅ services (admin-safe via apiAdmin inside the service)
import {
  fetchAllergens,
  createAllergen,
  updateAllergen,
  deleteAllergen,
  reorderAllergens,
  type Allergen,
} from "../services/allergens";

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
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ✅ modifiers
import { restrictToVerticalAxis, restrictToFirstScrollableAncestor } from "@dnd-kit/modifiers";

type FormVals = { id?: number; code: string; name: string; is_active: boolean };

// --- Sortable row
function SortableRow({
  a,
  onEdit,
  onDelete,
  disableAll,
}: {
  a: Allergen;
  onEdit: (a: Allergen) => void;
  onDelete: (a: Allergen) => void;
  disableAll: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: a.id,
    disabled: disableAll,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    willChange: "transform",
  };

  return (
    <tr ref={setNodeRef} style={style} className="border-t bg-white">
      <td className="p-2 w-10 text-gray-500">
        <button
          type="button"
          className={`select-none inline-flex items-center justify-center rounded border px-2 py-2 leading-none ${
            disableAll ? "opacity-60 cursor-not-allowed" : "cursor-grab active:cursor-grabbing"
          }`}
          title={disableAll ? "Заето..." : "Влачѝ"}
          style={{ touchAction: "none" }}
          disabled={disableAll}
          {...(!disableAll ? { ...attributes, ...listeners } : {})}
        >
          ⋮⋮
        </button>
      </td>

      <td className="p-2 font-mono text-[13px] sm:text-sm">{a.code}</td>
      <td className="p-2 text-[15px] sm:text-sm">{a.name}</td>

      <td className="p-2 text-center">{a.is_active ? "✓" : "—"}</td>

      <td className="p-2">
        <div className="flex justify-end items-center gap-2 whitespace-nowrap">
          <button
            className={`px-2 py-1 border rounded ${disableAll ? "opacity-60 cursor-not-allowed" : ""}`}
            disabled={disableAll}
            onClick={() => onEdit(a)}
          >
            Редакция
          </button>
          <button
            className={`px-2 py-1 border rounded ${disableAll ? "opacity-60 cursor-not-allowed" : ""}`}
            disabled={disableAll}
            onClick={() => onDelete(a)}
          >
            Изтрий
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function Allergens() {
  const [data, setData] = useState<Paginated<Allergen> | null>(null);
  const [rows, setRows] = useState<Allergen[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState<{ page: number; search?: string }>({ page: 1 });
  const [uiBusy, setUiBusy] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting, isDirty, isValid },
  } = useForm<FormVals>({
    mode: "onChange",
    defaultValues: { code: "", name: "", is_active: true },
  });

  const disableAll = uiBusy || isSubmitting;
  const editingId = watch("id");

  // ✅ DnD sensors (desktop + mobile)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 160,
        tolerance: 6,
      },
    }),
    useSensor(KeyboardSensor)
  );

  async function load(page = 1) {
    setLoading(true);
    try {
      const res = await fetchAllergens({
        page,
        search: query.search,
        sort: "position,name",
      });
      setData(res);
      setRows(res.data ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(query.page);
    // eslint-disable-next-line
  }, [query.page, query.search]);

  const onSubmit = async (v: FormVals) => {
    try {
      setUiBusy(true);

      await toast.promise(
        v.id
          ? updateAllergen(v.id, { code: v.code, name: v.name, is_active: v.is_active })
          : createAllergen({ code: v.code, name: v.name, is_active: v.is_active }),
        {
          loading: v.id ? "Записвам промените..." : "Създавам алерген...",
          success: v.id ? "Алергенът е обновен" : "Алергенът е създаден",
          error: "Грешка при запис",
        }
      );

      reset({ code: "", name: "", is_active: true });
      load(query.page);
    } finally {
      setUiBusy(false);
    }
  };

  const onEdit = (a: Allergen) => {
    reset({ id: a.id, code: a.code, name: a.name, is_active: a.is_active });
  };

  const onCancelEdit = () => {
    reset({ code: "", name: "", is_active: true });
  };

  const onDelete = async (a: Allergen) => {
    try {
      setUiBusy(true);
      await toast.promise(deleteAllergen(a.id), {
        loading: "Трия...",
        success: "Изтрито",
        error: "Грешка при триене",
      });
      load(query.page);
    } finally {
      setUiBusy(false);
    }
  };

  // Drag end -> optimistic reorder + API save
  const onDragEnd = async (e: DragEndEvent) => {
    if (disableAll) return;
    const { active, over } = e;
    if (!over || active.id === over.id) return;

    const list = [...rows];
    const oldIndex = list.findIndex((i) => i.id === active.id);
    const newIndex = list.findIndex((i) => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(list, oldIndex, newIndex);
    setRows(reordered);

    try {
      setUiBusy(true);
      await toast.promise(reorderAllergens(reordered.map((i) => i.id)), {
        loading: "Записвам подредбата…",
        success: "Редът е записан",
        error: "Грешка при запис на реда",
      });
    } finally {
      setUiBusy(false);
    }
  };

  const pages = useMemo(() => {
    const last = data?.meta?.last_page ?? 1;
    return Array.from({ length: last }, (_, i) => i + 1);
  }, [data?.meta?.last_page]);

  return (
    <div className="space-y-6">
      {/* Header + Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Алергени</h2>
          <p className="text-sm text-gray-500">Подредба (drag), активност и редакция.</p>
        </div>

        <div className="w-full sm:w-80">
          <label className="block text-sm mb-1">Търсене</label>
          <input
            className="border rounded p-2 w-full"
            placeholder="код или име..."
            value={query.search ?? ""}
            onChange={(e) => setQuery((q) => ({ ...q, page: 1, search: e.target.value || undefined }))}
            disabled={disableAll}
          />
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="border rounded p-4 space-y-3 bg-white">
        {editingId ? (
          <div className="text-sm text-gray-700">
            Редакция на алерген ID: <span className="font-mono">{editingId}</span>
          </div>
        ) : (
          <div className="text-sm text-gray-700">Добавяне на нов алерген</div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
          <div className="sm:col-span-1">
            <label className="block text-sm mb-1">Код</label>
            <input
              placeholder="A1"
              className={`border rounded p-2 w-full ${errors.code ? "border-red-500" : ""}`}
              disabled={disableAll}
              {...register("code", {
                required: "Кодът е задължителен",
                validate: (v) => v.trim().length > 0 || "Кодът е задължителен",
              })}
            />
            {errors.code && <p className="text-sm text-red-600">{errors.code.message}</p>}
          </div>

          <div className="sm:col-span-4">
            <label className="block text-sm mb-1">Име</label>
            <input
              placeholder="напр. Яйца"
              className={`border rounded p-2 w-full ${errors.name ? "border-red-500" : ""}`}
              disabled={disableAll}
              {...register("name", {
                required: "Името е задължително",
                validate: (v) => v.trim().length > 0 || "Името е задължително",
              })}
            />
            {errors.name && <p className="text-sm text-red-600">{errors.name.message}</p>}
          </div>

          <div className="sm:col-span-1 flex items-end">
            <label className="inline-flex items-center gap-2 select-none">
              <input type="checkbox" disabled={disableAll} {...register("is_active")} />
              Активно
            </label>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            className={`px-4 py-2 bg-black text-white rounded ${
              !isDirty || !isValid || disableAll ? "opacity-60 cursor-not-allowed" : ""
            }`}
            disabled={!isDirty || !isValid || disableAll}
          >
            {editingId ? "Запази" : "Създай"}
          </button>

          {editingId ? (
            <button
              type="button"
              className={`px-3 py-2 bg-gray-200 rounded ${disableAll ? "opacity-60 cursor-not-allowed" : ""}`}
              disabled={disableAll}
              onClick={onCancelEdit}
            >
              Откажи
            </button>
          ) : null}
        </div>
      </form>

      {/* Table + DnD */}
      <div className="overflow-x-auto rounded-lg border bg-white">
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
                  <th className="p-2 w-10"></th>
                  <th className="p-2 text-left">Код</th>
                  <th className="p-2 text-left">Име</th>
                  <th className="p-2 text-center">Активно</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td className="p-3" colSpan={5}>
                      Зареждане...
                    </td>
                  </tr>
                )}

                {!loading && rows.length === 0 && (
                  <tr>
                    <td className="p-4 text-gray-500" colSpan={5}>
                      Няма резултати.
                    </td>
                  </tr>
                )}

                {rows.map((a) => (
                  <SortableRow key={a.id} a={a} onEdit={onEdit} onDelete={onDelete} disableAll={disableAll} />
                ))}
              </tbody>
            </table>
          </SortableContext>
        </DndContext>
      </div>

      {/* Pagination */}
      <div className="flex gap-2 flex-wrap">
        {pages.map((p) => (
          <button
            key={p}
            onClick={() => setQuery((q) => ({ ...q, page: p }))}
            disabled={disableAll || loading}
            className={`px-3 py-1 rounded border ${
              disableAll || loading ? "opacity-60 cursor-not-allowed" : ""
            } ${p === data?.meta?.current_page ? "bg-black text-white" : ""}`}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}
