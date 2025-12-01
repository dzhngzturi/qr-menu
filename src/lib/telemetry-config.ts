// src/config/telemetry-config.ts

// Кои ресторанти ИМАТ телеметрия (allow-list).
// По подразбиране НЯМА телеметрия.
export const TELEMETRY_ENABLED_FOR = new Set<string>([
  //"viva",
  //"avva",
  // добавяй тук други slug-ове
  "eres",
  
]);

// Проверка по slug (без localStorage)
export function isTelemetryEnabledSlug(slug?: string | null): boolean {
  if (!slug) return false;
  return TELEMETRY_ENABLED_FOR.has(slug.toLowerCase());
}
