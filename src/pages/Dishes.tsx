// src/pages/Dishes.tsx
import { useEffect, useMemo, useState } from "react";
import api from "../lib/api";
import type { Category, Dish, Paginated } from "../lib/types";
import { useForm } from "react-hook-form";
import { toast } from "react-hot-toast";
import { useConfirm } from "../components/ConfirmProvider";
import { bgnToEur, fmtBGN, fmtEUR } from "../lib/money";

type FormVals = {
  id?: number;
  name: string;
  category_id: number;
  description?: string;
  price: number;
  is_active: boolean;
  image?: FileList;
};

export default function Dishes() {
  const [data, setData] = useState<Paginated<Dish> | null>(null);
  const [cats, setCats] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState<{ page: number; category_id?: number; search?: string }>({ page: 1 });
  const [editing, setEditing] = useState<Dish | null>(null);
  const confirm = useConfirm();

  const { register, handleSubmit, reset, watch } = useForm<FormVals>({
    defaultValues: { name: "", price: 0, is_active: true, category_id: 0, description: "" },
  });
  const watchPrice = watch("price");

  async function load(page = 1) {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    if (query.category_id) params.set("category_id", String(query.category_id));
    if (query.search) params.set("search", query.search);
    params.set("sort", "name");

    try {
      const [dRes, cRes] = await Promise.all([
        api.get(`/dishes?${params.toString()}`),
        api.get(`/categories?only_active=1&sort=position,name`),
      ]);
      setData(dRes.data);
      setCats(cRes.data.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(query.page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  };

  const onSubmit = async (v: FormVals) => {
    const form = new FormData();
    form.append("name", v.name);
    form.append("price", String(v.price));
    form.append("category_id", String(v.category_id));
    form.append("description", v.description ?? "");
    form.append("is_active", String(v.is_active ? 1 : 0));
    if (v.image?.[0]) form.append("image", v.image[0]);

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
    clearPreview();
    load(query.page);
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

    await toast.promise(api.delete(`/dishes/${id}`), {
      loading: "Изтривам...",
      success: "Ястието е изтрито",
      error: "Грешка при изтриване",
    });
    load(query.page);
  };

  // image preview
  const [preview, setPreview] = useState<string | null>(null);

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (preview) URL.revokeObjectURL(preview); // чистим стария URL за да няма leak

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

  const pages = useMemo(() => {
    const last = data?.meta.last_page ?? 1;
    return Array.from({ length: last }, (_, i) => i + 1);
  }, [data?.meta.last_page]);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Ястия</h2>

      {/* Филтри */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-sm mb-1">Категория</label>
          <select
            className="border rounded p-2"
            value={query.category_id ?? ""}
            onChange={(e) =>
              setQuery((q) => ({
                ...q,
                page: 1,
                category_id: e.target.value ? Number(e.target.value) : undefined,
              }))
            }
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
          />
        </div>
      </div>

      {/* Форма */}
      <form onSubmit={handleSubmit(onSubmit)} className="border rounded p-4 space-y-3 bg-white overflow-hidden">
        {/* 1 колона на мобилен, 6 на >=sm */}
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-6">
          {/* Име */}
          <input
            placeholder="Име"
            className="border rounded p-2 w-full sm:col-span-2"
            {...register("name")}
          />

          {/* Категория */}
          <select
            className="border rounded p-2 w-full sm:col-span-2"
            {...register("category_id", { valueAsNumber: true })}
          >
            <option value={0}>-- избери категория --</option>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Цена */}
          <div className="flex items-center gap-2 min-w-0 sm:col-span-1">
            <input
              type="number"
              step="0.01"
              placeholder="Цена"
              className="border rounded p-2 w-full"
              {...register("price", { valueAsNumber: true })}
            />
            <span className="text-xs text-gray-500 shrink-0 whitespace-nowrap">
              ≈ {fmtEUR.format(bgnToEur(Number(watchPrice ?? 0)))}
            </span>
          </div>

          {/* Активно */}
          <label className="flex items-center gap-2 sm:col-span-1">
            <input type="checkbox" {...register("is_active")} />
            <span>Активно</span>
          </label>

          {/* Снимка */}
          <div className="sm:col-span-3 min-w-0">
            <label className="block text-sm mb-1">Снимка</label>

            <div className="flex flex-wrap items-center gap-3 min-w-0">
              <input
                type="file"
                accept="image/*"
                {...register("image")}
                onChange={handleImageChange}
                className="shrink-0"
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

            {preview && (
              <button
                type="button"
                onClick={clearPreview}
                className="mt-2 text-xs text-gray-600 underline"
              >
                Премахни избраната снимка
              </button>
            )}
          </div>
        </div>

        {/* Описание */}
        <textarea
          placeholder="Описание"
          className="w-full border rounded p-2"
          rows={3}
          {...register("description")}
        />

        <div className="flex flex-wrap items-center gap-2">
          <button className="px-4 py-2 bg-black text-white rounded">
            {editing ? "Запази" : "Създай"}
          </button>

          {editing && (
            <button
              type="button"
              className="px-3 py-2 bg-gray-200 rounded"
              onClick={() => {
                setEditing(null);
                reset({ name: "", price: 0, is_active: true, category_id: 0, description: "" });
                clearPreview();
              }}
            >
              Откажи
            </button>
          )}
        </div>
      </form>

      {/* Таблица */}
      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
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
                <td className="p-3" colSpan={6}>
                  Зареждане...
                </td>
              </tr>
            )}

            {data?.data.map((d) => (
              <tr key={d.id} className="border-t">
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
                <td className="p-2 text-right">
                  <button className="px-2 py-1 border rounded mr-2" onClick={() => onEdit(d)}>
                    Редакция
                  </button>
                  <button className="px-2 py-1 border rounded" onClick={() => onDelete(d.id, d.name)}>
                    Изтрий
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Странициране */}
      <div className="flex gap-2">
        {pages.map((p) => (
          <button
            key={p}
            onClick={() => setQuery((q) => ({ ...q, page: p }))}
            className={`px-3 py-1 rounded border ${p === data?.meta.current_page ? "bg-black text-white" : ""}`}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}