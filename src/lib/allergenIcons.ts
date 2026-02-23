function normalizeCode(code?: string | null) {
  return String(code || "").trim().toUpperCase();
}

export function allergenIconUrl(code?: string | null): string | null {
  const c = normalizeCode(code);
  if (!c) return null;

  // файловете са в public/allergens/
  return `/allergens/${c}.svg`;
}
