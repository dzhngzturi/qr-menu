// src/pages/Categories.tsx
import { useEffect, useMemo, useState } from "react";
import api from "../lib/api";
import type { Category, Paginated } from "../lib/types";
import { useForm } from "react-hook-form";
import { toast } from "react-hot-toast";
import { useConfirm } from "../components/ConfirmProvider";

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

type FormVals = { id?: number; name: string; is_active: boolean; image?: FileList };

// --- Sortable row
function SortableRow({
  c,
  onEdit,
  onDelete,
  disableAll,
}: {
  c: Category;
  onEdit: (c: Category) => void;
  onDelete: (id: number, name: string) => void;
  disableAll: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: c.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    willChange: "transform",
  };

  return (
    <tr ref={setNodeRef} style={style} className="border-t bg-white">
      <td
        className={`p-2 w-8 select-none text-gray-500 ${
          disableAll ? "cursor-not-allowed opacity-60" : "cursor-grab"
        }`}
        title={disableAll ? "Заето..." : "Влачѝ"}
        {...(!disableAll ? { ...attributes, ...listeners } : {})}
      >
        ⋮⋮
      </td>
      <td className="p-2 text-[16px]">{c.name}</td>
      <td style={{ width: "5rem" }} className="p-2">
        {c.image_url ? (
          <img className="h-10 w-16 object-cover rounded border" src={c.image_url} />
        ) : (
          "-"
        )}
      </td>
      <td className="p-2 text-center text-[16px]">{c.dishes_count ?? "-"}</td>
      <td className="p-2 text-center text-[16px]">{c.is_active ? "✓" : "—"}</td>
      <td className="p-2 text-right">
        <button
          className={`px-2 py-1 border rounded mr-2 ${
            disableAll ? "opacity-60 cursor-not-allowed" : ""
          }`}
          disabled={disableAll}
          onClick={() => onEdit(c)}
        >
          Редакция
        </button>
        <button
          className={`px-2 py-1 border rounded ${
            disableAll ? "opacity-60 cursor-not-allowed" : ""
          }`}
          disabled={disableAll}
          onClick={() => onDelete(c.id, c.name)}
        >
          Изтрий
        </button>
      </td>
    </tr>
  );
}

