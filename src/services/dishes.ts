// src/services/dishes.ts
import { apiAdmin } from "../lib/api";
import type { Dish, Paginated } from "../lib/types";

export async function fetchDishes(params?: {
  page?: number;
  sort?: string; // напр. "position,name"
  category_id?: number;
  search?: string;
  per_page?: number; // -1 за всички (ако бекенд го поддържа)
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

  // paginator
  if ((data as Paginated<Dish>)?.data) return data as Paginated<Dish>;

  // plain array
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

export async function createDish(payload: {
  name: string;
  category_id: number;
  description?: string;
  price: number;
  is_active: boolean;
  image?: File;
  remove_image?: boolean; // (за консистентност, реално няма смисъл при create)
}) {
  const form = new FormData();
  form.append("name", payload.name);
  form.append("category_id", String(payload.category_id));
  form.append("price", String(payload.price));
  form.append("description", payload.description ?? "");
  form.append("is_active", payload.is_active ? "1" : "0");
  if (payload.image) form.append("image", payload.image);
  if (payload.remove_image) form.append("remove_image", "1");

  const { data } = await apiAdmin.post<Dish>("dishes", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return data;
}

export async function updateDish(
  id: number,
  payload: {
    name?: string;
    category_id?: number;
    description?: string;
    price?: number;
    is_active?: boolean;
    image?: File;
    remove_image?: boolean;
  }
) {
  const form = new FormData();
  if (payload.name != null) form.append("name", payload.name);
  if (payload.category_id != null) form.append("category_id", String(payload.category_id));
  if (payload.price != null) form.append("price", String(payload.price));
  if (payload.description != null) form.append("description", payload.description);
  if (payload.is_active != null) form.append("is_active", payload.is_active ? "1" : "0");
  if (payload.image) form.append("image", payload.image);
  if (payload.remove_image) form.append("remove_image", "1");

  // NOTE: използваме _method=PATCH както при categories
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
