import { Fragment, useEffect, useMemo } from "react";
import { Listbox, Transition } from "@headlessui/react";
import { useTranslation } from "react-i18next";
import i18n, { setLang, SUPPORTED_LANGS, type AppLang } from "../i18n";

const FLAG_SRC: Record<AppLang, string> = {
  bg: "/flags/bg.svg",
  en: "/flags/en.svg",
  de: "/flags/de.svg",
  fr: "/flags/fr.svg",
  tr: "/flags/tr.svg",
};

function cx(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(" ");
}

function Flag({ src, alt }: { src: string; alt: string }) {
  return (
    <img
      src={src}
      alt={alt}
      className="h-4 w-4 rounded-sm object-cover ring-1 ring-black/10"
      loading="lazy"
    />
  );
}

// ✅ Приема langs (динамично) от вашата логика
export default function LanguageSwitcherFancy({ langs }: { langs?: AppLang[] }) {
  const { t, i18n: i18nRT } = useTranslation();

  // dynamic list: ако има подадени langs -> тях, иначе SUPPORTED_LANGS
  const list = useMemo(() => {
    const base = (langs && langs.length ? langs : SUPPORTED_LANGS) as AppLang[];
    // unique + remove unknown
    return Array.from(new Set(base)).filter((l) => !!FLAG_SRC[l]);
  }, [langs]);

  // текущ език (само prefix bg от bg-BG)
  const raw = (i18nRT.language || i18n.language || "bg").split("-")[0] as AppLang;

  // ако текущият не е позволен, падаме на първия разрешен
  const current: AppLang = (list.includes(raw) ? raw : list[0]) ?? "bg";

  // update <html lang="">
  useEffect(() => {
    document.documentElement.lang = current || "bg";
  }, [current]);

  // ✅ преводим етикет от JSON: language.bg / language.en / ...
  const labelOf = (l: AppLang) =>
    t(`language.${l}`, { defaultValue: l.toUpperCase() });

  return (
    <Listbox value={current} onChange={(v) => setLang(v)}>
      <div className="relative w-44">
        <Listbox.Button
          className={cx(
            "flex w-full items-center justify-between gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm hover:bg-gray-50",
            "focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black/30"
          )}
        >
          <span className="flex items-center gap-2 min-w-0">
            <Flag src={FLAG_SRC[current]} alt={current} />
            <span className="truncate">{labelOf(current)}</span>
          </span>
          <span className="text-xs opacity-60">▾</span>
        </Listbox.Button>

        <Transition
          as={Fragment}
          leave="transition ease-in duration-100"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <Listbox.Options className="absolute right-0 z-50 mt-1 w-full overflow-hidden rounded-lg bg-white shadow-lg ring-1 ring-black/10">
            {list.map((l) => (
              <Listbox.Option
                key={l}
                value={l}
                className={({ active }) =>
                  cx(
                    "px-3 py-2 text-sm flex items-center gap-2 cursor-pointer",
                    active && "bg-gray-100"
                  )
                }
              >
                <Flag src={FLAG_SRC[l]} alt={l} />
                <span className="truncate">{labelOf(l)}</span>
              </Listbox.Option>
            ))}
          </Listbox.Options>
        </Transition>
      </div>
    </Listbox>
  );
}
