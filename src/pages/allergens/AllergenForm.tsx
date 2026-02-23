// src/pages/allergens/AllergenForm.tsx
import type { ChangeEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import type { UsePlatformAllergensPageVM } from "./hooks/usePlatformAllergensPage";
import { bytesToSize } from "./allergensUtils";

type Translation = { lang: string; name: string };

function safeNonEmpty(v: unknown) {
  return String(v ?? "").trim().length > 0;
}

function normLang(v: unknown) {
  return String(v ?? "").trim().toLowerCase();
}

export function AllergenForm({ vm }: { vm: UsePlatformAllergensPageVM }) {
  const idCode = "allergen-code";
  const idActiveLabel = "allergen-active-label";
  const idImage = "allergen-image";

  const t = (k: string, def: string) => vm.msg(k, { defaultValue: def });
  const activeChecked = !!vm.watch("is_active");

  // ---- langs ----
  const rawLangs = useMemo(() => {
    const raw = (vm as any).langs;
    if (Array.isArray(raw) && raw.length) {
      return raw.map((x: any) => String(x).trim().toLowerCase()).filter(Boolean);
    }
    return ["bg"];
  }, [vm]);

  const defaultLang = useMemo(() => {
    const raw = (vm as any).defaultLang;
    const d = String(raw ?? rawLangs[0] ?? "bg").trim().toLowerCase();
    return rawLangs.includes(d) ? d : (rawLangs[0] ?? "bg");
  }, [vm, rawLangs]);

  const langs = useMemo(() => {
    const unique = Array.from(new Set(rawLangs.map(normLang).filter(Boolean)));
    const def = normLang(defaultLang) || unique[0] || "bg";
    const ordered = [def, ...unique.filter((l) => l !== def)];
    return ordered.length ? ordered : ["bg"];
  }, [rawLangs.join(","), defaultLang]);

  // tabs state (like categories)
  const storageKey = "admin:platform:allergens:lang";
  const [activeLang, setActiveLang] = useState<string>(() => {
    const saved = normLang(localStorage.getItem(storageKey));
    return saved && langs.includes(saved) ? saved : defaultLang;
  });

  useEffect(() => {
    setActiveLang((cur) => {
      const c = normLang(cur);
      if (langs.includes(c)) return c;

      const saved = normLang(localStorage.getItem(storageKey));
      if (saved && langs.includes(saved)) return saved;

      return defaultLang;
    });
  }, [langs.join(","), defaultLang]);

  useEffect(() => {
    setActiveLang(defaultLang);
  }, [vm.editing?.id, defaultLang]);

  useEffect(() => {
    const a = normLang(activeLang);
    if (a) localStorage.setItem(storageKey, a);
  }, [activeLang]);

  // translations
  const translations = (vm.watch("translations") ?? []) as Translation[];

  function getNameForLang(lang: string): string {
    const l = normLang(lang);
    const hit = translations.find((x) => normLang(x.lang) === l);
    return String(hit?.name ?? "");
  }

  function setNameForLang(lang: string, value: string) {
    const l = normLang(lang);
    const v = String(value ?? "");

    const next = Array.isArray(translations) ? [...translations] : [];
    const idx = next.findIndex((x) => normLang(x.lang) === l);

    if (idx >= 0) next[idx] = { ...next[idx], lang: l, name: v };
    else next.push({ lang: l, name: v });

    vm.setValue("translations" as any, next, { shouldDirty: true, shouldTouch: true, shouldValidate: true });

    if (l === defaultLang) {
      vm.setValue("name", v, { shouldDirty: true, shouldTouch: true, shouldValidate: false });
    }
  }

  // ensure default exists
  useEffect(() => {
    const cur = (vm.watch("translations") ?? []) as Translation[];
    const has = Array.isArray(cur) && cur.some((x) => normLang(x.lang) === defaultLang);
    if (!has) {
      vm.setValue("translations" as any, [...(Array.isArray(cur) ? cur : []), { lang: defaultLang, name: "" }], {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: false,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultLang]);

  // legacy name -> default translation on edit
  useEffect(() => {
    const legacy = String(vm.watch("name") ?? "").trim();
    if (!legacy) return;

    const cur = (vm.watch("translations") ?? []) as Translation[];
    const def = normLang(defaultLang);

    const idx = Array.isArray(cur) ? cur.findIndex((x) => normLang(x.lang) === def) : -1;
    const currentVal = idx >= 0 ? String(cur[idx]?.name ?? "") : "";

    if (currentVal.trim()) return;

    const next = Array.isArray(cur) ? [...cur] : [];
    if (idx >= 0) next[idx] = { ...next[idx], lang: def, name: legacy };
    else next.push({ lang: def, name: legacy });

    vm.setValue("translations" as any, next, { shouldDirty: false, shouldTouch: false, shouldValidate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vm.editing?.id, defaultLang]);

  const activeNameValue = getNameForLang(activeLang);

  const fallbackName = getNameForLang(defaultLang).trim();
  const activeNameTrim = getNameForLang(activeLang).trim();
  const isNonDefault = normLang(activeLang) !== normLang(defaultLang);
  const nameMissing = isNonDefault && !activeNameTrim && !!fallbackName;

  function onUseFallback() {
    if (!fallbackName) return;
    setNameForLang(activeLang, fallbackName);
  }

  function handleImageChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    vm.applyImageFile(file);
    if (file) vm.setRemoveImage(false);
  }

  const currentPreview = vm.currentPreviewSrc;
  const watchedFile = (vm.watch("image") as any)?.[0] as File | undefined;
  const fileSize = watchedFile?.size ? bytesToSize(watchedFile.size) : "";

  const defaultNameValue = getNameForLang(defaultLang) || String(vm.watch("name") ?? "");
  const defaultNameMissing = !safeNonEmpty(defaultNameValue);

  return (
    <form onSubmit={vm.handleSubmit(vm.onSubmit)} className="rounded-2xl border bg-white p-4 shadow-sm space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm font-semibold">
          {vm.editing ? t("admin.allergens.edit_title", "Редакция на алерген") : t("admin.allergens.create_title", "Добави нов алерген")}
        </div>
        {vm.editing ? <span className="text-xs text-gray-500">{t("admin.common.editing", "Редакция")}</span> : null}
      </div>
      

      {/* hidden registrations */}
      <div className="hidden">
        <input type="text" {...vm.register("code", { required: t("admin.allergens.code_required", "Кодът е задължителен.") })} />
        <input type="text" {...vm.register("name")} />
      </div>

             {/* Name + Tabs (tabs stay INSIDE the name column, not between columns) */}
        <div className="min-w-0">
          {/* Tabs row */}
          {langs.length > 1 ? (
            <div className="mb-2 flex items-center gap-2">
              {langs.map((l) => {
                const isActive = l === activeLang;
                return (
                  <button
                    key={l}
                    type="button"
                    disabled={vm.disableAll}
                    onClick={() => setActiveLang(l)}
                    className={[
                      "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition",
                      isActive ? "bg-black text-white border-black" : "bg-white text-gray-900 border-gray-200 hover:border-gray-300",
                      vm.disableAll ? "opacity-60 cursor-not-allowed" : "",
                    ].join(" ")}
                    title={l.toUpperCase()}
                  >
                    <span className={["h-2 w-2 rounded-full", isActive ? "bg-white" : "bg-gray-300"].join(" ")} aria-hidden />
                    {l.toUpperCase()}
                  </button>
                );
              })}
            </div>
          ) : null}

          <label className="block text-sm mb-1 text-gray-700">
            {t("admin.allergens.name", "Име")} <span className="text-red-600">*</span>
            {langs.length > 1 ? <span className="text-gray-400"> ({activeLang.toUpperCase()})</span> : null}
          </label>

          <input
            className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-black/10"
            placeholder={activeLang === defaultLang ? t("admin.allergens.name_placeholder", "напр. Яйца") : t("admin.common.optional", "optional")}
            disabled={vm.disableAll}
            value={activeNameValue}
            onChange={(e) => setNameForLang(activeLang, e.target.value)}
          />

          {langs.length > 1 ? (
            <div className="mt-1 text-xs text-gray-500">
              {activeLang === defaultLang
                ? t("admin.allergens.name_default_hint", "Това е основният език (default).")
                : t("admin.allergens.name_translation_hint", "Превод за избрания език.")}
            </div>
          ) : null}

          {nameMissing ? (
            <div className="mt-2 rounded-lg border bg-amber-50/60 px-3 py-2 text-xs text-amber-900 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="font-semibold">
                  {t("admin.allergens.missing_translation_title", "Missing translation for")}{" "}
                  <span className="font-mono">{activeLang.toUpperCase()}</span>
                </div>
                <div className="mt-0.5 text-amber-800">
                  {t("admin.allergens.fallback_label", "Fallback")} ({defaultLang.toUpperCase()}):{" "}
                  <span className="font-medium">{fallbackName}</span>
                </div>
              </div>

              <button
                type="button"
                disabled={vm.disableAll}
                onClick={onUseFallback}
                className={[
                  "shrink-0 rounded-md border bg-white px-2.5 py-1 font-semibold hover:bg-gray-50",
                  vm.disableAll ? "opacity-60 cursor-not-allowed" : "",
                ].join(" ")}
              >
                {t("admin.allergens.use_fallback", "Use fallback")}
              </button>
            </div>
          ) : null}

          {defaultNameMissing && (vm as any).isValid === false ? (
            <p className="mt-1 text-xs text-red-600">{t("admin.allergens.name_required", "Името е задължително.")}</p>
          ) : null}
        </div>


      {/* ✅ EXACT categories-like: 2 columns on desktop */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        {/* Code */}
        <div className="min-w-0">
          <label className="block text-sm mb-1 text-gray-700" htmlFor={idCode}>
            {t("admin.allergens.code", "Код")}
          </label>
          <input
            id={idCode}
            className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-black/10"
            placeholder="A1"
            disabled={vm.disableAll}
            {...vm.register("code", { required: t("admin.allergens.code_required", "Кодът е задължителен.") })}
          />
          {vm.errors.code && <p className="mt-1 text-xs text-red-600">{String(vm.errors.code.message)}</p>}
        </div>

 
        {/* Active (full width) */}
        <div className="min-w-0 md:col-span-2">
          <div className="block text-sm mb-1 text-gray-700" id={idActiveLabel}>
            {t("admin.allergens.active", "Активно")}
          </div>

          <div className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 shadow-sm flex items-center justify-between" aria-labelledby={idActiveLabel}>
            <span className="text-sm font-medium text-gray-800">
              {activeChecked ? t("admin.common.on", "Вкл.") : t("admin.common.off", "Изкл.")}
            </span>

            <button
              type="button"
              disabled={vm.disableAll}
              onClick={() => {
                if (vm.disableAll) return;
                vm.setValue("is_active", !activeChecked, { shouldDirty: true, shouldTouch: true });
              }}
              className={[
                "relative inline-flex h-6 w-11 items-center rounded-full transition",
                activeChecked ? "bg-emerald-500" : "bg-gray-300",
                vm.disableAll ? "opacity-60 cursor-not-allowed" : "cursor-pointer",
              ].join(" ")}
              aria-pressed={activeChecked}
              aria-labelledby={idActiveLabel}
            >
              <span className={["inline-block h-5 w-5 transform rounded-full bg-white shadow transition", activeChecked ? "translate-x-5" : "translate-x-1"].join(" ")} />
            </button>

            <input type="checkbox" className="hidden" {...vm.register("is_active")} />
          </div>
        </div>

        {/* Image (full width) */}
        <div className="min-w-0 md:col-span-2">
          <label className="block text-sm mb-1 text-gray-700" htmlFor={idImage}>
            {t("admin.allergens.photo", "Снимка")} <span className="text-gray-400">({t("admin.common.optional", "optional")})</span>
          </label>

          <input
            id={idImage}
            type="file"
            accept="image/*"
            {...vm.imageRegister}
            ref={(el) => {
              vm.imageInputRef.current = el ?? null;
              vm.imageRegister.ref(el);
            }}
            onChange={(e) => {
              vm.imageRegister.onChange(e);
              handleImageChange(e);
            }}
            className="hidden"
            disabled={vm.disableAll}
          />

          <div className="min-w-0 max-w-full overflow-hidden">
            <div
              onDragEnter={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!vm.disableAll) vm.setDragOver(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!vm.disableAll) vm.setDragOver(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                vm.setDragOver(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                vm.setDragOver(false);
                if (vm.disableAll) return;

                const file = e.dataTransfer.files?.[0] ?? null;
                if (!file) return;
                vm.onDropFile(file);
              }}
              className={[
                "w-full rounded-2xl border bg-gray-50/60 p-4 shadow-sm",
                vm.dragOver ? "border-black ring-2 ring-black/10" : "border-gray-200",
                vm.disableAll ? "opacity-60 cursor-not-allowed" : "cursor-pointer",
              ].join(" ")}
              role="button"
              tabIndex={0}
              onClick={() => {
                if (vm.disableAll) return;
                vm.onBrowse();
              }}
              onKeyDown={(e) => {
                if (vm.disableAll) return;
                if (e.key === "Enter" || e.key === " ") vm.onBrowse();
              }}
              aria-label={t("admin.allergens.photo", "Upload image")}
            >
              <div className="text-center">
                <div className="mx-auto mb-3 h-14 w-14 rounded-2xl bg-white shadow-sm border flex items-center justify-center">
                  <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden>
                    <path
                      fill="currentColor"
                      d="M12 3a1 1 0 0 1 1 1v8.59l2.3-2.3 1.4 1.42L12 16.41l-4.7-4.7 1.4-1.42 2.3 2.3V4a1 1 0 0 1 1-1Zm-7 15h14v2H5v-2Z"
                    />
                  </svg>
                </div>

                <div className="text-sm font-semibold text-gray-900">{t("admin.allergens.form.upload_title", "Качи снимка")}</div>
                <div className="mt-1 text-sm text-gray-600">
                  {t("admin.allergens.form.drop_here", "Пусни снимка тук или")}{" "}
                  <span className="font-semibold text-gray-900 underline underline-offset-2">{t("admin.allergens.form.browse", "избери")}</span>
                </div>
                <div className="mt-1 text-xs text-gray-500">{t("admin.allergens.form.allowed_types", "JPG, PNG, WEBP")}</div>
              </div>

              <div className="mt-4 space-y-2">
                {currentPreview ? (
                  <div className="flex items-center justify-between rounded-xl border bg-white px-3 py-2 shadow-sm">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-lg border bg-gray-50 overflow-hidden flex items-center justify-center shrink-0">
                        <img src={currentPreview} alt="preview" className="h-full w-full object-cover" />
                      </div>

                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-gray-900">{vm.fileName || t("admin.allergens.form.file", "Файл")}</div>
                        <div className="text-xs text-gray-500">{fileSize || vm.fileSizeLabel || ""}</div>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={vm.disableAll}
                      onClick={(e) => {
                        e.stopPropagation();
                        vm.clearPreview(!!vm.editing?.image_url);
                      }}
                      className={["h-9 w-9 rounded-lg border bg-white hover:bg-gray-50 flex items-center justify-center", vm.disableAll ? "opacity-60 cursor-not-allowed" : ""].join(" ")}
                      title={t("admin.allergens.form.remove_photo", "Remove")}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
                        <path fill="currentColor" d="M9 3h6l1 2h5v2H3V5h5l1-2Zm1 6h2v10h-2V9Zm4 0h2v10h-2V9Z" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <div className="text-xs text-gray-500 text-center">{t("admin.allergens.form.no_file_selected", "Няма избран файл")}</div>
                )}
              </div>

              <div className="mt-4">
                <button
                  type="button"
                  disabled={vm.disableAll}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (vm.disableAll) return;
                    vm.onBrowse();
                  }}
                  className={[
                    "w-full rounded-xl py-2.5 text-sm font-semibold",
                    "bg-black text-white hover:bg-black/90 transition",
                    vm.disableAll ? "opacity-60 cursor-not-allowed" : "",
                  ].join(" ")}
                >
                  {t("admin.allergens.form.choose_file", "Избери файл")}
                </button>
              </div>
            </div>
          </div>

          {vm.removeImage ? <p className="mt-2 text-xs text-amber-700">{t("admin.allergens.form.will_remove_on_save", "Снимката ще се премахне при запис.")}</p> : null}
        </div>
      </div>

      {/* actions */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          className={[
            "px-4 py-2 rounded-lg text-white bg-black hover:bg-black/90 transition",
            vm.disableAll || !vm.isValid ? "opacity-60 cursor-not-allowed" : "",
          ].join(" ")}
          disabled={vm.disableAll || !vm.isValid}
        >
          {vm.editing ? t("admin.common.save", "Запази") : t("admin.common.create", "Създай")}
        </button>

        {vm.editing ? (
          <button
            type="button"
            className={["px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition", vm.disableAll ? "opacity-60 cursor-not-allowed" : ""].join(" ")}
            disabled={vm.disableAll}
            onClick={vm.resetAll}
          >
            {t("admin.common.cancel", "Отказ")}
          </button>
        ) : null}
      </div>
    </form>
  );
}

export default AllergenForm;