// src/pages/Allergens.tsx
import { useEffect, useMemo, useState } from "react";
import api from "../lib/api";
import type { Paginated } from "../lib/types";
import { useForm } from "react-hook-form";
import { toast } from "react-hot-toast";

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

type Allergen = { id:number; code:string; name:string; is_active:boolean };
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
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: a.id });
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
      <td className="p-2 font-mono">{a.code}</td>
      <td className="p-2">{a.name}</td>
      <td className="p-2 text-center">{a.is_active ? "✓" : "—"}</td>
      <td className="p-2 text-right">
        <button
          className={`px-2 py-1 border rounded mr-2 ${disableAll ? "opacity-60 cursor-not-allowed" : ""}`}
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
      </td>
    </tr>
  );
}

export default function Allergens() {
  const [data, setData] = useState<Paginated<Allergen> | null>(null);
  const [rows, setRows] = useState<Allergen[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState<{ page:number; search?:string }>({ page:1 });
  const [uiBusy, setUiBusy] = useState(false); // глобален lock

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty, isValid },
  } = useForm<FormVals>({
    mode: "onChange",
    defaultValues: { code:"", name:"", is_active:true },
  });

  const disableAll = uiBusy || isSubmitting;

  // dnd sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  async function load(page=1) {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    if (query.search) params.set("search", query.search);
    params.set("sort", "position,name");
    try {
      const res = await api.get(`/allergens?${params.toString()}`);
      setData(res.data);
      setRows(res.data?.data ?? []);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(query.page); /* eslint-disable-next-line */ }, [query.page, query.search]);

  const onSubmit = async (v: FormVals) => {
    try {
      setUiBusy(true);
      await toast.promise(
        v.id ? api.patch(`/allergens/${v.id}`, v) : api.post(`/allergens`, v),
        { loading: v.id ? "Запис..." : "Създавам...", success: "Готово", error: "Грешка" }
      );
      reset({ code:"", name:"", is_active:true });
      load(query.page);
    } finally {
      setUiBusy(false);
    }
  };

  const onEdit = (a: Allergen) => reset({ id:a.id, code:a.code, name:a.name, is_active:a.is_active });

  const onDelete = async (a: Allergen) => {
    try {
      setUiBusy(true);
      await toast.promise(api.delete(`/allergens/${a.id}`), { loading:"Триене...", success:"Изтрито", error:"Грешка" });
      load(query.page);
    } finally {
      setUiBusy(false);
    }
  };

  // Drag end -> оптимистично пренареждане + запис към API
  const onDragEnd = async (e: DragEndEvent) => {
    if (disableAll) return;
    const { active, over } = e;
    if (!over || active.id === over.id) return;

    const list = [...rows];
    const oldIndex = list.findIndex(i => i.id === active.id);
    const newIndex = list.findIndex(i => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(list, oldIndex, newIndex);
    setRows(reordered); // optimistic UI

    try {
      setUiBusy(true);
      await toast.promise(
        api.post("/allergens/reorder", { ids: reordered.map(i => i.id) }),
        { loading: "Записвам подредбата…", success: "Редът е записан", error: "Грешка при запис на реда" }
      );
    } finally {
      setUiBusy(false);
    }
  };

  const pages = useMemo(() => {
    const last = data?.meta?.last_page ?? 1; return Array.from({length:last}, (_,i)=>i+1);
  }, [data?.meta?.last_page]);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Алергени</h2>

      <form onSubmit={handleSubmit(onSubmit)} className="border rounded p-4 space-y-3 bg-white">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <input
              placeholder="Код (A1)"
              className={`border rounded p-2 w-full ${errors.code ? "border-red-500" : ""}`}
              disabled={disableAll}
              {...register("code", {
                required: "Кодът е задължителен",
                validate: v => v.trim().length > 0 || "Кодът е задължителен",
              })}
            />
            {errors.code && <p className="text-sm text-red-600">{errors.code.message}</p>}
          </div>

          <div className="sm:col-span-2">
            <input
              placeholder="Име"
              className={`border rounded p-2 w-full ${errors.name ? "border-red-500" : ""}`}
              disabled={disableAll}
              {...register("name", {
                required: "Името е задължително",
                validate: v => v.trim().length > 0 || "Името е задължително",
              })}
            />
            {errors.name && <p className="text-sm text-red-600">{errors.name.message}</p>}
          </div>

          <label className="inline-flex items-center gap-2">
            <input type="checkbox" disabled={disableAll} {...register("is_active")} /> Активно
          </label>
        </div>

        <button
          className={`px-4 py-2 bg-black text-white rounded ${
            !isDirty || !isValid || disableAll ? "opacity-60 cursor-not-allowed" : ""
          }`}
          disabled={!isDirty || !isValid || disableAll}
        >
          Запази
        </button>
      </form>

      {/* Таблица + DnD */}
      <div className="overflow-x-auto rounded-lg border bg-white">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={rows.map(i => i.id)} strategy={verticalListSortingStrategy}>
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-2 w-8"></th>
                  <th className="p-2 text-left">Код</th>
                  <th className="p-2 text-left">Име</th>
                  <th className="p-2 text-center">Активно</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td className="p-3" colSpan={5}>Зареждане...</td></tr>}
                {rows.map(a => (
                  <SortableRow key={a.id} a={a} onEdit={onEdit} onDelete={onDelete} disableAll={disableAll} />
                ))}
              </tbody>
            </table>
          </SortableContext>
        </DndContext>
      </div>

      <div className="flex gap-2">
        {pages.map(p => (
          <button
            key={p}
            onClick={()=>setQuery(q=>({...q, page:p}))}
            disabled={disableAll || loading}
            className={`px-3 py-1 rounded border ${
              disableAll || loading ? "opacity-60 cursor-not-allowed" : ""
            } ${p===data?.meta?.current_page ? "bg-black text-white":""}`}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}
