// src/pages/dishes/hooks/useDishesPage.ts
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { toast } from "react-hot-toast";

import type { Category, Dish, Paginated, Allergen } from "../../../lib/types";
import { useConfirm } from "../../../components/ConfirmProvider";

import { fetchCategories } from "../../../services/categories";
import {
  createDish,
  deleteDish,
  fetchDishes,
  reorderDishes,
  updateDish,
  type DishTranslationInput,
} from "../../../services/dishes";

import { fetchAllergens } from "../../../services/allergens";

import { buildTranslationsArray, normalizeTranslationsToMap } from "../dishI18n";
import { bytesToSize, getSlugFromPath } from "../dishUtils";

// ✅ use langs service
import { fetchRestaurantLangs as fetchRestaurantLangsApi } from "../../../services/restaurantI18n";

// ✅ DnD-kit
import type { DragEndEvent } from "@dnd-kit/core";
import { KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";

export type DishFormVals = {
  id?: number;
  category_id: number;
  price: number;
  is_active: boolean;

  // ✅ portion
  portion_value?: number | null;
  portion_unit?: "g" | "ml" | "";

  // ✅ allergens (dropdown multiple)
  allergen_ids: number[];

  image?: FileList;
};

export type DishQuery = { page: number; category_id?: number; search?: string };

// ViewModel type
export type UseDishesPageVM = ReturnType<typeof useDishesPage>;

function norm(x: any) {
  return String(x || "").toLowerCase().trim();
}

export function useDishesPage() {
  const { t } = useTranslation();
  const params = useParams();
  const confirm = useConfirm();

  const restaurantSlug =
    (params as any)?.restaurantSlug ||
    (params as any)?.slug ||
    (params as any)?.restaurant ||
    getSlugFromPath() ||
    localStorage.getItem("restaurant_slug") ||
    localStorage.getItem("restaurant") ||
    "";

  const [data, setData] = useState<Paginated<Dish> | null>(null);
  const [cats, setCats] = useState<Category[]>([]);
  const [rows, setRows] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(false);
  const [uiBusy, setUiBusy] = useState(false);

  const [query, setQuery] = useState<DishQuery>({ page: 1 });
  const [editing, setEditing] = useState<Dish | null>(null);

  // ✅ allergens list
  const [allergens, setAllergens] = useState<Allergen[]>([]);

  // langs from backend
  const [langs, setLangs] = useState<string[]>([]);
  const [defaultLang, setDefaultLang] = useState<string>("bg");

  // translations UI state
  const [activeLang, setActiveLang] = useState<string>("bg");
  const [nameByLang, setNameByLang] = useState<Record<string, string>>({ bg: "" });
  const [descByLang, setDescByLang] = useState<Record<string, string>>({ bg: "" });

  // Image preview / remove
  const [preview, setPreview] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    resetField,
    setValue,
    formState: { isSubmitting, errors, isValid },
  } = useForm<DishFormVals>({
    mode: "onChange",
    defaultValues: {
      price: 0,
      is_active: true,
      category_id: 0,

      portion_value: null,
      portion_unit: "",

      // ✅ important: multiple dropdown expects array
      allergen_ids: [],
    },
  });

  const imageRegister = register("image");
  const disableAll = uiBusy || isSubmitting;

  // ✅ DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // ---------- fetch restaurant langs ----------
  async function loadRestaurantLangs(slug: string) {
    try {
      const res = await fetchRestaurantLangsApi(slug);

      const incoming = (res?.langs ?? []).map(norm).filter(Boolean);
      const safeLangs = incoming.length ? incoming : ["bg"];

      const def = norm(res?.default_lang || safeLangs[0] || "bg");
      const safeDef = safeLangs.includes(def) ? def : safeLangs[0];

      // ✅ default first
      const ordered = [safeDef, ...safeLangs.filter((l) => l !== safeDef)];

      setLangs(ordered);
      setDefaultLang(safeDef);

      // ✅ always start on default
      setActiveLang(safeDef);

      // ensure keys exist + remove stale keys
      setNameByLang((prev) => {
        const next: Record<string, string> = { ...prev };
        ordered.forEach((l) => (next[l] = next[l] ?? ""));
        Object.keys(next).forEach((k) => {
          if (!ordered.includes(k)) delete next[k];
        });
        return next;
      });

      setDescByLang((prev) => {
        const next: Record<string, string> = { ...prev };
        ordered.forEach((l) => (next[l] = next[l] ?? ""));
        Object.keys(next).forEach((k) => {
          if (!ordered.includes(k)) delete next[k];
        });
        return next;
      });
    } catch {
      // fallback
      const safeList = ["bg"];
      setLangs(safeList);
      setDefaultLang("bg");
      setActiveLang("bg");
      setNameByLang((p) => ({ bg: p.bg ?? "" }));
      setDescByLang((p) => ({ bg: p.bg ?? "" }));
    }
  }

  useEffect(() => {
    if (!restaurantSlug) return;
    loadRestaurantLangs(String(restaurantSlug));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantSlug]);

  // ---------- load page data ----------
  async function load(page = 1) {
    setLoading(true);
    try {
      const [dRes, cRes, aRes] = await Promise.all([
        fetchDishes({
          page,
          sort: "position,name",
          category_id: query.category_id,
          search: query.search,
        }),
        fetchCategories({ only_active: 1, sort: "position,name", per_page: -1 }),
        fetchAllergens({ per_page: -1, only_active: 1, sort: "position,code" } as any),
      ]);

      setData(dRes);
      setCats(cRes.data ?? []);
      setRows(dRes.data ?? []);
      setAllergens(aRes.data ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(query.page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.page, query.category_id, query.search]);

  // ---------- image helpers ----------
  function applyImageFile(file: File | null) {
    setRemoveImage(false);
    if (preview) URL.revokeObjectURL(preview);

    if (!file) {
      setPreview(null);
      return;
    }
    setPreview(URL.createObjectURL(file));
  }

  function clearPreview(markToRemove: boolean) {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
    resetField("image");
    setRemoveImage(markToRemove);
  }

  function fileToFileList(file: File): FileList {
    if (typeof DataTransfer !== "undefined") {
      const dt = new DataTransfer();
      dt.items.add(file);
      return dt.files;
    }
    return {
      0: file,
      length: 1,
      item: (i: number) => (i === 0 ? file : null),
    } as any;
  }

  function onBrowse() {
    imageInputRef.current?.click();
  }

  function onDropFile(file: File) {
    applyImageFile(file);

    const files = fileToFileList(file);
    setValue("image", files as any, { shouldDirty: true, shouldValidate: true });
    if (imageInputRef.current) imageInputRef.current.files = files;
  }

  // ---------- i18n helpers ----------
  const langsList = useMemo(() => {
    const base = langs.length ? langs : [defaultLang || "bg"];
    return base.map(norm).filter(Boolean);
  }, [langs, defaultLang]);

  const defLang = useMemo(() => norm(defaultLang || langsList[0] || "bg"), [defaultLang, langsList]);

  const active = langsList.includes(norm(activeLang)) ? norm(activeLang) : defLang;
  const activeLabel = active.toUpperCase();
  const list = langsList;

  // rerender so memo options recompute with current `active`
  useEffect(() => {
    setQuery((q) => ({ ...q }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  function getDisplayName(d: Dish, lang: string) {
    const map = normalizeTranslationsToMap((d as any).translations);
    const tName = map?.[lang]?.name?.trim();
    if (tName) return tName;
    return (d.name ?? "").toString();
  }

  function getCategoryLabel(c: Category, lang: string) {
    const map = normalizeTranslationsToMap((c as any).translations);
    const tName = map?.[lang]?.name?.trim();
    return tName || (c.name ?? "").toString();
  }

  const activeName = (nameByLang[active] ?? "").trim();
  const fallbackName = ((nameByLang[defLang] ?? "").trim() || (editing?.name ?? "").toString()).trim();
  const fallbackDesc = ((descByLang[defLang] ?? "").trim() || (editing?.description ?? "").toString()).trim();
  const nameMissing = active !== defLang && !activeName;

  const tMissingTitle = t("admin.dishes.missing_translation_title", {
    defaultValue: "Missing translation for {{lang}}",
    lang: activeLabel,
  });
  const tFallbackLabel = t("admin.dishes.fallback_label", {
    defaultValue: "Fallback ({{lang}}):",
    lang: defLang.toUpperCase(),
  });
  const tDescFallbackLabel = t("admin.dishes.desc_fallback_label", {
    defaultValue: "Desc fallback:",
  });
  const tUseFallback = t("admin.dishes.use_fallback", { defaultValue: "Use fallback" });
  const tCopyFallbackTitle = t("admin.dishes.copy_fallback_title", {
    defaultValue: "Copy fallback into this language",
  });

  function onUseFallback() {
    setNameByLang((p) => ({ ...p, [active]: fallbackName }));
    if (!(descByLang[active] ?? "").trim() && fallbackDesc) {
      setDescByLang((p) => ({ ...p, [active]: fallbackDesc }));
    }
  }

  // auto-copy fallback when editing + switching non-default
  useEffect(() => {
    if (!editing) return;
    if (active === defLang) return;

    const curName = (nameByLang[active] ?? "").trim();
    const curDesc = (descByLang[active] ?? "").trim();

    if (!curName && fallbackName) {
      setNameByLang((p) => ({ ...p, [active]: fallbackName }));
    }
    if (!curDesc && fallbackDesc) {
      setDescByLang((p) => ({ ...p, [active]: fallbackDesc }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?.id, active, defLang]);

  // ---------- edit/reset ----------
  function onEdit(d: Dish) {
    setEditing(d);

    reset({
      id: d.id,
      category_id: d.category?.id ?? 0,
      price: d.price,
      is_active: d.is_active,

      portion_value: d.portion_value ?? null,
      portion_unit: (d.portion_unit as any) ?? "",

      // ✅ take from dish.allergens
      allergen_ids: (d.allergens ?? []).map((a) => a.id),
    });

    const map = normalizeTranslationsToMap((d as any).translations);
    const nextNames: Record<string, string> = {};
    const nextDescs: Record<string, string> = {};

    for (const l of langsList) {
      nextNames[l] = map?.[l]?.name ?? "";
      nextDescs[l] = map?.[l]?.description ?? "";
    }

    // legacy => default language
    if (!nextNames[defLang]) nextNames[defLang] = (d.name ?? "").toString();
    if (!nextDescs[defLang]) nextDescs[defLang] = (d.description ?? "").toString();

    setNameByLang((prev) => ({ ...prev, ...nextNames }));
    setDescByLang((prev) => ({ ...prev, ...nextDescs }));

    // always default tab when editing
    setActiveLang(defLang);

    setPreview(d.image_url ?? null);
    setRemoveImage(false);
    setDragOver(false);

    if (imageInputRef.current) imageInputRef.current.value = "";
    resetField("image");
  }

  function resetAll() {
    setEditing(null);
    reset({
      price: 0,
      is_active: true,
      category_id: 0,
      portion_value: null,
      portion_unit: "",
      allergen_ids: [],
    });

    setActiveLang(defLang);
    setNameByLang({ [defLang]: "" });
    setDescByLang({ [defLang]: "" });

    clearPreview(false);
    setDragOver(false);
  }

  // ---------- submit/delete/reorder ----------
  async function onSubmit(v: DishFormVals) {
    if (!v.category_id || v.category_id <= 0) {
      toast.error(t("admin.dishes.errors.pick_category"));
      return;
    }

    if (!Number.isFinite(v.price)) {
      toast.error(t("admin.dishes.errors.price_required"));
      return;
    }
    if (v.price < 0) {
      toast.error(t("admin.dishes.errors.price_non_negative"));
      return;
    }

    const legacyName = (nameByLang[defLang] || "").trim();
    const legacyDesc = (descByLang[defLang] || "").trim();
    if (!legacyName) {
      toast.error(t("admin.dishes.errors.name_required"));
      return;
    }

    const translations: DishTranslationInput[] = buildTranslationsArray(langsList, nameByLang, descByLang);

    // ✅ IMPORTANT FIX:
    // Never send portion_unit: "" (empty string) because backend treats it as "present"
    // and then portion pair validation fails (422).
    const portionValue =
      typeof v.portion_value === "number" && Number.isFinite(v.portion_value) && v.portion_value > 0
        ? v.portion_value
        : null;

    const portionUnit = v.portion_unit === "g" || v.portion_unit === "ml" ? v.portion_unit : null;

    // if no value -> do NOT send unit
    const safePortionUnit = portionValue ? portionUnit : null;

    try {
      setUiBusy(true);

      const payloadCommon = {
        name: legacyName,
        description: legacyDesc,
        price: v.price,
        category_id: v.category_id,
        is_active: v.is_active,
        image: v.image?.[0],
        translations,

        portion_value: portionValue,
        portion_unit: safePortionUnit,

        // ✅ from form
        allergen_ids: Array.isArray(v.allergen_ids) ? v.allergen_ids : [],
      } as any;

      await toast.promise(
        v.id
          ? updateDish(v.id, {
              ...payloadCommon,
              remove_image: removeImage,
            })
          : createDish(payloadCommon),
        {
          loading: v.id ? t("admin.dishes.toasts.saving_changes") : t("admin.dishes.toasts.creating"),
          success: v.id ? t("admin.dishes.toasts.updated") : t("admin.dishes.toasts.created"),
          error: t("admin.dishes.toasts.save_error"),
        }
      );

      resetAll();
      load(query.page);
    } finally {
      setUiBusy(false);
    }
  }

  async function onDelete(id: number, name: string) {
    const ok = await confirm({
      title: t("admin.dishes.delete_title"),
      message: `${t("admin.dishes.delete_confirm_prefix")}${name}${t("admin.dishes.delete_confirm_suffix")}`,
      confirmText: t("admin.common.delete"),
      cancelText: t("admin.common.cancel"),
      danger: true,
    });
    if (!ok) return;

    try {
      setUiBusy(true);
      await toast.promise(deleteDish(id), {
        loading: t("admin.dishes.toasts.deleting"),
        success: t("admin.dishes.toasts.deleted"),
        error: t("admin.dishes.toasts.delete_error"),
      });
      load(query.page);
    } finally {
      setUiBusy(false);
    }
  }

  async function onReorder(nextRows: Dish[]) {
    try {
      setUiBusy(true);
      await toast.promise(reorderDishes(nextRows.map((i) => i.id), query.category_id), {
        loading: t("admin.dishes.toasts.saving_order"),
        success: t("admin.dishes.toasts.order_saved"),
        error: t("admin.dishes.toasts.order_save_error"),
      });
      load(1);
    } finally {
      setUiBusy(false);
    }
  }

  async function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;

    const oldIndex = rows.findIndex((r) => r.id === active.id);
    const newIndex = rows.findIndex((r) => r.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const next = arrayMove(rows, oldIndex, newIndex);
    setRows(next);

    await onReorder(next);
  }

  const pages = useMemo(() => {
    const last = data?.meta.last_page ?? 1;
    return Array.from({ length: last }, (_, i) => i + 1);
  }, [data?.meta.last_page]);

  const categoryOptions = useMemo(
    () => cats.map((c) => ({ value: c.id, label: getCategoryLabel(c, active) })),
    [cats, active]
  );

  const filterCategoryOptions = useMemo(
    () => [
      { value: -1, label: t("admin.dishes.filters.all") },
      ...cats.map((c) => ({ value: c.id, label: getCategoryLabel(c, active) })),
    ],
    [cats, active, t]
  );

  // ✅ allergens dropdown options
  const allergenOptions = useMemo(() => {
    const list = allergens.slice().sort((a, b) => {
      const pa = a.position ?? 0;
      const pb = b.position ?? 0;
      if (pa !== pb) return pa - pb;
      return String(a.code || "").localeCompare(String(b.code || ""));
    });
    return list.map((a) => ({
      value: a.id,
      label: `${a.code} — ${a.name}`,
    }));
  }, [allergens]);

  const watchedFile = (watch("image") as any)?.[0] as File | undefined;
  const fileName = watchedFile?.name
    ? watchedFile.name
    : preview || editing?.image_url
      ? t("admin.dishes.form.current_photo", { defaultValue: "Current photo" })
      : t("admin.dishes.form.no_file_selected", { defaultValue: "No file selected" });
  const fileSizeLabel = watchedFile?.size ? bytesToSize(watchedFile.size) : "";

  return {
    t,
    restaurantSlug,
    data,
    cats,
    rows,
    setRows,
    loading,
    query,
    setQuery,
    pages,
    editing,
    disableAll,
    uiBusy,

    sensors,
    onDragEnd,

    // ✅ allergens
    allergenOptions,

    list,
    langsList,
    defLang,
    active,
    activeLang,
    setActiveLang,
    activeLabel,
    nameByLang,
    setNameByLang,
    descByLang,
    setDescByLang,
    nameMissing,
    fallbackName,
    fallbackDesc,
    tMissingTitle,
    tFallbackLabel,
    tDescFallbackLabel,
    tUseFallback,
    tCopyFallbackTitle,
    onUseFallback,

    categoryOptions,
    filterCategoryOptions,

    control,
    handleSubmit,
    register,
    watch,
    errors,
    isValid,
    resetAll,
    onSubmit,
    onEdit,
    onDelete,
    getDisplayName,

    preview,
    removeImage,
    dragOver,
    setDragOver,
    imageInputRef,
    imageRegister,
    setValue,
    applyImageFile,
    clearPreview,
    resetField,
    fileName,
    fileSizeLabel,
    onBrowse,
    onDropFile,

    onReorder,
  };
}
