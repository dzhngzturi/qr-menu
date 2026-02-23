// src/pages/categories/categoryI18n.ts
import type { CategoryTranslationInput } from "../../services/categories";

export type CategoryTransMap = Record<string, { name?: string }>;

export function normalizeTranslationsToMap(t: any): Record<string, { name?: string }> {
  const out: Record<string, { name?: string }> = {};
  if (!t) return out;

  // 1) [{lang:"en", name:"..."}, ...]
  if (Array.isArray(t)) {
    for (const row of t) {
      const lang = String(row?.lang || "").trim().toLowerCase();
      const name = row?.name != null ? String(row.name) : "";
      if (lang) out[lang] = { name };
    }
    return out;
  }

  // 2) {"en": {"name":"..."}, "bg": {"name":"..."}}
  if (typeof t === "object") {
    for (const k of Object.keys(t)) {
      const lang = String(k || "").trim().toLowerCase();
      const name = t?.[k]?.name != null ? String(t[k].name) : "";
      if (lang) out[lang] = { name };
    }
  }

  return out;
}

export function buildTranslationsArray(langs: string[], nameByLang: Record<string, string>): CategoryTranslationInput[] {
  return langs
    .map((lang) => ({
      lang: String(lang).trim().toLowerCase(),
      name: String(nameByLang[String(lang).toLowerCase()] || "").trim(),
    }))
    .filter((t) => !!t.lang && !!t.name);
}
