// src/pages/dishes/dishI18n.ts
import type { DishTranslationInput } from "../../services/dishes";

export type DishTransMap = Record<string, { name?: string; description?: string }>;

export function normalizeTranslationsToMap(t: any): DishTransMap {
  const out: DishTransMap = {};
  if (!t) return out;

  // 1) [{lang:"en", name:"...", description:"..."}, ...]
  if (Array.isArray(t)) {
    for (const row of t) {
      const lang = String(row?.lang || "").trim().toLowerCase();
      if (!lang) continue;
      out[lang] = {
        name: row?.name != null ? String(row.name) : "",
        description: row?.description != null ? String(row.description) : "",
      };
    }
    return out;
  }

  // 2) {"en": {"name":"...","description":"..."}, ...}
  if (typeof t === "object") {
    for (const k of Object.keys(t)) {
      const lang = String(k || "").trim().toLowerCase();
      if (!lang) continue;
      out[lang] = {
        name: t?.[k]?.name != null ? String(t[k].name) : "",
        description: t?.[k]?.description != null ? String(t[k].description) : "",
      };
    }
  }

  return out;
}

export function buildTranslationsArray(
  langs: string[],
  nameByLang: Record<string, string>,
  descByLang: Record<string, string>
): DishTranslationInput[] {
  return langs
    .map((l) => {
      const lang = String(l).trim().toLowerCase();
      return {
        lang,
        name: String(nameByLang[lang] || "").trim(),
        description: String(descByLang[lang] || "").trim(),
      };
    })
    .filter((x) => !!x.lang && !!x.name);
}
