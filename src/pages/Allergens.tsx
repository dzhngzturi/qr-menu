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

// --- Sortable row (дръжка „⋮⋮“)
function SortableRow({
  a,
  onEdit,
  onDelete,
}: {
  a: Allergen;
  onEdit: (a: Allergen) => void;
  onDelete: (a: Allergen) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: a.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    willChange: "transform",
  };

  return (
    <tr ref={setNodeRef} style={style} className="border-t bg-white">
      <td className="p-2 w-8 cursor-grab select-none text-gray-500" title="Влачѝ" {...attributes} {...listeners}>
        ⋮⋮
      </td>
      <td className="p-2 font-mono">{a.code}</td>
      <td className="p-2">{a.name}</td>
      <td className="p-2 text-center">{a.is_active ? "✓" : "—"}</td>
      <td className="p-2 text-right">
        <button className="px-2 py-1 border rounded mr-2" onClick={() => onEdit(a)}>Редакция</button>
        <button className="px-2 py-1 border rounded" onClick={() => onDelete(a)}>Изтрий</button>
      </td>
    </tr>
  );
}

export default function Allergens() {
  const [data, setData] = useState<Paginated<Allergen> | null>(null);
  const [rows, setRows] = useState<Allergen[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState<{ page:number; search?:string }>({ page:1 });

  const { register, handleSubmit, reset } = useForm<FormVals>({
    defaultValues: { code:"", name:"", is_active:true }
  });

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
    params.set("sort", "position,name"); // важно: първо по position
    try {
      const res = await api.get(`/allergens?${params.toString()}`);
      setData(res.data);
      setRows(res.data?.data ?? []);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(query.page); /* eslint-disable-next-line */ }, [query.page, query.search]);

  const onSubmit = async (v: FormVals) => {
    await toast.promise(
      v.id ? api.patch(`/allergens/${v.id}`, v) : api.post(`/allergens`, v),
      { loading: v.id ? "Запис..." : "Създавам...", success: "Готово", error: "Грешка" }
    );
    reset({ code:"", name:"", is_active:true });
    load(query.page);
  };

  const onEdit = (a: Allergen) => reset({ id:a.id, code:a.code, name:a.name, is_active:a.is_active });
  const onDelete = async (a: Allergen) => {
    await toast.promise(api.delete(`/allergens/${a.id}`), { loading:"Триене...", success:"Изтрито", error:"Грешка" });
    load(query.page);
  };

  // Drag end -> оптимистично пренареждане + запис към API
  const onDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;

    const list = [...rows];
    const oldIndex = list.findIndex(i => i.id === active.id);
    const newIndex = list.findIndex(i => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(list, oldIndex, newIndex);
    setRows(reordered); // optimistic UI

    await toast.promise(
      api.post("/allergens/reorder", { ids: reordered.map(i => i.id) }),
      { loading: "Записвам подредбата…", success: "Редът е записан", error: "Грешка при запис на реда" }
    );
  };

  const pages = useMemo(() => {
    const last = data?.meta?.last_page ?? 1; return Array.from({length:last}, (_,i)=>i+1);
  }, [data?.meta?.last_page]);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Алергени</h2>

      <form onSubmit={handleSubmit(onSubmit)} className="border rounded p-4 space-y-3 bg-white">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input placeholder="Код (A1)" className="border rounded p-2" {...register("code")} />
          <input placeholder="Име" className="border rounded p-2 sm:col-span-2" {...register("name")} />
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" {...register("is_active")} /> Активно
          </label>
        </div>
        <button className="px-4 py-2 bg-black text-white rounded">Запази</button>
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
                  <SortableRow key={a.id} a={a} onEdit={onEdit} onDelete={onDelete} />
                ))}
              </tbody>
            </table>
          </SortableContext>
        </DndContext>
      </div>

      <div className="flex gap-2">
        {pages.map(p => (
          <button key={p} onClick={()=>setQuery(q=>({...q, page:p}))}
            className={`px-3 py-1 rounded border ${p===data?.meta?.current_page ? "bg-black text-white":""}`}>
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}
