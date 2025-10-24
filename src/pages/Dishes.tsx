// src/pages/Dishes.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import api from "../lib/api";
import type { Category, Dish, Paginated } from "../lib/types";
import { useForm } from "react-hook-form";
import { toast } from "react-hot-toast";
import { useConfirm } from "../components/ConfirmProvider";
import { bgnToEur, fmtBGN, fmtEUR } from "../lib/money";

// dnd-kit
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
  PointerSensor,
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
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: d.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    willChange: "transform",
  };

  return (
    <tr ref={setNodeRef} style={style} className="border-t bg-white">
      <td
        className={`p-2 w-8 select-none text-gray-500 ${disableAll ? "cursor-not-allowed opacity-60" : "cursor-grab"}`}
        title={disableAll ? "Заето..." : "Влачѝ"}
        {...(!disableAll ? { ...attributes, ...listeners } : {})}
      >
        ⋮⋮
      </td>
      <td className="p-2 text-[16px]">{d.name}</td>
      <td className="p-2 text-center text-[16px]">{d.category?.name ?? d.category?.id}</td>
      <td className="p-2 text-center text-[16px]">
        <div>{fmtBGN.format(d.price)}</div>
        <div className="opacity-70">({fmtEUR.format(bgnToEur(d.price))})</div>
      </td>
      <td style={{ width: "5rem" }} className="p-2">
        {d.image_url ? <img src={d.image_url} className="h-10 w-16 object-cover rounded border" /> : "-"}
      </td>
      <td className="p-2 text-center text-[16px]">{d.is_active ? "✓" : "—"}</td>
      <td className="p-2 text-right">
        <button
          className={`px-2 py-1 border rounded mr-2 ${disableAll ? "opacity-60 cursor-not-allowed" : ""}`}
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
      </td>
    </tr>
  );
}

export default function Dishes() {
  const [data, setData] = useState<Paginated<Dish> | null>(null);
  const [cats, setCats] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState<{ page: number; category_id?: number; search?: string }>({ page: 1 });
  const [editing, setEditing] = useState<Dish | null>(null);
  const [uiBusy, setUiBusy] = useState(false); // 👈 глобален lock
  const confirm = useConfirm();

  // dnd sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  // локален списък за оптимистично пренареждане
  const [rows, setRows] = useState<Dish[]>([]);

  const {
    register,
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

  const disableAll = uiBusy || isSubmitting; // общ флаг за бутони

  async function load(page = 1) {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    if (query.category_id) params.set("category_id", String(query.category_id));
    if (query.search) params.set("search", query.search);
    params.set("sort", "position,name"); // важно: да виждаме реда по position

    try {
      const [dRes, cRes] = await Promise.all([
        api.get(`/dishes?${params.toString()}`),
        api.get(`/categories?only_active=1&sort=position,name`),
      ]);
      setData(dRes.data);
      setCats(cRes.data.data);
      setRows((dRes.data?.data as Dish[]) ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(query.page);
    // eslint-disable-next-line
  }, [query.page, query.category_id, query.search]);

  const onEdit = (d: Dish) => {
    setEditing(d);
    reset({
      id: d.id,
      name: d.name,
      category_id: d.category.id,
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
    const form = new FormData();
    form.append("name", v.name);
    form.append("price", String(v.price));
    form.append("category_id", String(v.category_id));
    form.append("description", v.description ?? "");
    form.append("is_active", String(v.is_active ? 1 : 0));
    if (v.image?.[0]) form.append("image", v.image[0]);
    if (removeImage) form.append("remove_image", "1"); // бекенд да нулира снимката

    try {
      setUiBusy(true);
      await toast.promise(
        v.id ? api.post(`/dishes/${v.id}?_method=PATCH`, form) : api.post("/dishes", form),
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
      await toast.promise(api.delete(`/dishes/${id}`), {
        loading: "Изтривам...",
        success: "Ястието е изтрито",
        error: "Грешка при изтриване",
      });
      load(query.page);
    } finally {
      setUiBusy(false);
    }
  };

  // ---------- Image preview / remove ----------
  const [preview, setPreview] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const imageRegister = register("image"); // ще слеем ref-овете

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setRemoveImage(false); // има нов файл -> няма нужда да трием старата
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
    setRemoveImage(markToRemove); // ако true -> ще пратим remove_image=1
  }

  const pages = useMemo(() => {
    const last = data?.meta.last_page ?? 1;
    return Array.from({ length: last }, (_, i) => i + 1);
  }, [data?.meta.last_page]);

  // ---------- DnD ----------
  const onDragEnd = async (e: DragEndEvent) => {
    if (uiBusy) return; // не позволявай паралелни операции
    const { active, over } = e;
    if (!over || active.id === over.id) return;

    const list = [...rows];
    const oldIndex = list.findIndex((i) => i.id === active.id);
    const newIndex = list.findIndex((i) => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(list, oldIndex, newIndex);
    setRows(reordered); // optimistic

    try {
      setUiBusy(true);
      await toast.promise(
        api.post("/dishes/reorder", {
          ids: reordered.map((i) => i.id),
          category_id: query.category_id ?? undefined, // 👈 ВАЖНО
        }),
        { loading: "Записвам подредбата…", success: "Редът е записан", error: "Грешка при запис на реда" }
      );
      // За да видиш промяната (при сорт по position):
      load(1); // 👈 върни се на стр. 1
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
        <div>
          <label className="block text-sm mb-1">Категория</label>
          <select
            className="border rounded p-2"
            value={query.category_id ?? ""}
            onChange={(e) =>
              setQuery((q) => ({ ...q, page: 1, category_id: e.target.value ? Number(e.target.value) : undefined }))
            }
            disabled={disableAll}
          >
            <option value="">Всички</option>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
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

          <select
            className="border rounded p-2 w-full sm:col-span-2"
            {...register("category_id", { valueAsNumber: true })}
            disabled={disableAll}
          >
            <option value={0}>-- избери категория --</option>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

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
                  imageInputRef.current = el ?? null; // нашият DOM ref
                  imageRegister.ref(el); // RHF ref
                }}
                onChange={(e) => {
                  imageRegister.onChange(e); // RHF да види файла
                  handleImageChange(e); // превю
                }}
                className="shrink-0"
                disabled={disableAll}
              />
              <div className="w-24 h-16 rounded border bg-gray-50 overflow-hidden flex items-center justify-center">
                {(preview ?? editing?.image_url) ? (
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
                  <th className="p-2 w-8"></th>
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
            className={`px-3 py-1 rounded border ${
              disableAll || loading ? "opacity-60 cursor-not-allowed" : ""
            } ${p === data?.meta.current_page ? "bg-black text-white" : ""}`}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}
