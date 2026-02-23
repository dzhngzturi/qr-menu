export function MissingTranslationHint({
  title,
  fallbackLabel,
  descFallbackLabel,
  useFallbackLabel,
  copyFallbackTitle,
  fallbackName,
  fallbackDesc,
  disableAll,
  onUseFallback,
}: {
  title: string;
  fallbackLabel: string;

  // ✅ NEW (optional, backward compatible)
  descFallbackLabel?: string;
  fallbackDesc?: string;

  useFallbackLabel: string;
  copyFallbackTitle: string;

  fallbackName: string;
  disableAll: boolean;
  onUseFallback: () => void;
}) {
  const hasName = !!(fallbackName || "").trim();
  const hasDesc = !!(fallbackDesc || "").trim();

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm space-y-2">
      <div className="font-medium text-amber-900">{title}</div>

      {/* name fallback */}
      <div className="text-amber-800">
        {fallbackLabel} <b>{hasName ? fallbackName : "—"}</b>
      </div>

      {/* description fallback (optional) */}
      {(descFallbackLabel || fallbackDesc != null) && (
        <div className="text-amber-800">
          {(descFallbackLabel || "Desc fallback:")}{" "}
          <b>{hasDesc ? fallbackDesc : "—"}</b>
        </div>
      )}

      <button
        type="button"
        disabled={disableAll || !hasName}
        onClick={onUseFallback}
        className={[
          "inline-flex items-center gap-2 px-3 py-2 rounded-lg border bg-white hover:bg-amber-100",
          disableAll ? "opacity-60 cursor-not-allowed" : "",
        ].join(" ")}
        title={copyFallbackTitle}
      >
        {useFallbackLabel}
      </button>
    </div>
  );
}
