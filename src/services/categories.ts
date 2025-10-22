import api from "../lib/api";
import type { Category, Paginated } from "../lib/types";

export async function fetchCategories(params?: {
  page?: number;
  sort?: string;
  only_active?: 0 | 1;
}) {
  const q = new URLSearchParams();
  if (params?.page) q.set("page", String(params.page));
  if (params?.sort) q.set("sort", params.sort);
  if (params?.only_active != null) q.set("only_active", String(params.only_active));

  const { data } = await api.get<Paginated<Category> | Category[]>(
    `/categories${q.toString() ? `?${q.toString()}` : ""}`
  );

  // ако бекендът връща пагинация:
  if ((data as Paginated<Category>).data) return data as Paginated<Category>;
  // иначе plain масив
  return { data: data as Category[], meta: { current_page:1, last_page:1, per_page:(data as Category[]).length, total:(data as Category[]).length } };
}

export async function createCategory(payload: {
  name: string;
  is_active: boolean;
  image?: File;
}) {
  const form = new FormData();
  form.append("name", payload.name);
  form.append("is_active", payload.is_active ? "1" : "0");
  if (payload.image) form.append("image", payload.image);
  const { data } = await api.post<Category>("/categories", form);
  return data;
}

export async function updateCategory(id: number, payload: {
  name?: string;
  is_active?: boolean;
  image?: File;
}) {
  const form = new FormData();
  if (payload.name != null) form.append("name", payload.name);
  if (payload.is_active != null) form.append("is_active", payload.is_active ? "1" : "0");
  if (payload.image) form.append("image", payload.image);
  const { data } = await api.post<Category>(`/categories/${id}?_method=PATCH`, form);
  return data;
}

export async function deleteCategory(id: number) {
  await api.delete(`/categories/${id}`);
}

export async function reorderCategories(ids: number[]) {
  await api.post("/categories/reorder", { ids });
}
