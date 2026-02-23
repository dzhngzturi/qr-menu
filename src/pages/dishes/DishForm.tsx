// src/pages/dishes/DishForm.tsx
import { Controller } from "react-hook-form";

import AppSelect from "../../components/AppSelect";
import AppMultiSelect from "../../components/AppMultiSelect";
import { DishImagePicker } from "./DishImagePicker";
import { LanguageTabs } from "./LanguageTabs";
import { MissingTranslationHint } from "./MissingTranslationHint";
import type { UseDishesPageVM } from "./hooks/useDishesPage";

export function DishForm({ vm }: { vm: UseDishesPageVM }) {
  const previewSrc = vm.preview ?? vm.editing?.image_url ?? null;

  // stable ids
  const idName = "dish-name";
  const idPrice = "dish-price";
  const idDesc = "dish-description";
  const idImage = "dish-image";
  const idActiveLabel = "dish-active-label";
  const idPortionLabel = "dish-portion-label";
  const idAllergensLabel = "dish-allergens-label";

  // ✅ show allergens ONLY if restaurant has allergens
  const hasAllergens = (vm.allergenOptions?.length ?? 0) > 0;

  return (
    <form
      onSubmit={vm.handleSubmit(vm.onSubmit)}
      className="rounded-2xl border bg-white p-4 shadow-sm space-y-4"
    >
      <LanguageTabs
        langs={vm.list}
        activeLang={vm.activeLang}
        nameByLang={vm.nameByLang}
        disableAll={vm.disableAll}
        onPick={vm.setActiveLang}
      />

      <div className="grid gap-3 grid-cols-1 sm:grid-cols-6 items-end">
        {/* name */}
        <div className="sm:col-span-2">
          <label className="block text-sm mb-1 text-gray-700" htmlFor={idName}>
            {vm.t("admin.dishes.form.name")} ({vm.activeLabel})
          </label>
          <input
            id={idName}
            className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-black/10"
            value={vm.nameByLang[vm.activeLang] ?? ""}
            onChange={(e) =>
              vm.setNameByLang((p) => ({ ...p, [vm.activeLang]: e.target.value }))
            }
            disabled={vm.disableAll}
            placeholder={`${vm.t("admin.dishes.form.name")} (${vm.activeLabel})`}
            autoComplete="off"
          />
        </div>

        {/* category */}
        <div className="sm:col-span-3 min-w-0">
          <div className="block text-sm mb-1 text-gray-700">
            {vm.t("admin.dishes.form.pick_category")}
          </div>

          <div className="h-11 flex items-stretch [&_button]:h-11">
            <Controller
              control={vm.control}
              name="category_id"
              rules={{
                validate: (v) =>
                  v && v > 0 ? true : vm.t("admin.dishes.errors.pick_category"),
              }}
              render={({ field }) => (
                <AppSelect<number>
                  value={field.value ?? 0}
                  onChange={(val) => field.onChange(Number(val))}
                  options={[
                    { value: 0, label: vm.t("admin.dishes.form.pick_category") },
                    ...vm.categoryOptions,
                  ]}
                  placeholder={vm.t("admin.dishes.form.pick_category")}
                  disabled={vm.disableAll}
                  buttonClassName="h-11 w-full rounded-lg px-3 border border-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                />
              )}
            />
          </div>
        </div>

        {/* price */}
        <div className="sm:col-span-1 min-w-0">
          <label className="block text-sm mb-1 text-gray-700" htmlFor={idPrice}>
            {vm.t("admin.dishes.form.price")}
          </label>
          <input
            id={idPrice}
            type="number"
            step="0.01"
            min={0}
            inputMode="decimal"
            className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-black/10"
            {...vm.register("price", {
              valueAsNumber: true,
              required: vm.t("admin.dishes.errors.price_required"),
              min: {
                value: 0,
                message: vm.t("admin.dishes.errors.price_non_negative"),
              },
              validate: (v) =>
                Number.isFinite(v) ? true : vm.t("admin.dishes.errors.price_required"),
            })}
            disabled={vm.disableAll}
          />
          {vm.errors.price && (
            <p className="mt-1 text-xs text-red-600">{String(vm.errors.price.message)}</p>
          )}
        </div>

        {/* active */}
        <div className="sm:col-span-2 min-w-0">
          <div className="block text-sm mb-1 text-gray-700" id={idActiveLabel}>
            {vm.t("admin.dishes.form.active")}
          </div>

          <Controller
            control={vm.control}
            name="is_active"
            render={({ field }) => (
              <div
                className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 shadow-sm flex items-center justify-between"
                aria-labelledby={idActiveLabel}
              >
                <span className="text-sm font-medium text-gray-800">
                  {field.value ? vm.t("admin.common.on") : vm.t("admin.common.off")}
                </span>

                <button
                  type="button"
                  disabled={vm.disableAll}
                  onClick={() => !vm.disableAll && field.onChange(!field.value)}
                  className={[
                    "relative inline-flex h-6 w-11 items-center rounded-full transition",
                    field.value ? "bg-emerald-500" : "bg-gray-300",
                    vm.disableAll ? "opacity-60 cursor-not-allowed" : "cursor-pointer",
                  ].join(" ")}
                  aria-pressed={!!field.value}
                  aria-labelledby={idActiveLabel}
                >
                  <span
                    className={[
                      "inline-block h-5 w-5 transform rounded-full bg-white shadow transition",
                      field.value ? "translate-x-5" : "translate-x-1",
                    ].join(" ")}
                  />
                </button>
              </div>
            )}
          />
        </div>

        {/* image */}
        <div className="sm:col-span-4 min-w-0">
          <input
            id={idImage}
            type="file"
            accept="image/*"
            {...vm.imageRegister}
            ref={(el) => {
              vm.imageInputRef.current = el;
              vm.imageRegister.ref(el);
            }}
            onChange={(e) => {
              vm.imageRegister.onChange(e);
              const file = e.target.files?.[0] ?? null;
              vm.applyImageFile(file);
              if (file) vm.onDropFile(file);
            }}
            className="hidden"
            disabled={vm.disableAll}
          />

          <DishImagePicker
            disableAll={vm.disableAll}
            previewSrc={previewSrc}
            fileName={vm.fileName}
            fileSizeLabel={vm.fileSizeLabel}
            dragOver={vm.dragOver}
            setDragOver={vm.setDragOver}
            onPickFile={(file) => {
              vm.applyImageFile(file);
              if (file) vm.onDropFile(file);
            }}
            onRemove={() => vm.clearPreview(true)}
            onBrowse={vm.onBrowse}
            showWillRemoveHint={vm.removeImage}
          />
        </div>

        {/* allergens */}
        {hasAllergens && (
          <div className="sm:col-span-2 min-w-0">
            <div className="block text-sm mb-1 text-gray-700" id={idAllergensLabel}>
              {vm.t("admin.dishes.form.allergens")}{" "}
              <span className="text-gray-400">({vm.t("admin.common.optional")})</span>
            </div>

            <Controller
              control={vm.control}
              name="allergen_ids"
              render={({ field }) => (
                <AppMultiSelect<number>
                  value={(field.value ?? []) as number[]}
                  onChange={(vals) => field.onChange(vals)}
                  options={vm.allergenOptions ?? []}
                  placeholder={vm.t("admin.dishes.form.pick_allergens")}
                  disabled={vm.disableAll}
                  buttonClassName="h-11 w-full rounded-lg px-3 border border-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                  maxButtonLabels={2}
                />
              )}
            />
          </div>
        )}

        {/* portion */}
        <div className="sm:col-span-6">
          <div className="block text-sm mb-1 text-gray-700" id={idPortionLabel}>
            {vm.t("admin.dishes.form.portion")}{" "}
            <span className="text-gray-400">({vm.t("admin.common.optional")})</span>
          </div>

          <div className="flex gap-2 max-w-md">
            <div className="min-w-0 flex-1">
              <input
                type="number"
                min={0}
                step={1}
                className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                {...vm.register("portion_value", {
                  valueAsNumber: true,
                  setValueAs: (v) => (v === "" || v == null ? null : Number(v)),
                  min: {
                    value: 0,
                    message: vm.t("admin.dishes.errors.portion_non_negative", {
                      defaultValue: "Portion cannot be negative.",
                    }),
                  },
                })}
                disabled={vm.disableAll}
                placeholder="250"
                aria-labelledby={idPortionLabel}
              />

              {vm.errors.portion_value && (
                <p className="mt-1 text-xs text-red-600">
                  {String(vm.errors.portion_value.message)}
                </p>
              )}
            </div>

            <select
              className="h-11 rounded-lg border border-gray-300 bg-white px-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-black/10"
              {...vm.register("portion_unit", {
                validate: (u) => {
                  const v = vm.watch("portion_value"); // number | null | undefined
                  const hasValue =
                    typeof v === "number" && Number.isFinite(v) && v > 0;

                  // ако няма въведена порция, unit НЕ е задължителен
                  if (!hasValue) return true;

                  // ако има порция -> unit е задължителен (g/ml)
                  return u === "g" || u === "ml"
                    ? true
                    : vm.t("admin.dishes.errors.pick_portion_unit", {
                        defaultValue: "Моля, изберете мерна единица (g или ml).",
                      });
                },
              })}
              disabled={vm.disableAll}
              aria-labelledby={idPortionLabel}
            >
              <option value="">{vm.t("admin.common.select")}</option>
              <option value="g">{vm.t("admin.dishes.units.g")}</option>
              <option value="ml">{vm.t("admin.dishes.units.ml")}</option>
            </select>
          </div>

          {/* ✅ show validation message under the row */}
          {vm.errors.portion_unit && (
            <p className="mt-1 text-xs text-red-600">
              {String(vm.errors.portion_unit.message)}
            </p>
          )}
        </div>
      </div>

      {/* description */}
      <div>
        <label className="block text-sm mb-1 text-gray-700" htmlFor={idDesc}>
          {vm.t("admin.dishes.form.description")} ({vm.activeLabel})
        </label>
        <textarea
          id={idDesc}
          className="w-full rounded-lg border border-gray-300 bg-white p-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-black/10"
          rows={3}
          value={vm.descByLang[vm.activeLang] ?? ""}
          onChange={(e) =>
            vm.setDescByLang((p) => ({ ...p, [vm.activeLang]: e.target.value }))
          }
          disabled={vm.disableAll}
          placeholder={`${vm.t("admin.dishes.form.description")} (${vm.activeLabel})`}
        />
      </div>

      {vm.nameMissing && (
        <MissingTranslationHint
          title={vm.tMissingTitle}
          fallbackLabel={vm.tFallbackLabel}
          useFallbackLabel={vm.tUseFallback}
          copyFallbackTitle={vm.tCopyFallbackTitle}
          disableAll={vm.disableAll}
          fallbackName={vm.fallbackName}
          onUseFallback={vm.onUseFallback}
        />
      )}

      {vm.active !== vm.defLang && (
        <p className="text-xs text-gray-500">
          {vm.t("admin.dishes.legacy_hint", {
            defaultValue:
              "Legacy name/description are stored from {{lang}} (for consistency/uniqueness).",
            lang: vm.defLang.toUpperCase(),
          })}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          className={`px-4 py-2 rounded-lg text-white bg-black hover:bg-black/90 transition ${
            vm.disableAll || !vm.isValid ? "opacity-60 cursor-not-allowed" : ""
          }`}
          disabled={vm.disableAll || !vm.isValid}
        >
          {vm.editing ? vm.t("admin.common.save") : vm.t("admin.common.create")}
        </button>

        {vm.editing && (
          <button
            type="button"
            className={`px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition ${
              vm.disableAll ? "opacity-60 cursor-not-allowed" : ""
            }`}
            disabled={vm.disableAll}
            onClick={vm.resetAll}
          >
            {vm.t("admin.common.cancel")}
          </button>
        )}
      </div>
    </form>
  );
}
