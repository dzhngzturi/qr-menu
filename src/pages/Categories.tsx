import { useMemo, useState } from "react";
import type { Category } from "../lib/types";
import toast from "react-hot-toast";
import { useConfirm } from "../components/ConfirmProvider";
import { useT } from "../i18n/useT";
import { useParams } from "react-router-dom";

import { deleteCategory, reorderCategories } from "../services/categories";

import { normalizeTranslationsToMap } from "./categories/categoryI18n";
import CategoryForm from "./categories/CategoryForm";

import { useCategoriesPage } from "./categories/hooks/useCategoriesPage";
import { useCategoryLangs } from "./categories/hooks/useCategoryLangs";

import Pagination from "../components/Pagination";

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
import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { restrictToVerticalAxis, restrictToFirstScrollableAncestor } from "@dnd-kit/modifiers";

import { SortableCategoryRow } from "./categories/SortableCategoryRow";

export default function Categories() {
  const { msg } = useT();
  const askConfirm = useConfirm();
  const { slug } = useParams<{ slug: string }>();

  // list/pagination vm
  const vm = useCategoriesPage();

  // langs/i18n vm
  const i18n = useCategoryLangs(slug);

  const [editing, setEditing] = useState<Category | null>(null);
  const [uiBusy, setUiBusy] = useState(false);

  // ✅ NEW: search (като Dishes)
  const [search, setSearch] = useState("");

  const disableAll = uiBusy;

  // ✅ DnD should be disabled while searching (prevents incorrect reorder)
  const dndEnabled = !disableAll && !search.trim();

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 160, tolerance: 6 } }),
    useSensor(KeyboardSensor)
  );

  const activeListLang = useMemo(() => {
    const cur = String(i18n.activeLang || "").toLowerCase();
    return i18n.list.includes(cur) ? cur : i18n.defLang;
  }, [i18n.activeLang, i18n.list, i18n.defLang]);

  const getDisplayName = (c: Category, lang: string) => {
    const map = normalizeTranslationsToMap((c as any).translations);
    const tName = map?.[lang]?.name?.trim();
    if (tName) return tName;
    return (c.name ?? "").toString();
  };

  // ✅ NEW: filtered list (search by translated name OR legacy name OR slug)
  const filteredData = useMemo(() => {
    const q = String(search || "").toLowerCase().trim();
    const list = vm.data?.data ?? [];
    if (!q) return list;

    return list.filter((c) => {
      const name = String(getDisplayName(c, activeListLang) || "").toLowerCase();
      const legacy = String(c.name || "").toLowerCase();
      const slug = String((c as any).slug || "").toLowerCase();
      return name.includes(q) || legacy.includes(q) || slug.includes(q);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vm.data?.data, search, activeListLang]);

  const onDelete = async (id: number, name: string) => {
    const ok = await askConfirm({
      title: msg("admin.categories.delete_title"),
      message: (
        <>
          {msg("admin.categories.delete_confirm_prefix")} <b>{name}</b>?<br />
          {msg("admin.categories.delete_confirm_suffix")}
        </>
      ),
      confirmText: msg("admin.common.delete"),
      cancelText: msg("admin.common.cancel"),
      danger: true,
    });
    if (!ok) return;

    try {
      setUiBusy(true);
      await toast.promise(deleteCategory(id), {
        loading: msg("admin.categories.deleting"),
        success: msg("admin.categories.deleted"),
        error: msg("admin.categories.delete_error"),
      });
      vm.fetchData(vm.page);
    } finally {
      setUiBusy(false);
    }
  };

  const onDragEnd = async (e: DragEndEvent) => {
    // ✅ do not reorder while searching
    if (!dndEnabled) return;

    const { active, over } = e;
    if (!over || active.id === over.id || !vm.data) return;

    const listData = [...vm.data.data];
    const oldIndex = listData.findIndex((i) => i.id === active.id);
    const newIndex = listData.findIndex((i) => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(listData, oldIndex, newIndex);
    vm.setData({ ...vm.data, data: reordered });

    try {
      setUiBusy(true);
      await toast.promise(reorderCategories(reordered.map((i) => i.id)), {
        loading: msg("admin.categories.saving_order"),
        success: msg("admin.categories.order_saved"),
        error: msg("admin.categories.order_save_error"),
      });
    } finally {
      setUiBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* TITLE + SEARCH (като Dishes: иконата е в label-а) */}
      <div className="space-y-3">
        <h2 className="text-xl font-semibold">{msg("admin.categories.title")}</h2>

        <div className="max-w-sm">
          <label className="mb-1 flex items-center gap-2 text-sm font-medium text-gray-700">
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
              <path
                fill="currentColor"
                d="M10 2a8 8 0 1 0 4.9 14.3l4.4 4.4 1.4-1.4-4.4-4.4A8 8 0 0 0 10 2Zm0 2a6 6 0 1 1 0 12a6 6 0 0 1 0-12Z"
              />
            </svg>
            {msg("admin.allergens.search", { defaultValue: "Търсене" })}
          </label>

          <input
            className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-black/10"
            placeholder={msg("admin.categories.name_placeholder", { defaultValue: "Име" })}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            disabled={disableAll}
          />

          {!dndEnabled && (
            <div className="mt-2 text-xs text-gray-500">
              Изчисти търсенето, за да пренареждаш категориите.
            </div>
          )}
        </div>
      </div>

      {/* FORM */}
      <CategoryForm
        list={i18n.list}
        defLang={i18n.defLang}
        activeLang={i18n.activeLang}
        setActiveLang={(v) => {
          const next = typeof v === "function" ? v(i18n.activeLang ?? i18n.defLang) : v;
          i18n.setActiveLang(next);
        }}
        nameByLang={i18n.nameByLang}
        setNameByLang={i18n.setNameByLang}
        editing={editing}
        setEditing={setEditing}
        uiBusy={uiBusy}
        setUiBusy={setUiBusy}
        onSaved={() => vm.fetchData(vm.page)}
      />

      {/* MOBILE LIST */}
      <div className="md:hidden space-y-3">
        {vm.loading && <div className="text-sm text-gray-500">{msg("admin.common.loading")}</div>}

        {filteredData.map((c) => {
          const displayName = getDisplayName(c, activeListLang);
          return (
            <div key={c.id} className="rounded-xl border bg-white p-3 shadow-sm">
              <div className="flex items-start gap-3">
                {c.image_url ? (
                  <img
                    className="h-14 w-20 object-cover rounded-lg border"
                    src={c.image_url}
                    alt={displayName}
                  />
                ) : (
                  <div className="h-14 w-20 rounded-lg border bg-gray-50" />
                )}

                <div className="flex-1">
                  <div className="font-semibold">{displayName}</div>
                  <div className="mt-1 text-xs text-gray-500">
                    {msg("admin.categories.th_dishes")}: {c.dishes_count ?? "-"} •{" "}
                    {msg("admin.categories.th_active")}: {c.is_active ? "✓" : "—"}
                  </div>

                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      className={[
                        "px-3 py-1.5 border rounded-lg",
                        disableAll ? "opacity-60 cursor-not-allowed" : "",
                      ].join(" ")}
                      disabled={disableAll}
                      onClick={() => setEditing(c)}
                    >
                      {msg("admin.common.edit")}
                    </button>

                    <button
                      type="button"
                      className={[
                        "px-3 py-1.5 border rounded-lg",
                        disableAll ? "opacity-60 cursor-not-allowed" : "",
                      ].join(" ")}
                      disabled={disableAll}
                      onClick={() => onDelete(c.id, displayName)}
                    >
                      {msg("admin.common.delete")}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* DESKTOP TABLE + DnD */}
      <div className="hidden md:block overflow-x-auto rounded-xl border bg-white shadow-sm">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
          modifiers={[restrictToVerticalAxis, restrictToFirstScrollableAncestor]}
        >
          <SortableContext items={filteredData.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-2 w-12"></th>
                  <th className="p-2 text-left">{msg("admin.categories.th_name")}</th>
                  <th className="p-2">{msg("admin.categories.th_photo")}</th>
                  <th className="p-2">{msg("admin.categories.th_dishes")}</th>
                  <th className="p-2">{msg("admin.categories.th_active")}</th>
                  <th className="p-2"></th>
                </tr>
              </thead>

              <tbody>
                {vm.loading && (
                  <tr>
                    <td className="p-3" colSpan={6}>
                      {msg("admin.common.loading")}
                    </td>
                  </tr>
                )}

                {filteredData.map((c) => {
                  const displayName = getDisplayName(c, activeListLang);
                  return (
                    <SortableCategoryRow
                      key={c.id}
                      c={c}
                      onEdit={() => {
                        setEditing(c);
                        document.getElementById("category-form")?.scrollIntoView({
                          behavior: "smooth",
                          block: "start",
                        });
                      }}
                      onDelete={() => onDelete(c.id, displayName)}
                      disableAll={disableAll}
                      msg={msg}
                      displayName={displayName}
                      activeId={editing?.id ?? null}
                    />
                  );
                })}
              </tbody>
            </table>
          </SortableContext>
        </DndContext>
      </div>

      {/* Pagination */}
      <Pagination
        totalPages={vm.totalPages}
        currentPage={vm.page}
        loading={vm.loading}
        disableAll={disableAll}
        onPick={(p) => vm.setPage(p)}
      />
    </div>
  );
}
