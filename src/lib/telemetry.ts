// src/lib/telemetry.ts
import api from "./api";

export type TelemetryType = "qr_scan" | "menu_open" | "search";

/* ---------- КОИ РЕСТОРАНТИ ИМАТ ТЕЛЕМЕТРИЯ ---------- */
// ✅ тук управляваш КЪДЕ да е включена телеметрията
//    - добавяш slug-ове
//    - махаш slug-ове
const TELEMETRY_ALLOWED_SLUGS = ["eres","viva"]; // пример – промени според теб

export function isTelemetryEnabledForSlug(slug?: string | null) {
  if (!slug) return false;
  return TELEMETRY_ALLOWED_SLUGS.includes(slug);
}

/* ---------- Session ID ---------- */
function getSessionId(): string {
  const KEY = "qrmenu_session_id";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
    localStorage.setItem(KEY, id);
  }
  return id;
}

/* ---------- Основна функция за логване ---------- */
export async function logTelemetry(
  type: TelemetryType,
  payload?: Record<string, unknown>
) {
  try {
    await api.post("/telemetry", {
      type,
      occurred_at: new Date().toISOString(),
      session_id: getSessionId(),
      payload,
    });
  } catch (err) {
    console.warn("Telemetry error:", err);
  }
}

/* --------------------------------
   QR SCAN – максимум 1 път НА ДЕН
   за даден ресторант (slug) на това
   устройство
--------------------------------- */
export function logQrScanOnceForSlug(slug?: string | null) {
  try {
    if (!isTelemetryEnabledForSlug(slug)) return; // ⬅️ ако е забранено – край

    const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
    const key = slug ? `qr_scan_last_${slug}` : "qr_scan_last_unknown";

    const last = localStorage.getItem(key);
    if (last === today) return; // вече е логнато за днес

    localStorage.setItem(key, today);
    logTelemetry("qr_scan");
  } catch (err) {
    console.warn("QR scan flag error:", err);
  }
}

/* ---------- MENU OPEN ---------- */

export function logMenuOpenForSlug(slug?: string | null) {
  if (!isTelemetryEnabledForSlug(slug)) return;
  logTelemetry("menu_open");
}

/* ------------------------------
   SEARCH control
-------------------------------- */

// последно изпратен термин (за да не пращаме едно и също)
let lastSentTerm: string | null = null;
// за debounce
let debounceTimer: any = null;
let lastInputTerm = "";

/**
 * logSearchDebounced:
 *  ✔ праща събитие само ако потребителят е спрял да пише поне 2 секунди
 *  ✔ терминът е различен от последно изпратения
 *  ✔ терминът е поне 3 букви
 */
export function logSearchDebounced(termRaw: string, slug?: string | null) {
  if (!isTelemetryEnabledForSlug(slug)) return; // ⬅️ контрол по ресторант

  const term = termRaw.trim().toLowerCase();
  lastInputTerm = term;

  if (debounceTimer) clearTimeout(debounceTimer);

  if (term.length < 3) return;

  debounceTimer = setTimeout(() => {
    if (lastInputTerm !== term) return;
    if (term === lastSentTerm) return;

    lastSentTerm = term;
    logTelemetry("search", { term });
  }, 2000);
}

/**
 * logSearchImmediate:
 *  – за изпращане при Enter / submit
 */
export function logSearchImmediate(termRaw: string, slug?: string | null) {
  if (!isTelemetryEnabledForSlug(slug)) return; // ⬅️ контрол по ресторант

  const term = termRaw.trim().toLowerCase();
  if (!term || term.length < 3) return;

  if (term !== lastSentTerm) {
    lastSentTerm = term;
    logTelemetry("search", { term });
  }

  
}
