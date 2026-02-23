import { apiAdmin } from "../lib/api";

export type RestaurantAllergenConfig = {
  show_allergens: boolean;
  allergen_ids: number[];
};

export async function fetchRestaurantAllergens(slug: string): Promise<RestaurantAllergenConfig> {
  const { data } = await apiAdmin.get<{ data: RestaurantAllergenConfig }>(
    `platform/restaurants/${slug}/allergens`
  );
  return data.data;
}

export async function updateRestaurantAllergens(
  slug: string,
  payload: { show_allergens: boolean; allergen_ids?: number[]; select_all?: boolean }
) {
  await apiAdmin.put(`platform/restaurants/${slug}/allergens`, payload);
}
