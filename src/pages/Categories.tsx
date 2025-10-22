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

// --- Sortable row (transform on inner div, not on <tr>)
function SortableRow({
    c,
    onEdit,
    onDelete,
}: {
    c: Category;
    onEdit: (c: Category) => void;
    onDelete: (id: number, name: string) => void;
}) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: c.id });

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        willChange: 'transform', // за по-гладка анимация
    };

    return (
        <tr ref={setNodeRef} style={style} className="border-t bg-white">
            <td className="p-2 w-8 cursor-grab select-none text-gray-500" {...attributes} {...listeners} title="Влачѝ">
                ⋮⋮
            </td>
            <td className="p-2 text-[16px]">{c.name}</td>
            <td style={{ width: "5rem" }} className="p-2">{c.image_url ? <img className="h-10 w-16 object-cover rounded border" src={c.image_url} /> : "-"}</td>
            <td className="p-2 text-center text-[16px]">{c.dishes_count ?? "-"}</td>
            <td className="p-2 text-center text-[16px]">{c.is_active ? "✓" : "—"}</td>
            <td className="p-2 text-right">
                <button className="px-2 py-1 border rounded mr-2" onClick={() => onEdit(c)}>Редакция</button>
                <button className="px-2 py-1 border rounded" onClick={() => onDelete(c.id, c.name)}>Изтрий</button>
            </td>
        </tr>
    );
}


export default function Categories() {
    const [q, setQ] = useState({ page: 1 });
    const [data, setData] = useState<Paginated<Category> | null>(null);
    const [loading, setLoading] = useState(false);
    const [editing, setEditing] = useState<Category | null>(null);
    const askConfirm = useConfirm();

    // image preview
    const [preview, setPreview] = useState<string | null>(null);
    function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) { setPreview(null); return; }
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
        try {
            setLoading(true);
            const { data } = await api.get(`/categories?page=${page}&sort=position,name`);
            setData(data);
        } finally {
            setLoading(false);
        }
    };
    useEffect(() => { fetchData(q.page); }, [q.page]);

    const { register, handleSubmit, reset } = useForm<FormVals>({
        defaultValues: { name: "", is_active: true },
    });

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

        if (v.id) {
            await api.post(`/categories/${v.id}?_method=PATCH`, form);
            toast.success("Категорията е обновена");
        } else {
            await api.post("/categories", form);
            toast.success("Категорията е създадена");
        }

        setEditing(null);
        reset({ name: "", is_active: true });
        clearPreview();
        fetchData(q.page);
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

        await toast.promise(
            api.delete(`/categories/${id}`),
            { loading: "Изтривам...", success: "Категорията е изтрита", error: "Грешка при изтриване" }
        );
        fetchData(q.page);
    };

    // drag end → reorder + toast.promise
    const onDragEnd = async (e: DragEndEvent) => {
        const { active, over } = e;
        if (!over || active.id === over.id || !data) return;

        const list = [...data.data];
        const oldIndex = list.findIndex(i => i.id === active.id);
        const newIndex = list.findIndex(i => i.id === over.id);
        const reordered = arrayMove(list, oldIndex, newIndex);

        // optimistic UI
        setData({ ...data, data: reordered });

        await toast.promise(
            api.post("/categories/reorder", { ids: reordered.map(i => i.id) }),
            {
                loading: "Записвам подредбата…",
                success: "Редът е записан",
                error: "Грешка при запис на реда",
            }
        );
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
                    <input placeholder="Име" className="border rounded p-2" {...register("name")} />
                    <label className="inline-flex items-center gap-2">
                        <input type="checkbox" {...register("is_active")} />
                        Активна
                    </label>

                    <div className="flex items-center gap-3">
                        <input type="file" accept="image/*" {...register("image")} onChange={handleImageChange} />
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
                                        className="absolute -top-2 -right-2 bg-white border rounded-full w-6 h-6"
                                        title="Премахни"
                                    >
                                        ×
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
                <button className="px-4 py-2 bg-black text-white rounded">
                    {editing ? "Запази" : "Създай"}
                </button>
                {editing && (
                    <button
                        type="button"
                        className="ml-2 px-3 py-2 bg-gray-200 rounded"
                        onClick={() => {
                            setEditing(null);
                            reset({ name: "", is_active: true });
                            clearPreview();
                        }}
                    >
                        Откажи
                    </button>
                )}
            </form>

            {/* таблица + DnD (transform on inner div) */}
            <div className="overflow-x-auto rounded-lg border bg-white border rounded">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                    <SortableContext items={data?.data.map(i => i.id) ?? []} strategy={verticalListSortingStrategy}>
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
                                    <SortableRow key={c.id} c={c} onEdit={onEdit} onDelete={onDelete} />
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
                        className={`px-3 py-1 rounded border ${p === data?.meta.current_page ? "bg-black text-white" : ""}`}
                    >
                        {p}
                    </button>
                ))}
            </div>
        </div>
    );
}
