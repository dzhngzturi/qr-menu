// src/services/dishes.ts
import { apiAdmin } from "../lib/api";
import type { Dish, Paginated } from "../lib/types";

export type DishTranslationInput = {
  lang: string;
  name: string;
  description?: string;
};

export type DishUpsertPayload = {
  name: string; // legacy (defaultLang)
  category_id: number;
  description?: string; // legacy (defaultLang)
  price: number;
  is_active: boolean;

  // ✅ NEW
  portion_value?: number | null;
  portion_unit?: "g" | "ml" | null | "";

  // ✅ NEW
  allergen_ids?: number[];

  image?: File;
  remove_image?: boolean;
  translations?: DishTranslationInput[];
};

function appendTranslations(form: FormData, translations?: DishTranslationInput[]) {
  if (!translations?.length) return;

  translations.forEach((t, i) => {
    const lang = String(t.lang || "").trim().toLowerCase();
    const name = String(t.name || "").trim();
    const description = t.description != null ? String(t.description).trim() : "";

    if (!lang || !name) return;

    form.append(`translations[${i}][lang]`, lang);
    form.append(`translations[${i}][name]`, name);
    form.append(`translations[${i}][description]`, description);
  });
}

function appendPortion(form: FormData, payload: Partial<DishUpsertPayload>) {
  // send only if unit is valid
  const unit = payload.portion_unit === "g" || payload.portion_unit === "ml" ? payload.portion_unit : "";
  const val =
    payload.portion_value !== null &&
    payload.portion_value !== undefined &&
    Number.isFinite(payload.portion_value)
      ? String(payload.portion_value)
      : "";

  if (unit && val) {
    form.append("portion_value", val);
    form.append("portion_unit", unit);
  } else {
    // if editing and user cleared portion -> allow clearing
    if (payload.portion_value === null) form.append("portion_value", "");
    if (payload.portion_unit === null || payload.portion_unit === "") form.append("portion_unit", "");
  }
}

function appendAllergens(form: FormData, ids?: number[]) {
  if (!ids) return;
  // backend friendly: allergen_ids[0]=1 ...
  ids.forEach((id, i) => form.append(`allergen_ids[${i}]`, String(id)));
}

export async function fetchDishes(params?: {
  page?: number;
  sort?: string; // "position,name"
  category_id?: number;
  search?: string;
  per_page?: number;
}) {
  const q = new URLSearchParams();
  if (params?.page) q.set("page", String(params.page));
  if (params?.sort) q.set("sort", params.sort);
  if (params?.category_id) q.set("category_id", String(params.category_id));
  if (params?.search) q.set("search", params.search);
  if (params?.per_page != null) q.set("per_page", String(params.per_page));

  const { data } = await apiAdmin.get<Paginated<Dish> | Dish[]>(
    `dishes${q.toString() ? `?${q.toString()}` : ""}`
  );

  if ((data as Paginated<Dish>)?.data) return data as Paginated<Dish>;

  const arr = data as Dish[];
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

export async function createDish(payload: DishUpsertPayload) {
  const form = new FormData();
  form.append("name", payload.name);
  form.append("category_id", String(payload.category_id));
  form.append("price", String(payload.price));
  form.append("description", payload.description ?? "");
  form.append("is_active", payload.is_active ? "1" : "0");

  // ✅ NEW
  appendPortion(form, payload);
  appendAllergens(form, payload.allergen_ids);

  if (payload.image) form.append("image", payload.image);
  if (payload.remove_image) form.append("remove_image", "1");

  appendTranslations(form, payload.translations);

  const { data } = await apiAdmin.post<Dish>("dishes", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return data;
}

export async function updateDish(id: number, payload: Partial<DishUpsertPayload>) {
  const form = new FormData();

  if (payload.name != null) form.append("name", payload.name);
  if (payload.category_id != null) form.append("category_id", String(payload.category_id));
  if (payload.price != null) form.append("price", String(payload.price));
  if (payload.description != null) form.append("description", payload.description);
  if (payload.is_active != null) form.append("is_active", payload.is_active ? "1" : "0");

  // ✅ NEW
  appendPortion(form, payload);
  if (payload.allergen_ids) appendAllergens(form, payload.allergen_ids);

  if (payload.image) form.append("image", payload.image);
  if (payload.remove_image) form.append("remove_image", "1");

  if (payload.translations) appendTranslations(form, payload.translations);

  const { data } = await apiAdmin.post<Dish>(`dishes/${id}?_method=PATCH`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return data;
}

export async function deleteDish(id: number) {
  await apiAdmin.delete(`dishes/${id}`);
}

export async function reorderDishes(ids: number[], category_id?: number) {
  await apiAdmin.post("dishes/reorder", {
    ids,
    category_id: category_id ?? undefined,
  });
}
