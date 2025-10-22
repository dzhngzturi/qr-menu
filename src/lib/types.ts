export type Dish = {
  id: number; name: string; description?: string|null;
  price: number; is_active: boolean; image_url?: string|null;
  category: { id: number; name?: string };
};


export type Category = {
  id: number;
  name: string;
  slug?: string;
  is_active: boolean;
  position?: number;
  image_url?: string | null;
  dishes_count?: number;
  created_at?: string;
};

export type Paginated<T> = {
  data: T[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
};

export type Allergen = { id: number, code: string, name:string, is_active: boolean };