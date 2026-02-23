export function LanguageTabs({
  langs = [],
  activeLang,
  nameByLang = {},
  disableAll,
  onPick,
}: {
  langs?: string[];
  activeLang: string;
  nameByLang?: Record<string, string>;
  disableAll: boolean;
  onPick: (lang: string) => void;
}) {
  if (!Array.isArray(langs) || langs.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {langs.map((l) => {
        const on = activeLang === l;
        const filled = (nameByLang[l] || "").trim().length > 0;

        return (
          <button
            key={l}
            type="button"
            onClick={() => onPick(l)}
            disabled={disableAll}
            className={[
              "px-3 py-1.5 rounded-full border text-sm transition relative",
              "shadow-sm",
              on
                ? "bg-black text-white border-black ring-2 ring-black/20"
                : "bg-white hover:bg-gray-50 border-gray-300",
              filled && !on ? "border-gray-400" : "",
              disableAll ? "opacity-60 cursor-not-allowed" : "",
            ].join(" ")}
            title={filled ? `${l.toUpperCase()}: has translation` : `${l.toUpperCase()}: missing translation`}
          >
            <span className="inline-flex items-center gap-2">
              <span
                className={[
                  "inline-block w-2 h-2 rounded-full",
                  filled ? "bg-emerald-500" : "bg-gray-300",
                  on ? "outline outline-2 outline-white/30" : "",
                ].join(" ")}
              />
              {l.toUpperCase()}
            </span>
          </button>
        );
      })}
    </div>
  );
}
