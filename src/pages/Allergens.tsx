// src/pages/Allergens.tsx
import { useEffect, useMemo, useState } from "react";
import api from "../lib/api";
import type { Paginated } from "../lib/types";
import { useForm } from "react-hook-form";
import { toast } from "react-hot-toast";

type Allergen = { id:number; code:string; name:string; is_active:boolean };

type FormVals = { id?: number; code: string; name: string; is_active: boolean };

export default function Allergens() {
  const [data, setData] = useState<Paginated<Allergen> | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState<{ page:number; search?:string }>({ page:1 });
  const { register, handleSubmit, reset } = useForm<FormVals>({
    defaultValues: { code:"", name:"", is_active:true }
  });

  async function load(page=1) {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    if (query.search) params.set("search", query.search);
    try {
      const res = await api.get(`/allergens?${params.toString()}`);
      setData(res.data);
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

      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 text-left">Код</th>
              <th className="p-2 text-left">Име</th>
              <th className="p-2 text-center">Активно</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td className="p-3" colSpan={4}>Зареждане...</td></tr>}
            {data?.data?.map((a) => (
              <tr key={a.id} className="border-t">
                <td className="p-2 font-mono">{a.code}</td>
                <td className="p-2">{a.name}</td>
                <td className="p-2 text-center">{a.is_active ? "✓" : "—"}</td>
                <td className="p-2 text-right">
                  <button className="px-2 py-1 border rounded mr-2" onClick={() => onEdit(a)}>Редакция</button>
                  <button className="px-2 py-1 border rounded" onClick={() => onDelete(a)}>Изтрий</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