export default function Categories() {
  const [q, setQ] = useState({ page: 1 });
  const [data, setData] = useState<Paginated<Category> | null>(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [uiBusy, setUiBusy] = useState(false); // 👈 глобален lock
  const askConfirm = useConfirm();

  // image preview
  const [preview, setPreview] = useState<string | null>(null);
  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (preview) URL.revokeObjectURL(preview);
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
  }
  function clearPreview() {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
  }

  // dnd sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const fetchData = async (page = 1) => {
    setLoading(true);
    try {
      const { data } = await api.get(`/categories?page=${page}&sort=position,name`);
      setData(data);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchData(q.page);
  }, [q.page]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting, isValid, isDirty, errors },
  } = useForm<FormVals>({
    mode: "onChange",
    defaultValues: { name: "", is_active: true },
  });

  const disableAll = uiBusy || isSubmitting;

  const onEdit = (c: Category) => {
    setEditing(c);
    reset({ id: c.id, name: c.name, is_active: c.is_active });
    setPreview(c.image_url ?? null);
  };

  const onSubmit = async (v: FormVals) => {
    const form = new FormData();
    form.append("name", v.name);
    form.append("is_active", String(v.is_active ? 1 : 0));
    if (v.image?.[0]) form.append("image", v.image[0]);

    try {
      setUiBusy(true);
      await toast.promise(
        v.id
          ? api.post(`/categories/${v.id}?&_method=PATCH`, form)
          : api.post("/categories", form),
        {
          loading: v.id ? "Записвам промените..." : "Създавам категория...",
          success: v.id ? "Категорията е обновена" : "Категорията е създадена",
          error: "Грешка при запис",
        }
      );

      setEditing(null);
      reset({ name: "", is_active: true });
      clearPreview();
      fetchData(q.page);
    } finally {
      setUiBusy(false);
    }
  };

  const onDelete = async (id: number, name: string) => {
    const ok = await askConfirm({
      title: "Изтриване на категория",
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
      await toast.promise(api.delete(`/categories/${id}`), {
        loading: "Изтривам...",
        success: "Категорията е изтрита",
        error: "Грешка при изтриване",
      });
      fetchData(q.page);
    } finally {
      setUiBusy(false);
    }
  };

  // drag end → reorder + toast.promise
  const onDragEnd = async (e: DragEndEvent) => {
    if (uiBusy) return; // не позволявай паралелни операции
    const { active, over } = e;
    if (!over || active.id === over.id || !data) return;

    const list = [...data.data];
    const oldIndex = list.findIndex((i) => i.id === active.id);
    const newIndex = list.findIndex((i) => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(list, oldIndex, newIndex);

    // optimistic UI
    setData({ ...data, data: reordered });

    try {
      setUiBusy(true);
      await toast.promise(
        api.post("/categories/reorder", { ids: reordered.map((i) => i.id) }),
        {
          loading: "Записвам подредбата…",
          success: "Редът е записан",
          error: "Грешка при запис на реда",
        }
      );
    } finally {
      setUiBusy(false);
    }
  };

  const pages = useMemo(() => {
    const last = data?.meta.last_page ?? 1;
    return Array.from({ length: last }, (_, i) => i + 1);
  }, [data?.meta.last_page]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-semibold">Категории</h2>
      </div>

      {/* форма */}
      <form onSubmit={handleSubmit(onSubmit)} className="border rounded p-4 space-y-3 bg-white">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-1">
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

          <label className="inline-flex items-center gap-2">
            <input type="checkbox" {...register("is_active")} disabled={disableAll} />
            Активна
          </label>

          <div className="flex items-center gap-3">
            <input
              type="file"
              accept="image/*"
              {...register("image")}
              onChange={handleImageChange}
              disabled={disableAll}
            />
            {(preview ?? editing?.image_url) && (
              <div className="relative">
                <img
                  src={(preview ?? editing?.image_url) as string}
                  className="h-12 w-12 object-cover rounded border"
                />
                {preview && (
                  <button
                    type="button"
                    onClick={clearPreview}
                    className={`absolute -top-2 -right-2 bg-white border rounded-full w-6 h-6 ${
                      disableAll ? "opacity-60 cursor-not-allowed" : ""
                    }`}
                    disabled={disableAll}
                    title="Премахни"
                  >
                    ×
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            className={`px-4 py-2 bg-black text-white rounded ${
              !isDirty || !isValid || disableAll ? "opacity-60 cursor-not-allowed" : ""
            }`}
            disabled={!isDirty || !isValid || disableAll}
          >
            {editing ? "Запази" : "Създай"}
          </button>

          {editing && (
            <button
              type="button"
              className={`ml-2 px-3 py-2 bg-gray-200 rounded ${
                disableAll ? "opacity-60 cursor-not-allowed" : ""
              }`}
              disabled={disableAll}
              onClick={() => {
                setEditing(null);
                reset({ name: "", is_active: true });
                clearPreview();
              }}
            >
              Откажи
            </button>
          )}
        </div>
      </form>

      {/* таблица + DnD */}
      <div className="overflow-x-auto rounded-lg border bg-white">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={data?.data.map((i) => i.id) ?? []} strategy={verticalListSortingStrategy}>
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-2 w-8"></th>
                  <th className="p-2 text-left">Име</th>
                  <th className="p-2">Снимка</th>
                  <th className="p-2">Ястия</th>
                  <th className="p-2">Активна</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td className="p-3" colSpan={6}>
                      Зареждане...
                    </td>
                  </tr>
                )}
                {data?.data.map((c) => (
                  <SortableRow
                    key={c.id}
                    c={c}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    disableAll={disableAll}
                  />
                ))}
              </tbody>
            </table>
          </SortableContext>
        </DndContext>
      </div>

      {/* странициране */}
      <div className="flex gap-2">
        {pages.map((p) => (
          <button
            key={p}
            onClick={() => setQ({ page: p })}
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
