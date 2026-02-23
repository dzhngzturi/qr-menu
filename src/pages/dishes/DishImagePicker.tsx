import { useRef } from "react";
import { useTranslation } from "react-i18next";

export function DishImagePicker({
  disableAll,
  previewSrc,
  fileName,
  fileSizeLabel,
  dragOver,
  setDragOver,
  onPickFile,
  onRemove,
  onBrowse,
  showWillRemoveHint,
}: {
  disableAll: boolean;
  previewSrc: string | null;
  fileName: string;
  fileSizeLabel: string;
  dragOver: boolean;
  setDragOver: (v: boolean) => void;
  onPickFile: (file: File | null) => void;
  onRemove: () => void;
  onBrowse: () => void;
  showWillRemoveHint: boolean;
}) {
  const { t } = useTranslation();
  const dropRef = useRef<HTMLDivElement>(null);

  return (
    <div>
      <label className="block text-sm mb-1 text-gray-700">{t("admin.dishes.form.photo")}</label>

      <div
        ref={dropRef}
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
          onPickFile(file);
        }}
        className={[
          "rounded-2xl border bg-gray-50/60 p-4 shadow-sm",
          dragOver ? "border-black ring-2 ring-black/10" : "border-gray-200",
          disableAll ? "opacity-60 cursor-not-allowed" : "cursor-pointer",
        ].join(" ")}
        role="button"
        tabIndex={0}
        onClick={() => {
          if (disableAll) return;
          onBrowse();
        }}
        onKeyDown={(e) => {
          if (disableAll) return;
          if (e.key === "Enter" || e.key === " ") onBrowse();
        }}
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

          <div className="text-sm font-semibold text-gray-900">
            {t("admin.dishes.form.upload_title", { defaultValue: "Upload image" })}
          </div>

          <div className="mt-1 text-sm text-gray-600">
            {t("admin.dishes.form.drop_here", { defaultValue: "Drop image here or" })}{" "}
            <span className="font-semibold text-gray-900 underline underline-offset-2">
              {t("admin.dishes.form.browse", { defaultValue: "browse" })}
            </span>
          </div>

          <div className="mt-1 text-xs text-gray-500">
            {t("admin.dishes.form.allowed_types", { defaultValue: "JPG, PNG, WEBP" })}
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {previewSrc ? (
            <div className="flex items-center justify-between rounded-xl border bg-white px-3 py-2 shadow-sm">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-lg border bg-gray-50 overflow-hidden flex items-center justify-center shrink-0">
                  <img
                    src={previewSrc}
                    alt={t("admin.dishes.form.preview_alt") as any}
                    className="h-full w-full object-cover"
                  />
                </div>

                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-gray-900">{fileName}</div>
                  <div className="text-xs text-gray-500">{fileSizeLabel}</div>
                </div>
              </div>

              <button
                type="button"
                disabled={disableAll}
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove();
                }}
                className={[
                  "h-9 w-9 rounded-lg border bg-white hover:bg-gray-50 flex items-center justify-center",
                  disableAll ? "opacity-60 cursor-not-allowed" : "",
                ].join(" ")}
                title={(t("admin.dishes.form.remove_photo") as any) ?? "Remove"}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
                  <path
                    fill="currentColor"
                    d="M9 3h6l1 2h5v2H3V5h5l1-2Zm1 6h2v10h-2V9Zm4 0h2v10h-2V9Z"
                  />
                </svg>
              </button>
            </div>
          ) : (
            <div className="text-xs text-gray-500 text-center">
              {(t("admin.dishes.form.no_file_selected") as any) ?? "No file selected"}
            </div>
          )}
        </div>

        <div className="mt-4">
          <button
            type="button"
            disabled={disableAll}
            onClick={(e) => {
              e.stopPropagation();
              if (disableAll) return;
              onBrowse();
            }}
            className={[
              "w-full rounded-xl py-2.5 text-sm font-semibold",
              "bg-black text-white hover:bg-black/90 transition",
              disableAll ? "opacity-60 cursor-not-allowed" : "",
            ].join(" ")}
          >
            {t("admin.dishes.form.choose_file", { defaultValue: "Choose file" })}
          </button>
        </div>
      </div>

      {showWillRemoveHint && (
        <p className="mt-2 text-xs text-amber-700">
          {(t("admin.dishes.form.will_remove_on_save") as any) ?? "Image will be removed when you save."}
        </p>
      )}
    </div>
  );
}