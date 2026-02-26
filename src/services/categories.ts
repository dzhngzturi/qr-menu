// src/services/categories.ts
import { apiAdmin } from "../lib/api";
import type { Category, Paginated } from "../lib/types";

export type CategoryTranslationInput = {
  lang: string;
  name: string;
};

export type CategoryUpsertPayload = {
  name: string;
  is_active: boolean;
  image?: File;
  remove_image?: boolean; // ✅ NEW
  translations?: CategoryTranslationInput[];
};

function appendTranslations(form: FormData, translations?: CategoryTranslationInput[]) {
  if (!translations?.length) return;

  translations.forEach((t, i) => {
    const lang = String(t.lang || "").trim().toLowerCase();
    const name = String(t.name || "").trim();
    if (!lang || !name) return;

    form.append(`translations[${i}][lang]`, lang);
    form.append(`translations[${i}][name]`, name);
  });
}

export async function fetchCategories(params?: {
  page?: number;
  sort?: string;
  only_active?: 0 | 1;
  per_page?: number;
}) {
  const q = new URLSearchParams();
  if (params?.page) q.set("page", String(params.page));
  if (params?.sort) q.set("sort", params.sort);
  if (params?.only_active != null) q.set("only_active", String(params.only_active));
  if (params?.per_page != null) q.set("per_page", String(params.per_page));

  const { data } = await apiAdmin.get<Paginated<Category> | Category[]>(
    `categories${q.toString() ? `?${q.toString()}` : ""}`
  );

  if ((data as Paginated<Category>)?.data) return data as Paginated<Category>;

  const arr = data as Category[];
  return {
    data: arr,
    meta: {
      current_page: 1,
      last_page: 1,
      per_page: arr.length,
      total: arr.length,
    },
  };
}

export async function createCategory(payload: CategoryUpsertPayload) {
  const form = new FormData();
  form.append("name", payload.name);
  form.append("is_active", payload.is_active ? "1" : "0");
  if (payload.image) form.append("image", payload.image);

  // ✅ NEW (не е задължително при create, но не пречи)
  if (payload.remove_image) form.append("remove_image", "1");

  appendTranslations(form, payload.translations);

  const { data } = await apiAdmin.post<Category>("categories", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return data;
}

export async function updateCategory(id: number, payload: Partial<CategoryUpsertPayload>) {
  const form = new FormData();

  if (payload.name != null) form.append("name", payload.name);
  if (payload.is_active != null) form.append("is_active", payload.is_active ? "1" : "0");
  if (payload.image) form.append("image", payload.image);

  // ✅ NEW: delete image flag
  if (payload.remove_image) form.append("remove_image", "1");

  if (payload.translations) {
    appendTranslations(form, payload.translations);
  }

  const { data } = await apiAdmin.post<Category>(`categories/${id}?_method=PATCH`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return data;
}

export async function deleteCategory(id: number) {
  await apiAdmin.delete(`categories/${id}`);
}

export async function reorderCategories(ids: number[]) {
  await apiAdmin.post("categories/reorder", { ids });
}