import { apiAdmin } from "../lib/api";
import type { Allergen } from "../lib/types";

export async function fetchPlatformAllergens(params?: { per_page?: number }): Promise<Allergen[]> {
  const q = new URLSearchParams();
  if (params?.per_page != null) q.set("per_page", String(params.per_page));

  const { data } = await apiAdmin.get<{ data: Allergen[] }>(
    `platform/allergens${q.toString() ? `?${q.toString()}` : ""}`
  );

  return data.data ?? [];
}

export async function createPlatformAllergen(payload: Partial<Allergen>) {
  const { data } = await apiAdmin.post<{ data: Allergen }>("platform/allergens", payload);
  return data.data;
}

export async function updatePlatformAllergen(id: number, payload: Partial<Allergen>) {
  const { data } = await apiAdmin.patch<{ data: Allergen }>(`platform/allergens/${id}`, payload);
  return data.data;
}

export async function deletePlatformAllergen(id: number) {
  await apiAdmin.delete(`platform/allergens/${id}`);
}

export async function reorderPlatformAllergens(items: { id: number; position: number }[]) {
  await apiAdmin.post("platform/allergens/reorder", { items });
}
