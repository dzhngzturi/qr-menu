import api from "../lib/api";
import type { AppLang } from "../i18n";

export async function fetchPublicUi(slug: string) {
  const { data } = await api.get<{ ui_default_lang: AppLang; ui_langs: AppLang[] }>(
    `/menu/${slug}/ui`
  );
  return data;
}
