// src/public/PublicLangSwitcherFlags.tsx
import { Fragment, useMemo } from "react";
import { Listbox, Transition } from "@headlessui/react";
import { usePublicConfig } from "./PublicConfigContext";
import type { AppLang } from "../i18n";

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

function Flag({ lang }: { lang: AppLang }) {
  return (
    <img
      src={FLAG_SRC[lang]}
      alt={lang}
      className="h-5 w-5 rounded-sm object-cover ring-1 ring-black/10"
      loading="lazy"
    />
  );
}

/**
 * Public language switcher (flags only)
 * - Visible only if restaurant has >1 allowed language.
 * - Changes BOTH UI + content language via PublicConfigContext (Variant A).
 */
export default function PublicLangSwitcherFlags() {
  const { langs, lang, setPublicLang } = usePublicConfig();

  const list = useMemo(() => {
    const base = Array.isArray(langs) ? langs : [];
    const uniq = Array.from(new Set(base));
    return uniq.filter((l) => !!FLAG_SRC[l]);
  }, [langs]);

  // show only if > 1 language
  if (list.length <= 1) return null;

  const current: AppLang = (list.includes(lang) ? lang : list[0]) as AppLang;

  return (
    <Listbox value={current} onChange={(v) => setPublicLang(v)}>
      <div className="relative">
        <Listbox.Button
          className={cx(
            "inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-2 py-1.5",
            "hover:bg-white/10 transition focus:outline-none focus:ring-2 focus:ring-white/20"
          )}
          title={current.toUpperCase()}
          aria-label="Language"
        >
          <Flag lang={current} />
          <span className="text-xs text-white/70">▾</span>
        </Listbox.Button>

        <Transition
          as={Fragment}
          enter="transition ease-out duration-120"
          enterFrom="opacity-0 translate-y-1"
          enterTo="opacity-100 translate-y-0"
          leave="transition ease-in duration-100"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <Listbox.Options className="absolute right-0 z-50 mt-2 overflow-hidden rounded-xl border border-white/10 bg-neutral-900 shadow-xl">
            {list.map((l) => (
              <Listbox.Option
                key={l}
                value={l}
                className={({ active }) =>
                  cx(
                    "flex items-center gap-2 px-3 py-2 cursor-pointer select-none",
                    active ? "bg-white/10" : "bg-transparent"
                  )
                }
                title={l.toUpperCase()}
              >
                <Flag lang={l} />
                <span className="text-sm text-white/80">{l.toUpperCase()}</span>
              </Listbox.Option>
            ))}
          </Listbox.Options>
        </Transition>
      </div>
    </Listbox>
  );
}
