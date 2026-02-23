import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import bgCommon from "./locales/bg/common.json";
import enCommon from "./locales/en/common.json";
import deCommon from "./locales/de/common.json";
import frCommon from "./locales/fr/common.json";
import trCommon from "./locales/tr/common.json";

export const SUPPORTED_LANGS = ["bg", "en", "de", "fr", "tr"] as const;
export type AppLang = (typeof SUPPORTED_LANGS)[number];

function normalizeLang(raw: string | null | undefined): AppLang {
  const v = (raw || "").toLowerCase().trim();
  if ((SUPPORTED_LANGS as readonly string[]).includes(v)) return v as AppLang;
  const base = v.split("-")[0];
  if ((SUPPORTED_LANGS as readonly string[]).includes(base)) return base as AppLang;
  return "bg";
}

export function getInitialLang(): AppLang {
  const url = new URL(window.location.href);
  const fromQuery = url.searchParams.get("lang");
  if (fromQuery) return normalizeLang(fromQuery);

  const fromStorage = localStorage.getItem("lang");
  if (fromStorage) return normalizeLang(fromStorage);

  return normalizeLang(navigator.language);
}

export function setLang(lang: AppLang) {
  localStorage.setItem("lang", lang);
  i18n.changeLanguage(lang);
  document.documentElement.lang = lang;
}

i18n.use(initReactI18next).init({
  resources: {
    bg: { common: bgCommon },
    en: { common: enCommon },
    de: { common: deCommon },
    fr: { common: frCommon },
    tr: { common: trCommon },
  },

  // ✅ IMPORTANT
  ns: ["common"],
  defaultNS: "common",

  lng: getInitialLang(),
  fallbackLng: "en",

  interpolation: { escapeValue: false },

  // ✅ helpful defaults (so UI never shows "null")
  returnNull: false,
  returnEmptyString: false,
});

export default i18n;
