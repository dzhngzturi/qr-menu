// src/lib/telemetry.ts
import api from "./api";

export type TelemetryType = "qr_scan" | "menu_open" | "search";

/* ---------- CONSENT ---------- */
const CONSENT_COOKIE = "qr_consent"; // accepted | rejected

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(
      "(^| )" + name.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&") + "=([^;]+)"
    )
  );
  return match ? decodeURIComponent(match[2]) : null;
}

export function hasTelemetryConsent(): boolean {
  return getCookie(CONSENT_COOKIE) === "accepted";
}

export function setTelemetryConsent(value: "accepted" | "rejected") {
  if (typeof document === "undefined") return;
  const maxAge = 60 * 60 * 24 * 180;

  // ✅ consent cookie (на домейна на FRONTEND-а)
  // Няма да стигне до API домейна (cross-domain), затова ползваме header към API.
  document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(
    value
  )}; Max-Age=${maxAge}; Path=/; SameSite=Lax`;
}

/* ---------- Session ID ---------- */
function getSessionId(): string | null {
  if (!hasTelemetryConsent()) return null;

  const KEY = "qrmenu_session_id";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
    localStorage.setItem(KEY, id);
  }
  return id;
}

/* ---------- Core ---------- */
export async function logTelemetry(
  type: TelemetryType,
  slug?: string | null,
  payload?: Record<string, unknown>
) {
  // ✅ consent gate
  if (!hasTelemetryConsent()) return;

  // ✅ IMPORTANT: resolve.restaurant иска ?restaurant=slug
  if (!slug) return;

  const sessionId = getSessionId();
  if (!sessionId) return;

  try {
    await api.post(
      `/telemetry?restaurant=${encodeURIComponent(slug)}`,
      {
        type,
        occurred_at: new Date().toISOString(),
        session_id: sessionId,
        payload: payload || null,
      },
      {
        // ✅ cross-origin consent: backend middleware CheckTelemetryConsent го приема
        headers: { "X-Telemetry-Consent": "accepted" },
      }
    );
  } catch (err) {
    console.warn("Telemetry error:", err);
  }
}

/* ---------- QR SCAN (1x/day per device/browser) ---------- */
export function logQrScanOnceForSlug(slug?: string | null) {
  try {
    if (!hasTelemetryConsent()) return;
    if (!slug) return;

    const today = new Date().toISOString().slice(0, 10);
    const key = `qr_scan_last_${slug}`;

    const last = localStorage.getItem(key);
    if (last === today) return;

    localStorage.setItem(key, today);
    logTelemetry("qr_scan", slug);
  } catch (err) {
    console.warn("QR scan flag error:", err);
  }
}

/* ---------- MENU OPEN ---------- */
export function logMenuOpenForSlug(slug?: string | null) {
  if (!slug) return;
  logTelemetry("menu_open", slug);
}

/* ---------- SEARCH ---------- */
let lastSentTerm: string | null = null;
let debounceTimer: any = null;
let lastInputTerm = "";

export function logSearchDebounced(termRaw: string, slug?: string | null) {
  if (!hasTelemetryConsent()) return;
  if (!slug) return;

  const term = termRaw.trim().toLowerCase();
  lastInputTerm = term;

  if (debounceTimer) clearTimeout(debounceTimer);
  if (term.length < 3) return;

  debounceTimer = setTimeout(() => {
    if (lastInputTerm !== term) return;
    if (term === lastSentTerm) return;

    lastSentTerm = term;
    logTelemetry("search", slug, { term });
  }, 2000);
}

export function logSearchImmediate(termRaw: string, slug?: string | null) {
  if (!hasTelemetryConsent()) return;
  if (!slug) return;

  const term = termRaw.trim().toLowerCase();
  if (!term || term.length < 3) return;

  if (term !== lastSentTerm) {
    lastSentTerm = term;
    logTelemetry("search", slug, { term });
  }
}
