import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";

import type { Allergen } from "../../../lib/types";
import { useConfirm } from "../../../components/ConfirmProvider";
import { apiAdmin } from "../../../lib/api";
import { useT } from "../../../i18n/useT";
import { bytesToSize, norm, safeString } from "../allergensUtils";

import type { DragEndEvent } from "@dnd-kit/core";
import { KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";

export type Translation = { lang: string; name: string };

export type AllergenFormVals = {
  id?: number;
  code: string;
  translations: Translation[];
  name?: string; // legacy (BG text идва от API тук)
  is_active: boolean;
  image?: FileList;
};

export type UsePlatformAllergensPageVM = ReturnType<typeof usePlatformAllergensPage>;

function normLang(v: unknown) {
  return String(v ?? "").trim().toLowerCase();
}

function normalizeTranslations(input: any, defaultLang: string): Translation[] {
  const arr: any[] = Array.isArray(input) ? input : [];
  const map = new Map<string, string>();

  for (const t of arr) {
    const l = normLang(t?.lang);
    const n = safeString(t?.name);
    if (!l) continue;
    map.set(l, n); // last wins
  }

  if (!map.has(defaultLang)) map.set(defaultLang, "");
  return Array.from(map.entries()).map(([lang, name]) => ({ lang, name }));
}

function getNameFromTranslations(tr: Translation[], lang: string, fallback: string) {
  const l = normLang(lang);
  const f = normLang(fallback);

  const hit = tr.find((x) => normLang(x.lang) === l)?.name;
  if (safeString(hit)) return String(hit);

  const fb = tr.find((x) => normLang(x.lang) === f)?.name;
  if (safeString(fb)) return String(fb);

  const any = tr.find((x) => safeString(x.name))?.name;
  return safeString(any) ? String(any) : "";
}

async function fetchActiveContentLangs(): Promise<{ langs: string[] }> {
  const { data } = await apiAdmin.get<{ langs: string[] }>("platform/active-content-langs");
  const incoming = Array.isArray((data as any)?.langs) ? (data as any).langs : [];
  return { langs: incoming.map(normLang).filter(Boolean) };
}

export function usePlatformAllergensPage() {
  const { msg } = useT();
  const confirm = useConfirm();

  const [rows, setRows] = useState<Allergen[]>([]);
  const [loading, setLoading] = useState(false);
  const [uiBusy, setUiBusy] = useState(false);

  const [editing, setEditing] = useState<Allergen | null>(null);
  const [search, setSearch] = useState("");

  // ✅ platform active content langs
  const [langs, setLangs] = useState<string[]>(["bg"]);
  const [defaultLang, setDefaultLang] = useState<string>("bg");

  // image preview state
  const [preview, setPreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [removeImage, setRemoveImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    resetField,
    formState: { isSubmitting, errors, isValid },
  } = useForm<AllergenFormVals>({
    mode: "onChange",
    defaultValues: {
      code: "",
      translations: [{ lang: "bg", name: "" }],
      is_active: true,
    },
  });

  const disableAll = uiBusy || isSubmitting;
  const imageRegister = register("image");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    return () => {
      if (preview && preview.startsWith("blob:")) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function applyImageFile(file: File | null) {
    setRemoveImage(false);
    if (preview && preview.startsWith("blob:")) URL.revokeObjectURL(preview);
    if (!file) return setPreview(null);
    setPreview(URL.createObjectURL(file));
  }

  function clearPreview(markRemove: boolean) {
    if (preview && preview.startsWith("blob:")) URL.revokeObjectURL(preview);
    setPreview(null);

    if (imageInputRef.current) imageInputRef.current.value = "";
    resetField("image");
    setRemoveImage(markRemove);
  }

  function onDropFile(file: File) {
    applyImageFile(file);

    const dt = new DataTransfer();
    dt.items.add(file);

    setValue("image", dt.files as any, { shouldDirty: true, shouldTouch: true, shouldValidate: false });
    if (imageInputRef.current) imageInputRef.current.files = dt.files;
  }

  function onBrowse() {
    imageInputRef.current?.click();
  }

  async function loadLangs() {
    try {
      const res = await fetchActiveContentLangs();
      const incoming = (res?.langs ?? []).map(normLang).filter(Boolean);
      const safeLangs = incoming.length ? Array.from(new Set(incoming)) : ["bg"];

      // default language = първият (или bg)
      const def = safeLangs.includes("bg") ? "bg" : safeLangs[0];
      const ordered = [def, ...safeLangs.filter((l) => l !== def)];

      setLangs(ordered);
      setDefaultLang(def);
    } catch {
      setLangs(["bg"]);
      setDefaultLang("bg");
    }
  }

  async function load() {
    setLoading(true);
    try {
      const { data } = await apiAdmin.get<{ data: Allergen[] }>("platform/allergens", {
        params: { per_page: -1, sort: "position,code" },
      });
      setRows(Array.isArray((data as any)?.data) ? (data as any).data : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    loadLangs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredRows = useMemo(() => {
    const q = norm(search);
    if (!q) return rows;

    return rows.filter((x: any) => {
      const tr = Array.isArray(x?.translations) ? (x.translations as Translation[]) : [];
      const name = getNameFromTranslations(tr, defaultLang, defaultLang) || safeString(x?.name);
      return norm(x.code).includes(q) || norm(name).includes(q);
    });
  }, [rows, search, defaultLang]);

  async function createPlatformAllergenMultipart(payload: {
    code: string;
    translations: Translation[];
    is_active: boolean;
    image?: File;
  }): Promise<Allergen> {
    const form = new FormData();
    form.append("code", payload.code);

    payload.translations.forEach((t, i) => {
      const l = normLang(t.lang);
      const n = safeString(t.name);
      if (!l || !n) return;
      form.append(`translations[${i}][lang]`, l);
      form.append(`translations[${i}][name]`, n);
    });

    form.append("is_active", payload.is_active ? "1" : "0");
    if (payload.image) form.append("image", payload.image);

    const { data } = await apiAdmin.post<{ data: Allergen }>("platform/allergens", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    return (data as any)?.data ?? (data as any);
  }

  async function updatePlatformAllergenMultipart(
    id: number,
    payload: { code: string; translations: Translation[]; is_active: boolean; image?: File; remove_image?: boolean }
  ): Promise<Allergen> {
    const form = new FormData();
    form.append("code", payload.code);

    payload.translations.forEach((t, i) => {
      const l = normLang(t.lang);
      const n = safeString(t.name);
      if (!l || !n) return;
      form.append(`translations[${i}][lang]`, l);
      form.append(`translations[${i}][name]`, n);
    });

    form.append("is_active", payload.is_active ? "1" : "0");
    if (payload.image) form.append("image", payload.image);
    if (payload.remove_image) form.append("remove_image", "1");

    const { data } = await apiAdmin.post<{ data: Allergen }>(`platform/allergens/${id}?_method=PATCH`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    return (data as any)?.data ?? (data as any);
  }

  function onEdit(a: any) {
    setEditing(a);

    let tr = normalizeTranslations(a?.translations, defaultLang);

    // ✅ ако backend връща празни translations, използвай legacy name като default translation
    if (!Array.isArray(a?.translations) || a.translations.length === 0) {
      const legacy = safeString(a?.name);
      if (legacy) tr = [{ lang: defaultLang, name: legacy }];
      else if (!tr.some((x) => normLang(x.lang) === defaultLang)) tr = [{ lang: defaultLang, name: "" }];
    }

    const base = getNameFromTranslations(tr, defaultLang, defaultLang) || safeString(a?.name);

    reset({
      id: a.id,
      code: a.code,
      translations: tr,
      name: base,
      is_active: !!a.is_active,
    });

    setPreview(a.image_url ?? null);
    setRemoveImage(false);
    setDragOver(false);

    if (imageInputRef.current) imageInputRef.current.value = "";
    resetField("image");
  }

  function resetAll() {
    setEditing(null);
    reset({
      code: "",
      translations: [{ lang: defaultLang, name: "" }],
      is_active: true,
    });
    setDragOver(false);
    clearPreview(false);
  }

  async function onSubmit(v: AllergenFormVals) {
    const code = safeString(v.code);
    if (!code) return toast.error(msg("admin.allergens.code_required", { defaultValue: "Кодът е задължителен" }));

    const tr = normalizeTranslations(v.translations, defaultLang);
    const baseName = getNameFromTranslations(tr, defaultLang, defaultLang);

    if (!safeString(baseName)) {
      return toast.error(msg("admin.allergens.name_required", { defaultValue: "Името е задължително" }));
    }

    const file = v.image?.[0];

    try {
      setUiBusy(true);

      await toast.promise(
        editing?.id
          ? updatePlatformAllergenMultipart(editing.id, {
              code,
              translations: tr,
              is_active: !!v.is_active,
              image: file,
              remove_image: removeImage,
            })
          : createPlatformAllergenMultipart({
              code,
              translations: tr,
              is_active: !!v.is_active,
              image: file,
            }),
        {
          loading: editing
            ? msg("admin.allergens.saving_changes", { defaultValue: "Записвам промените..." })
            : msg("admin.allergens.creating", { defaultValue: "Създавам алерген..." }),
          success: editing
            ? msg("admin.allergens.updated", { defaultValue: "Алергенът е обновен" })
            : msg("admin.allergens.created", { defaultValue: "Алергенът е създаден" }),
          error: msg("admin.allergens.save_error", { defaultValue: "Грешка при запис" }),
        }
      );

      resetAll();
      await load();
    } finally {
      setUiBusy(false);
    }
  }

  async function onDelete(a: any) {
    const tr = Array.isArray(a?.translations) ? (a.translations as Translation[]) : [];
    const name = getNameFromTranslations(tr, defaultLang, defaultLang) || safeString(a?.name);

    const ok = await confirm({
      title: msg("admin.allergens.delete_title", { defaultValue: "Изтриване" }),
      message: msg("admin.allergens.delete_confirm", {
        defaultValue: `Сигурни ли сте, че искате да изтриете "{{name}}"? Действието е необратимо.`,
        name: `${a.code} — ${name}`,
      }),
      confirmText: msg("admin.common.delete", { defaultValue: "Изтрий" }),
      cancelText: msg("admin.common.cancel", { defaultValue: "Отказ" }),
      danger: true,
    });
    if (!ok) return;

    try {
      setUiBusy(true);
      await toast.promise(apiAdmin.delete(`platform/allergens/${a.id}`), {
        loading: msg("admin.allergens.deleting", { defaultValue: "Изтривам..." }),
        success: msg("admin.allergens.deleted", { defaultValue: "Изтрито" }),
        error: msg("admin.allergens.delete_error", { defaultValue: "Грешка при изтриване" }),
      });
      await load();
    } finally {
      setUiBusy(false);
    }
  }

  async function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;

    const oldIndex = filteredRows.findIndex((x: any) => x.id === active.id);
    const newIndex = filteredRows.findIndex((x: any) => x.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const nextFiltered = arrayMove(filteredRows as any[], oldIndex, newIndex);

    const idsInFiltered = new Set(nextFiltered.map((x: any) => x.id));
    const nextAll = [...rows];
    let k = 0;

    for (let i = 0; i < nextAll.length; i++) {
      if (idsInFiltered.has((nextAll as any)[i].id)) {
        (nextAll as any)[i] = nextFiltered[k++];
      }
    }

    setRows(nextAll);

    try {
      setUiBusy(true);
      const items = (nextAll as any[]).map((x, idx) => ({ id: x.id, position: idx }));

      await toast.promise(apiAdmin.post("platform/allergens/reorder", { items }), {
        loading: msg("admin.allergens.saving_order", { defaultValue: "Записвам подредбата..." }),
        success: msg("admin.allergens.order_saved", { defaultValue: "Подредбата е запазена" }),
        error: msg("admin.allergens.order_save_error", { defaultValue: "Грешка при запис на подредбата" }),
      });

      await load();
    } finally {
      setUiBusy(false);
    }
  }

  const watchedFile = (watch("image") as any)?.[0] as File | undefined;
  const currentPreviewSrc = preview ?? (editing?.image_url ?? null);

  const fileName = watchedFile?.name
    ? watchedFile.name
    : currentPreviewSrc
      ? msg("admin.dishes.form.current_photo", { defaultValue: "Current photo" })
      : msg("admin.dishes.form.no_file_selected", { defaultValue: "No file selected" });

  const fileSizeLabel = watchedFile?.size ? bytesToSize(watchedFile.size) : "";

  return {
    msg,

    rows,
    filteredRows,
    loading,
    uiBusy,
    disableAll,

    search,
    setSearch,

    editing,
    onEdit,
    onDelete,
    resetAll,

    register,
    handleSubmit,
    errors,
    isValid,
    onSubmit,
    watch,
    setValue,

    imageRegister,
    imageInputRef,
    dragOver,
    setDragOver,
    removeImage,
    setRemoveImage,
    preview,
    currentPreviewSrc,
    fileName,
    fileSizeLabel,
    applyImageFile,
    clearPreview,
    onBrowse,
    onDropFile,

    sensors,
    onDragEnd,

    langs,
    defaultLang,
  };
}