// src/services/allergens.ts
import { apiAdmin } from "../lib/api";
import type { Paginated } from "../lib/types";

export type Allergen = {
  id: number;
  code: string;
  name: string;
  is_active: boolean;
  position?: number;
};

/**
 * Fetch allergens (admin protected)
 * Backend routes (route:list): /api/admin/allergens
 */
export async function fetchAllergens(params?: {
  page?: number;
  sort?: string; // e.g. "position,name"
  search?: string;
  only_active?: 0 | 1;
  per_page?: number; // ако бекенд поддържа
}): Promise<Paginated<Allergen>> {
  const q = new URLSearchParams();
  if (params?.page) q.set("page", String(params.page));
  if (params?.sort) q.set("sort", params.sort);
  if (params?.search) q.set("search", params.search);
  if (params?.only_active != null) q.set("only_active", String(params.only_active));
  if (params?.per_page != null) q.set("per_page", String(params.per_page));

  const { data } = await apiAdmin.get<Paginated<Allergen>>(
    `allergens${q.toString() ? `?${q.toString()}` : ""}`
  );

  return data;
}

export async function createAllergen(payload: {
  code: string;
  name: string;
  is_active: boolean;
}): Promise<Allergen> {
  const { data } = await apiAdmin.post<Allergen>("allergens", {
    code: payload.code,
    name: payload.name,
    is_active: payload.is_active ? 1 : 0,
  });
  return data;
}

export async function updateAllergen(
  id: number,
  payload: {
    code?: string;
    name?: string;
    is_active?: boolean;
  }
): Promise<Allergen> {
  const body: Record<string, unknown> = {};
  if (payload.code != null) body.code = payload.code;
  if (payload.name != null) body.name = payload.name;
  if (payload.is_active != null) body.is_active = payload.is_active ? 1 : 0;

  const { data } = await apiAdmin.patch<Allergen>(`allergens/${id}`, body);
  return data;
}

export async function deleteAllergen(id: number): Promise<void> {
  await apiAdmin.delete(`allergens/${id}`);
}

export async function reorderAllergens(ids: number[]): Promise<void> {
  await apiAdmin.post("allergens/reorder", { ids });
}
