import type { Dispatch, SetStateAction } from "react";
import { useEffect, useRef, useState } from "react";
import type { Category } from "../../lib/types";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useT } from "../../i18n/useT";

import { createCategory, updateCategory } from "../../services/categories";
import { normalizeTranslationsToMap, buildTranslationsArray } from "./categoryI18n";
import { bytesToSize } from "./categoryUtils";

import { LanguageTabs } from "./LanguageTabs";

type FormVals = {
  id?: number;
  is_active: boolean;
  image?: FileList;
};

type Props = {
  list: string[];
  defLang: string;

  activeLang: string;
  setActiveLang: Dispatch<SetStateAction<string>>;

  nameByLang: Record<string, string>;
  setNameByLang: Dispatch<SetStateAction<Record<string, string>>>;

  editing: Category | null;
  setEditing: (c: Category | null) => void;

  uiBusy: boolean;
  setUiBusy: (v: boolean) => void;

  onSaved: () => void;
};

export default function CategoryForm({
  list,
  defLang,
  activeLang,
  setActiveLang,
  nameByLang,
  setNameByLang,
  editing,
  setEditing,
  uiBusy,
  setUiBusy,
  onSaved,
}: Props) {
  const { msg } = useT();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    resetField,
    formState: { isSubmitting },
  } = useForm<FormVals>({
    mode: "onChange",
    defaultValues: { is_active: true },
  });

  const disableAll = uiBusy || isSubmitting;

  // ---------- Image preview ----------
  const [preview, setPreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [removeImage, setRemoveImage] = useState(false);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const imageRegister = register("image");

  const idName = "category-name";
  const idActiveLabel = "category-active-label";
  const idImage = "category-image";

  function applyImageFile(file: File | null) {
    if (preview) URL.revokeObjectURL(preview);
    if (!file) {
      setPreview(null);
      return;
    }
    setPreview(URL.createObjectURL(file));
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setRemoveImage(false);
    applyImageFile(file);
  }

  function clearPreview(markRemove = false) {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
    resetField("image");
    if (markRemove) setRemoveImage(true);
  }

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  // ✅ keep activeLang valid
  useEffect(() => {
    if (!list?.length) return;
    const cur = String(activeLang || "").toLowerCase();
    if (!list.includes(cur)) setActiveLang(defLang);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, defLang]);

  // when editing changes -> load form basic fields
  useEffect(() => {
    setDragOver(false);
    setRemoveImage(false);
    clearPreview(false);

    if (!editing) {
      reset({ is_active: true });

      setActiveLang((cur) => {
        const c = String(cur || "").toLowerCase();
        return list.includes(c) ? c : defLang;
      });

      setNameByLang((prev) => {
        const next = { ...prev };
        for (const l of list) next[l] = next[l] ?? "";
        if (!next[defLang]) next[defLang] = "";
        return next;
      });

      return;
    }

    reset({ id: editing.id, is_active: editing.is_active });

    const map = normalizeTranslationsToMap((editing as any).translations);
    const next: Record<string, string> = {};
    for (const l of list) next[l] = map?.[l]?.name ?? "";

    // ensure default has something (legacy name)
    if (!next[defLang]) next[defLang] = (editing.name ?? "").toString();

    setNameByLang((prev) => ({ ...prev, ...next }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, list, defLang, reset, resetField]);

  const active = list.includes(activeLang) ? activeLang : defLang;
  const activeLabel = active.toUpperCase();


  // ✅ AUTO-FILL: when switching language, if empty -> copy default immediately
  useEffect(() => {
    if (disableAll) return;
    if (!list?.length) return;
    if (active === defLang) return;

    const fallback = (nameByLang[defLang] ?? "").trim();
    const cur = (nameByLang[active] ?? "").trim();

    if (!cur && fallback) {
      setNameByLang((p) => ({ ...p, [active]: fallback }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, defLang]);

  const tNoTranslationPlaceholder = msg("admin.categories.no_translation_placeholder", {
    defaultValue: "No translation yet — type {{lang}}…",
    lang: activeLabel,
  });

  const onSubmit = async (v: FormVals) => {
    const legacyName = (nameByLang[defLang] || "").trim();
    if (!legacyName) {
      toast.error(msg("admin.categories.name_required") || "Name is required");
      return;
    }

    const translations = buildTranslationsArray(list, nameByLang);

    try {
      setUiBusy(true);

      const commonPayload: any = {
        name: legacyName,
        is_active: v.is_active,
        translations,
      };

      if (v.image?.[0]) commonPayload.image = v.image[0];
      if (editing && removeImage) commonPayload.remove_image = true;

      await toast.promise(
        v.id ? updateCategory(v.id, commonPayload) : createCategory(commonPayload),
        {
          loading: v.id ? msg("admin.categories.saving_changes") : msg("admin.categories.creating"),
          success: v.id ? msg("admin.categories.updated") : msg("admin.categories.created"),
          error: msg("admin.dishes.toasts.save_error") || "Save error",
        }
      );

      setEditing(null);
      reset({ is_active: true });

      setNameByLang((prev) => {
        const next: Record<string, string> = { ...prev };
        for (const l of list) next[l] = next[l] ?? "";
        next[defLang] = "";
        return next;
      });

      clearPreview(false);
      setRemoveImage(false);
      setDragOver(false);

      onSaved();
    } finally {
      setUiBusy(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="rounded-2xl border bg-white p-4 shadow-sm space-y-4">
      <LanguageTabs
        langs={list}
        activeLang={active}
        nameByLang={nameByLang}
        disableAll={disableAll}
        onPick={setActiveLang}
      />

      <div className="grid gap-3 grid-cols-1 sm:grid-cols-6 items-start">
        {/* name */}
        <div className="sm:col-span-3 min-w-0">
          <label className="block text-sm mb-1 text-gray-700" htmlFor={idName}>
            {msg("admin.categories.name_placeholder")} ({activeLabel})
          </label>

          <input
            id={idName}
            className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-black/10"
            value={nameByLang[active] ?? ""}
            onChange={(e) => setNameByLang((p) => ({ ...p, [active]: e.target.value }))}
            disabled={disableAll}
            placeholder={active === defLang ? `${msg("admin.categories.name_placeholder")} (${activeLabel})` : tNoTranslationPlaceholder}
            autoComplete="off"
          />

          {active !== defLang && (
            <p className="mt-2 text-xs text-gray-500">
           
            </p>
          )}
        </div>

        {/* active switch */}
        <div className="sm:col-span-3 min-w-0">
          <div className="block text-sm mb-1 text-gray-700" id={idActiveLabel}>
            {msg("admin.categories.active")}
          </div>

          <div className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 shadow-sm flex items-center justify-between" aria-labelledby={idActiveLabel}>
            <span className="text-sm font-medium text-gray-800">
              {watch("is_active") ? (msg("admin.common.on") ?? "On") : (msg("admin.common.off") ?? "Off")}
            </span>

            <button
              type="button"
              disabled={disableAll}
              onClick={() => {
                if (disableAll) return;
                setValue("is_active", !watch("is_active"), { shouldDirty: true, shouldTouch: true });
              }}
              className={[
                "relative inline-flex h-6 w-11 items-center rounded-full transition",
                watch("is_active") ? "bg-emerald-500" : "bg-gray-300",
                disableAll ? "opacity-60 cursor-not-allowed" : "cursor-pointer",
              ].join(" ")}
              aria-pressed={!!watch("is_active")}
              aria-labelledby={idActiveLabel}
            >
              <span className={["inline-block h-5 w-5 transform rounded-full bg-white shadow transition", watch("is_active") ? "translate-x-5" : "translate-x-1"].join(" ")} />
            </button>

            <input type="checkbox" className="hidden" {...register("is_active")} />
          </div>
        </div>

        {/* image */}
        <div className="sm:col-span-6 min-w-0">
          <label className="block text-sm mb-1 text-gray-700" htmlFor={idImage}>
            {msg("admin.categories.th_photo")}
          </label>

          <input
            id={idImage}
            type="file"
            accept="image/*"
            {...imageRegister}
            ref={(el) => {
              imageInputRef.current = el ?? null;
              imageRegister.ref(el);
            }}
            onChange={(e) => {
              imageRegister.onChange(e);
              handleImageChange(e);
            }}
            className="hidden"
            disabled={disableAll}
          />

          <div className="min-w-0 max-w-full overflow-hidden">
            <div
              onDragEnter={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!disableAll) setDragOver(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!disableAll) setDragOver(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDragOver(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDragOver(false);
                if (disableAll) return;

                const file = e.dataTransfer.files?.[0] ?? null;
                if (!file) return;

                const dt = new DataTransfer();
                dt.items.add(file);
                setValue("image", dt.files as any, { shouldDirty: true, shouldTouch: true, shouldValidate: false });
                setRemoveImage(false);
                applyImageFile(file);
              }}
              className={[
                "w-full rounded-2xl border bg-gray-50/60 p-4 shadow-sm",
                dragOver ? "border-black ring-2 ring-black/10" : "border-gray-200",
                disableAll ? "opacity-60 cursor-not-allowed" : "cursor-pointer",
              ].join(" ")}
              role="button"
              tabIndex={0}
              onClick={() => {
                if (disableAll) return;
                imageInputRef.current?.click();
              }}
              onKeyDown={(e) => {
                if (disableAll) return;
                if (e.key === "Enter" || e.key === " ") imageInputRef.current?.click();
              }}
              aria-label={msg("admin.categories.th_photo") || "Upload image"}
            >
              <div className="text-center">
                <div className="mx-auto mb-3 h-14 w-14 rounded-2xl bg-white shadow-sm border flex items-center justify-center">
                  <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden>
                    <path fill="currentColor" d="M12 3a1 1 0 0 1 1 1v8.59l2.3-2.3 1.4 1.42L12 16.41l-4.7-4.7 1.4-1.42 2.3 2.3V4a1 1 0 0 1 1-1Zm-7 15h14v2H5v-2Z" />
                  </svg>
                </div>

                <div className="text-sm font-semibold text-gray-900">{msg("admin.dishes.form.upload_title") || "Upload image"}</div>
                <div className="mt-1 text-sm text-gray-600">
                  {msg("admin.dishes.form.drop_here") || "Drop image here or"}{" "}
                  <span className="font-semibold text-gray-900 underline underline-offset-2">{msg("admin.dishes.form.browse") || "browse"}</span>
                </div>
                <div className="mt-1 text-xs text-gray-500">{msg("admin.dishes.form.allowed_types") || "JPG, PNG, WEBP"}</div>
              </div>

              <div className="mt-4 space-y-2">
                {preview ?? editing?.image_url ? (
                  <div className="flex items-center justify-between rounded-xl border bg-white px-3 py-2 shadow-sm">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-lg border bg-gray-50 overflow-hidden flex items-center justify-center shrink-0">
                        <img src={(preview ?? editing?.image_url) as string} alt="preview" className="h-full w-full object-cover" />
                      </div>

                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-gray-900">
                          {(() => {
                            const f = (watch("image") as any)?.[0] as File | undefined;
                            if (f?.name) return f.name;
                            return msg("admin.dishes.form.current_photo") || "Current photo";
                          })()}
                        </div>

                        <div className="text-xs text-gray-500">
                          {(() => {
                            const f = (watch("image") as any)?.[0] as File | undefined;
                            return f?.size ? bytesToSize(f.size) : "";
                          })()}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={disableAll}
                      onClick={(e) => {
                        e.stopPropagation();
                        clearPreview(!!editing?.image_url);
                      }}
                      className={["h-9 w-9 rounded-lg border bg-white hover:bg-gray-50 flex items-center justify-center", disableAll ? "opacity-60 cursor-not-allowed" : ""].join(" ")}
                      title={msg("admin.dishes.form.remove_photo") || "Remove"}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
                        <path fill="currentColor" d="M9 3h6l1 2h5v2H3V5h5l1-2Zm1 6h2v10h-2V9Zm4 0h2v10h-2V9Z" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <div className="text-xs text-gray-500 text-center">{msg("admin.dishes.form.no_file_selected") || "No file selected"}</div>
                )}
              </div>

              <div className="mt-4">
                <button
                  type="button"
                  disabled={disableAll}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (disableAll) return;
                    imageInputRef.current?.click();
                  }}
                  className={["w-full rounded-xl py-2.5 text-sm font-semibold", "bg-black text-white hover:bg-black/90 transition", disableAll ? "opacity-60 cursor-not-allowed" : ""].join(" ")}
                >
                  {msg("admin.dishes.form.choose_file") || "Choose file"}
                </button>
              </div>
            </div>
          </div>

          {removeImage && (
            <p className="mt-2 text-xs text-amber-700">
              {msg("admin.dishes.form.will_remove_on_save") ?? "Image will be removed when you save."}
            </p>
          )}
        </div>
      </div>

      {/* actions */}
      <div className="flex flex-wrap items-center gap-2">
        <button className={["px-4 py-2 rounded-lg text-white bg-black hover:bg-black/90 transition", disableAll ? "opacity-60 cursor-not-allowed" : ""].join(" ")} disabled={disableAll}>
          {editing ? msg("admin.common.save") : msg("admin.common.create")}
        </button>

        {editing && (
          <button
            type="button"
            className={["px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition", disableAll ? "opacity-60 cursor-not-allowed" : ""].join(" ")}
            disabled={disableAll}
            onClick={() => setEditing(null)}
          >
            {msg("admin.common.cancel")}
          </button>
        )}
      </div>
    </form>
  );
}
