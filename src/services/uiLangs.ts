// src/services/uiLangs.ts
import { apiAdmin } from "../lib/api";

export type UiLangsDTO = {
  ui_default_lang: string;
  ui_langs: string[];
};

/** restaurant scoped (read) */
export async function fetchUiLangs(slug: string) {
  const { data } = await apiAdmin.get<{ ui_default_lang: string; ui_langs: string[] }>(
    `restaurants/${slug}/langs/ui`
  );
  return data;
}

/** restaurant scoped (write) - superadmin */
export async function saveUiLangs(slug: string, payload: UiLangsDTO) {
  const { data } = await apiAdmin.put(
    `platform/restaurants/${slug}/langs/ui`,
    payload
  );
  return data;
}

/** PLATFORM allowed UI langs (stored in master restaurant settings) */
export async function fetchPlatformUiLangs() {
  const { data } = await apiAdmin.get<{ ui_default_lang: string; ui_langs: string[] }>(
    `platform/langs/ui`
  );
  return data;
}

export async function savePlatformUiLangs(payload: UiLangsDTO) {
  const { data } = await apiAdmin.put(`platform/langs/ui`, payload);
  return data;
}
