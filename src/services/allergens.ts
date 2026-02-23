// src/services/allergens.ts
import { apiAdmin } from "../lib/api";
import type { Paginated, Allergen } from "../lib/types";

export async function fetchAllergens(params?: {
  page?: number;
  sort?: string;
  search?: string;
  only_active?: 0 | 1;
  per_page?: number; // -1
  lang?: string;     // ✅ NEW
  fallback?: string; // ✅ optional
}): Promise<Paginated<Allergen>> {
  const q = new URLSearchParams();

  if (params?.page) q.set("page", String(params.page));
  if (params?.sort) q.set("sort", params.sort);
  if (params?.search) q.set("search", params.search);
  if (params?.only_active != null) q.set("only_active", String(params.only_active));
  if (params?.per_page != null) q.set("per_page", String(params.per_page));

  // ✅ NEW
  if (params?.lang) q.set("lang", params.lang);
  if (params?.fallback) q.set("fallback", params.fallback);

  const { data } = await apiAdmin.get<Paginated<Allergen> | Allergen[]>(
    `allergens${q.toString() ? `?${q.toString()}` : ""}`
  );

  if ((data as Paginated<Allergen>)?.data) return data as Paginated<Allergen>;

  const arr = data as Allergen[];
  return {
    data: arr,
    meta: { current_page: 1, last_page: 1, per_page: arr.length, total: arr.length },
  };
}