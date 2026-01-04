// src/pages/Dishes.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import type { Category, Dish, Paginated } from "../lib/types";
import { Controller, useForm } from "react-hook-form";
import { toast } from "react-hot-toast";
import { useConfirm } from "../components/ConfirmProvider";
import { bgnToEur, fmtBGN, fmtEUR } from "../lib/money";

// ✅ shared select
import AppSelect from "../components/AppSelect";

// ✅ services (admin-safe via apiAdmin вътре)
import {
  fetchDishes,
  createDish,
  updateDish,
  deleteDish,
  reorderDishes,
} from "../services/dishes";
import { fetchCategories } from "../services/categories";

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

type FormVals = {
  id?: number;
  name: string;
  category_id: number;
  description?: string;
  price: number;
  is_active: boolean;
  image?: FileList;
};

type SelectOption<T extends string | number> = { value: T; label: string };

function SortableRow({
  d,
  onEdit,
  onDelete,
  disableAll,
}: {
  d: Dish;
  onEdit: (d: Dish) => void;
  onDelete: (id: number, name: string) => void;
  disableAll: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: d.id,
    disabled: disableAll, // ✅ ако UI е busy, не позволявай drag
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    willChange: "transform",
  };

  return (
    <tr ref={setNodeRef} style={style} className="border-t bg-white">
      <td className="p-2 w-10 text-gray-500">
        {/* ✅ Mobile-friendly drag handle */}
        <button
          type="button"
          className={`select-none inline-flex items-center justify-center rounded border px-2 py-2 leading-none ${
            disableAll ? "opacity-60 cursor-not-allowed" : "cursor-grab active:cursor-grabbing"
          }`}
          title={disableAll ? "Заето..." : "Влачѝ"}
          // ✅ ключово за mobile: спира scroll-a да “изяжда” жеста
          style={{ touchAction: "none" }}
          disabled={disableAll}
          {...(!disableAll ? { ...attributes, ...listeners } : {})}
        >
          ⋮⋮
        </button>
      </td>

      <td className="p-2 text-[16px]">{d.name}</td>
      <td className="p-2 text-center text-[16px]">{d.category?.name ?? d.category?.id}</td>
      <td className="p-2 text-center text-[16px]">
        <div>{fmtBGN.format(d.price)}</div>
        <div className="opacity-70">({fmtEUR.format(bgnToEur(d.price))})</div>
      </td>
      <td style={{ width: "5rem" }} className="p-2">
        {d.image_url ? (
          <img src={d.image_url} className="h-10 w-16 object-cover rounded border" />
        ) : (
          "-"
        )}
      </td>
      <td className="p-2 text-center text-[16px]">{d.is_active ? "✓" : "—"}</td>
      <td className="p-2">
        <div className="flex justify-end items-center gap-2 whitespace-nowrap">
          <button
            className={`px-2 py-1 border rounded ${disableAll ? "opacity-60 cursor-not-allowed" : ""}`}
            disabled={disableAll}
            onClick={() => onEdit(d)}
          >
            Редакция
          </button>

          <button
            className={`px-2 py-1 border rounded ${disableAll ? "opacity-60 cursor-not-allowed" : ""}`}
            disabled={disableAll}
            onClick={() => onDelete(d.id, d.name)}
          >
            Изтрий
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function Dishes() {
  const [data, setData] = useState<Paginated<Dish> | null>(null);
  const [cats, setCats] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState<{ page: number; category_id?: number; search?: string }>({
    page: 1,
  });
  const [editing, setEditing] = useState<Dish | null>(null);
  const [uiBusy, setUiBusy] = useState(false);
  const confirm = useConfirm();

  // ✅ DnD sensors (desktop + mobile)
  const sensors = useSensors(
    // Desktop mouse
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    // Mobile touch - по-стабилно (малък delay, за да не “краде” scroll-а)
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 140,
        tolerance: 6,
      },
    }),
    useSensor(KeyboardSensor)
  );

  // локален списък за оптимистично пренареждане
  const [rows, setRows] = useState<Dish[]>([]);

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    resetField,
    formState: { isSubmitting, isValid, isDirty, errors },
  } = useForm<FormVals>({
    mode: "onChange",
    defaultValues: { name: "", price: 0, is_active: true, category_id: 0, description: "" },
  });

  const watchPrice = watch("price");
  const disableAll = uiBusy || isSubmitting;

  const categoryOptions = useMemo<SelectOption<number>[]>(() => {
    return cats.map((c) => ({ value: c.id, label: c.name }));
  }, [cats]);

  const filterCategoryOptions = useMemo<SelectOption<number | -1>[]>(() => {
    return [{ value: -1, label: "Всички" }, ...cats.map((c) => ({ value: c.id, label: c.name }))];
  }, [cats]);

  async function load(page = 1) {
    setLoading(true);
    try {
      const [dRes, cRes] = await Promise.all([
        fetchDishes({
          page,
          sort: "position,name",
          category_id: query.category_id,
          search: query.search,
        }),
        fetchCategories({ only_active: 1, sort: "position,name", page: 1 }),
      ]);

      setData(dRes);
      setCats(cRes.data ?? []);
      setRows(dRes.data ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(query.page);
    // eslint-disable-next-line
  }, [query.page, query.category_id, query.search]);

  // ---------- Image preview / remove ----------
  const [preview, setPreview] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const imageRegister = register("image");

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setRemoveImage(false);
    if (preview) URL.revokeObjectURL(preview);
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
  }

  function clearPreview(markToRemove: boolean) {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
    resetField("image");
    setRemoveImage(markToRemove);
  }

  const onEdit = (d: Dish) => {
    setEditing(d);
    reset({
      id: d.id,
      name: d.name,
      category_id: d.category?.id ?? 0,
      description: d.description ?? "",
      price: d.price,
      is_active: d.is_active,
    });
    setPreview(d.image_url ?? null);
    setRemoveImage(false);
    if (imageInputRef.current) imageInputRef.current.value = "";
    resetField("image");
  };

  const onSubmit = async (v: FormVals) => {
    if (!v.category_id || v.category_id <= 0) {
      toast.error("Моля, изберете категория.");
      return;
    }

    try {
      setUiBusy(true);

      await toast.promise(
        v.id
          ? updateDish(v.id, {
              name: v.name,
              price: v.price,
              category_id: v.category_id,
              description: v.description ?? "",
              is_active: v.is_active,
              image: v.image?.[0],
              remove_image: removeImage,
            })
          : createDish({
              name: v.name,
              price: v.price,
              category_id: v.category_id,
              description: v.description ?? "",
              is_active: v.is_active,
              image: v.image?.[0],
            }),
        {
          loading: v.id ? "Записвам промените..." : "Създавам ястие...",
          success: v.id ? "Ястието е обновено" : "Ястието е създадено",
          error: "Грешка при запис",
        }
      );

      setEditing(null);
      reset({ name: "", price: 0, is_active: true, category_id: 0, description: "" });
      clearPreview(false);
      load(query.page);
    } finally {
      setUiBusy(false);
    }
  };

  const onDelete = async (id: number, name: string) => {
    const ok = await confirm({
      title: "Изтриване на ястие",
      message: (
        <>
          Сигурни ли сте, че искате да изтриете <b>{name}</b>?<br />
          Действието е необратимо.
        </>
      ),
      confirmText: "Изтрий",
      cancelText: "Откажи",
      danger: true,
    });
    if (!ok) return;

    try {
      setUiBusy(true);
      await toast.promise(deleteDish(id), {
        loading: "Изтривам...",
        success: "Ястието е изтрито",
        error: "Грешка при изтриване",
      });
      load(query.page);
    } finally {
      setUiBusy(false);
    }
  };

  const pages = useMemo(() => {
    const last = data?.meta.last_page ?? 1;
    return Array.from({ length: last }, (_, i) => i + 1);
  }, [data?.meta.last_page]);

  // ---------- DnD ----------
  const onDragEnd = async (e: DragEndEvent) => {
    if (uiBusy) return;
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
      await toast.promise(reorderDishes(reordered.map((i) => i.id), query.category_id), {
        loading: "Записвам подредбата…",
        success: "Редът е записан",
        error: "Грешка при запис на реда",
      });

      load(1);
    } finally {
      setUiBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Ястия</h2>
      </div>

      {/* Филтри */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="min-w-[220px] max-w-full">
          <label className="block text-sm mb-1">Категория</label>

          <AppSelect<number | -1>
            value={(query.category_id ?? -1) as number | -1}
            onChange={(val) =>
              setQuery((q) => ({
                ...q,
                page: 1,
                category_id: val === -1 ? undefined : Number(val),
              }))
            }
            options={filterCategoryOptions}
            placeholder="Всички"
            disabled={disableAll}
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Търсене</label>
          <input
            className="border rounded p-2"
            placeholder="име/описание"
            onChange={(e) => setQuery((q) => ({ ...q, page: 1, search: e.target.value || undefined }))}
            disabled={disableAll}
          />
        </div>
      </div>

      {/* Форма */}
      <form onSubmit={handleSubmit(onSubmit)} className="border rounded p-4 space-y-3 bg-white overflow-hidden">
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-6">
          <div className="sm:col-span-2">
            <input
              placeholder="Име"
              className="border rounded p-2 w-full"
              {...register("name", {
                required: "Името е задължително",
                validate: (v) => v.trim().length > 0 || "Името е задължително",
              })}
              disabled={disableAll}
            />
            {errors.name && <span className="text-sm text-red-600">{errors.name.message}</span>}
          </div>

          <div className="sm:col-span-2 min-w-0">
            <Controller
              control={control}
              name="category_id"
              rules={{
                validate: (v) => (v && v > 0 ? true : "Моля, изберете категория."),
              }}
              render={({ field }) => (
                <AppSelect<number>
                  value={field.value ?? 0}
                  onChange={(val) => field.onChange(Number(val))}
                  options={[{ value: 0, label: "-- избери категория --" }, ...categoryOptions]}
                  placeholder="-- избери категория --"
                  disabled={disableAll}
                />
              )}
            />
            {errors.category_id && (
              <span className="text-sm text-red-600">{String(errors.category_id.message)}</span>
            )}
          </div>

          <div className="flex items-center gap-2 min-w-0 sm:col-span-1">
            <input
              type="number"
              step="0.01"
              placeholder="Цена"
              className="border rounded p-2 w-full"
              {...register("price", { valueAsNumber: true })}
              disabled={disableAll}
            />
            <span className="text-xs text-gray-500 shrink-0 whitespace-nowrap">
              ≈ {fmtEUR.format(bgnToEur(Number(watchPrice ?? 0)))}
            </span>
          </div>

          <label className="flex items-center gap-2 sm:col-span-1">
            <input type="checkbox" {...register("is_active")} disabled={disableAll} />
            <span>Активно</span>
          </label>

          <div className="sm:col-span-3 min-w-0">
            <label className="block text-sm mb-1">Снимка</label>
            <div className="flex flex-wrap items-center gap-3 min-w-0">
              <input
                type="file"
                accept="image/*"
                {...imageRegister}
                ref={(el) => {
                  imageInputRef.current = el ?? null;
                  imageRegister.ref(el);
                }}
                onChange={(e) => {
                  imageRegister.onChange(e);
                  handleImageChange(e);
                }}
                className="shrink-0"
                disabled={disableAll}
              />
              <div className="w-24 h-16 rounded border bg-gray-50 overflow-hidden flex items-center justify-center">
                {preview ?? editing?.image_url ? (
                  <img
                    src={(preview ?? editing?.image_url) as string}
                    alt="Preview"
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <span className="text-xs text-gray-500">Няма снимка</span>
                )}
              </div>
            </div>

            {(preview || editing?.image_url) && (
              <button
                type="button"
                onClick={() => clearPreview(true)}
                className={`mt-2 text-xs text-gray-600 underline ${disableAll ? "opacity-60 cursor-not-allowed" : ""}`}
                disabled={disableAll}
                title="Премахни снимката"
              >
                Премахни снимката
              </button>
            )}
          </div>
        </div>

        <textarea
          placeholder="Описание"
          className="w-full border rounded p-2"
          rows={3}
          {...register("description")}
          disabled={disableAll}
        />

        <div className="flex flex-wrap items-center gap-2">
          <button
            className={`px-4 py-2 rounded text-white bg-black ${
              !isDirty || !isValid || disableAll ? "opacity-60 cursor-not-allowed" : ""
            }`}
            disabled={!isDirty || !isValid || disableAll}
          >
            {editing ? "Запази" : "Създай"}
          </button>

          {editing && (
            <button
              type="button"
              className={`px-3 py-2 bg-gray-200 rounded ${disableAll ? "opacity-60 cursor-not-allowed" : ""}`}
              disabled={disableAll}
              onClick={() => {
                setEditing(null);
                reset({ name: "", price: 0, is_active: true, category_id: 0, description: "" });
                clearPreview(false);
              }}
            >
              Откажи
            </button>
          )}
        </div>
      </form>

      {/* Таблица + DnD */}
      <div className="overflow-x-auto rounded-lg border bg-white">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={rows.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-2 w-10"></th>
                  <th className="p-2 text-left">Име</th>
                  <th className="p-2">Категория</th>
                  <th className="p-2">Цена</th>
                  <th className="p-2">Снимка</th>
                  <th className="p-2">Активно</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td className="p-3" colSpan={7}>
                      Зареждане...
                    </td>
                  </tr>
                )}
                {rows.map((d) => (
                  <SortableRow key={d.id} d={d} onEdit={onEdit} onDelete={onDelete} disableAll={disableAll} />
                ))}
              </tbody>
            </table>
          </SortableContext>
        </DndContext>
      </div>

      {/* Странициране */}
      <div className="flex gap-2">
        {pages.map((p) => (
          <button
            key={p}
            onClick={() => setQuery((q) => ({ ...q, page: p }))}
            disabled={disableAll || loading}
            className={`px-3 py-1 rounded border ${disableAll || loading ? "opacity-60 cursor-not-allowed" : ""} ${
              p === data?.meta.current_page ? "bg-black text-white" : ""
            }`}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}
