// src/lib/money.ts
const EUR_RATE = 1.95583; // фиксиран курс

export function bgnToEur(bgn: number) {
  return Math.round((Number(bgn || 0) / EUR_RATE) * 100) / 100;
}

export const fmtBGN = new Intl.NumberFormat('bg-BG', { style: 'currency', currency: 'BGN' });
export const fmtEUR = new Intl.NumberFormat('bg-BG', { style: 'currency', currency: 'EUR' });
