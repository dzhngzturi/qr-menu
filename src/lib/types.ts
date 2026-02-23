export type Dish = {
  id: number; name: string; description?: string | null;
  price: number; is_active: boolean; image_url?: string | null;
  portion_value?: number | null; portion_unit?: "g" | "ml" | null;
  allergens?: Allergen[];
  category: { id: number; name?: string };
};

export type CategoryTranslation = {
lang: string;
name: string;
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

  translations?: Record<string, {
    name: string;
  }>;
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

export type AllergenTranslation = {
  lang: string;
  name: string;
};

export type Allergen = {
  id: number;
  code: string;
  is_active: boolean;
  position?: number;
  image_url?: string | null;

  // ✅ новата i18n структура (като backend)
  translations: AllergenTranslation[];

  // optional legacy (ако някъде още го показваш временно)
  name?: string;
};



// ------------------ TELEMETRY ------------------

export type TelemetryEventByDay = {
  date: string;
  qr_scan: number;
  menu_open: number;
  search: number;
};

export type TelemetryTopSearch = {
  term: string;
  count: number;
};

export type TelemetryEventByHour = {
  hour: number; // 0..23
  qr_scan: number;
  menu_open: number;
  search: number;
  all: number;
};

export type TelemetryOverview = {
  range: { from: string; to: string; days: number };
  totals: {
    all: number;
    qr_scan: number;
    menu_open: number;
    search: number;
  };
  events_by_day: TelemetryEventByDay[];
  events_by_hour: TelemetryEventByHour[];   // ✅ ADD
  popular_searches: TelemetryTopSearch[];
};