export function MissingTranslationHint({
  title,
  fallbackLabel,
  useFallbackLabel,
  copyFallbackTitle,
  fallbackName,
  disableAll,
  onUseFallback,
}: {
  title: string;
  fallbackLabel: string;
  useFallbackLabel: string;
  copyFallbackTitle: string;
  fallbackName: string;
  disableAll: boolean;
  onUseFallback: () => void;
}) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm">
      <div className="font-medium text-amber-900">{title}</div>

      <div className="text-amber-800">
        {fallbackLabel} <b>{fallbackName || "—"}</b>
      </div>

      <button
        type="button"
        disabled={disableAll || !fallbackName}
        onClick={onUseFallback}
        className={[
          "mt-2 inline-flex items-center gap-2 px-3 py-2 rounded-lg border bg-white hover:bg-amber-100",
          disableAll ? "opacity-60 cursor-not-allowed" : "",
        ].join(" ")}
        title={copyFallbackTitle}
      >
        {useFallbackLabel}
      </button>
    </div>
  );
}
