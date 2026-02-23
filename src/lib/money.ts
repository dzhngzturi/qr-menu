// src/lib/money.ts
// Prices are stored and served by the API in EUR.

export function langToLocale(lang: string) {
  const l = (lang || "").toLowerCase();
  if (l.startsWith("bg")) return "bg-BG";
  if (l.startsWith("tr")) return "tr-TR";
  return "en-GB";
}

export const fmtEUR = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
