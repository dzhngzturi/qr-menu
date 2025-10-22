// src/pages/PlatformRestaurants.tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";
import { toast } from "react-hot-toast";

type Row = { id: number; name: string; slug: string };

export default function PlatformRestaurants() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", slug: "" });

  async function load() {
    setLoading(true);
    const { data } = await api.get("/platform/restaurants", { params: { paginate: false } });
    setRows(data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function create() {
    if (!form.name || !form.slug) return;
    await api.post("/platform/restaurants", form);
    toast.success("Създаден ресторант");
    setForm({ name: "", slug: "" });
    load();
  }

  async function destroy(id: number) {
    if (!confirm("Изтриване?")) return;
    await api.delete(`/platform/restaurants/${id}`);
    toast.success("Изтрит ресторант");
    load();
  }

  function useRestaurant(slug: string) {
    localStorage.setItem("restaurant", slug);
    toast.success(`Избран ресторант: ${slug}`);
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold tracking-tight">Ресторанти</h2>

      {/* Create form */}
      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            create();
          }}
          className="grid grid-cols-1 gap-3 sm:grid-cols-3"
        >
          <input
            placeholder="Name"
            className="w-full rounded-lg border px-3 py-2"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            placeholder="Slug"
            className="w-full rounded-lg border px-3 py-2"
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
          />
          <button
            type="submit"
            className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 sm:w-auto"
          >
            Create
          </button>
        </form>
      </div>

      {/* Header / counter */}
      <div className="rounded-2xl border bg-white shadow-sm">
        <div className="border-b p-4 text-sm text-gray-600">
          {loading ? "Зареждане…" : `Намерени: ${rows.length}`}
        </div>

        {/* Mobile list (cards) */}
        <ul className="md:hidden divide-y">
          {rows.length === 0 && !loading && (
            <li className="p-6 text-center text-sm text-gray-500">Няма данни.</li>
          )}
          {rows.map((r) => (
            <li key={r.id} className="p-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-medium truncate">{r.name}</div>
                  <div className="text-xs text-neutral-500">
                    ID: {r.id} • slug:{" "}
                    <span className="font-mono rounded bg-neutral-100 px-1">{r.slug}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:ml-auto shrink-0 whitespace-nowrap">
                  <Link
                    to={`/admin/platform/restaurants/${r.id}/users`}
                    className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50"
                  >
                    Users
                  </Link>
                  <button
                    onClick={() => useRestaurant(r.slug)}
                    className="rounded bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-700"
                  >
                    Use
                  </button>
                  <button
                    onClick={() => destroy(r.id)}
                    className="rounded bg-rose-600 px-3 py-1.5 text-sm text-white hover:bg-rose-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full table-auto text-left text-sm">
            <colgroup>
              <col className="w-20" />
              <col />
              <col className="w-64" />
              <col className="w-56" />
            </colgroup>
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Slug</th>
                <th className="px-4 py-3 text-right">Действия</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className={i % 2 ? "bg-white" : "bg-gray-50/50"}>
                  <td className="px-4 py-3">{r.id}</td>
                  <td className="px-4 py-3">{r.name}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{r.slug}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        to={`/admin/platform/restaurants/${r.id}/users`}
                        className="rounded border px-3 py-1.5 hover:bg-gray-50"
                      >
                        Users
                      </Link>
                      <button
                        onClick={() => useRestaurant(r.slug)}
                        className="rounded bg-emerald-600 px-3 py-1.5 text-white hover:bg-emerald-700"
                      >
                        Use
                      </button>
                      <button
                        onClick={() => destroy(r.id)}
                        className="rounded bg-rose-600 px-3 py-1.5 text-white hover:bg-rose-700"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {!rows.length && !loading && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                    Няма данни.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
