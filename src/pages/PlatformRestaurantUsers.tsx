import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../lib/api";
import { toast } from "react-hot-toast";

type Row = { id: number; name: string; email: string; role: string };

export default function PlatformRestaurantUsers() {
  const { id } = useParams();
  const [rows, setRows] = useState<Row[]>([]);
  const [form, setForm] = useState({ email: "", password: "", role: "owner", name: "" });
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!id) return;
    setLoading(true);
    const { data } = await api.get(`/platform/restaurants/${id}/users`);
    setRows(data);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  async function attach(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.post(`/platform/restaurants/${id}/users`, {
        email: form.email,
        password: form.password || undefined, // не пращаме празен стринг
        role: form.role,
        name: form.name || undefined,
      });
      toast.success("Потребителят е добавен/закачен.");
      // чистим само паролата, за да не стои в input-а
      setForm((f) => ({ ...f, password: "" }));
      load();
    } catch (err: any) {
      // ще бъде хванато глобално от axios interceptor; тук само дребен fallback
      console.error(err);
    }
  }

  async function detach(userId: number) {
    await api.delete(`/platform/restaurants/${id}/users/${userId}`);
    toast.success("Премахнат потребител.");
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            Потребители за ресторант #{id}
          </h2>
          <p className="text-sm text-gray-500">
            Управлявай достъпа до избрания ресторант.
          </p>
        </div>
        <Link
          to="/admin/platform/restaurants"
          className="rounded-lg border px-3 py-2 hover:bg-gray-50"
        >
          ← Назад
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-medium text-gray-700">Добави/закачи потребител</h3>
          <form onSubmit={attach} className="grid gap-3">
            <div className="grid gap-1.5">
              <label className="text-xs text-gray-500">Име (по желание)</label>
              <input
                className="rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Ivan Petrov"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div className="grid gap-1.5">
              <label className="text-xs text-gray-500">Email</label>
              <input
                type="email"
                required
                className="rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="ivan@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>

            <div className="grid gap-1.5">
              <label className="text-xs text-gray-500">
                Парола <span className="text-gray-400">(задължителна само при нов акаунт)</span>
              </label>
              <input
                type="password"
                className="rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>

            <div className="grid gap-1.5">
              <label className="text-xs text-gray-500">Роля</label>
              <select
                className="rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                <option value="owner">owner</option>
                <option value="manager">manager</option>
                <option value="staff">staff</option>
              </select>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
              >
                Attach
              </button>
            </div>
          </form>

          <p className="mt-3 text-xs text-gray-500">
            Ако въведеният email вече съществува, потребителят ще бъде просто закачен към ресторанта с избраната роля.
            Ако няма акаунт – ще бъде създаден с посочената парола.
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-medium text-gray-700">Бърз съвет</h3>
          <p className="text-sm text-gray-600">
            След като избереш ресторант от списъка с <em>Use</em>, екраните{" "}
            <strong>Категории</strong> и <strong>Ястия</strong> работят в неговия контекст.
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-b p-4 text-sm text-gray-600">
          {loading ? "Зареждане…" : `Потребители: ${rows.length}`}
        </div>
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3 text-right">Действия</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u, i) => (
                <tr key={u.id} className={i % 2 ? "bg-white" : "bg-gray-50/50"}>
                  <td className="px-4 py-3">{u.id}</td>
                  <td className="px-4 py-3">{u.name}</td>
                  <td className="px-4 py-3">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-xs">
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <button
                        onClick={() => detach(u.id)}
                        className="rounded-lg bg-rose-600 px-3 py-1.5 text-white hover:bg-rose-700"
                      >
                        Detach
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!rows.length && !loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    Няма потребители.
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
