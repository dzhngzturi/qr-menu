// src/components/ConsentBanner.tsx
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { setTelemetryConsent, logQrScanOnceForSlug, logMenuOpenForSlug } from "../lib/telemetry";

type Props = {
  slug?: string | null;
};

/**
 * Consent banner (platform-level).
 *
 * Показва се само ако потребителят още НЕ е избрал (няма qr_consent cookie).
 * Backend решава дали telemetry да се записва според restaurants.telemetry_enabled.
 */
export default function ConsentBanner({ slug }: Props) {
  const { t } = useTranslation();
  
  const [visible, setVisible] = useState(false);

  function getConsentValue(): "accepted" | "rejected" | null {
    if (typeof document === "undefined") return null;
    const m = document.cookie.match(/(?:^|;\s*)qr_consent=([^;]+)/);
    if (!m) return null;
    const v = decodeURIComponent(m[1] ?? "");
    return v === "accepted" || v === "rejected" ? v : null;
  }

  useEffect(() => {
    const consent = getConsentValue();
    setVisible(consent === null);
  }, []);

  if (!visible) return null;

  const onAccept = () => {
    setTelemetryConsent("accepted");
    setVisible(false);

    // Логваме веднага след съгласие
    if (slug) {
      logQrScanOnceForSlug(slug);
      logMenuOpenForSlug(slug);
    }
  };

  const onReject = () => {
    setTelemetryConsent("rejected");
    setVisible(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-neutral-900 p-5 shadow-xl">
        <h2 className="text-lg font-semibold mb-2 text-white">
          {t("consent.title")}
        </h2>

        <p className="text-sm text-white/80 mb-4">
          {t("consent.text")}
        </p>

        <div className="flex flex-col gap-2">
          <button
            onClick={onAccept}
            className="w-full px-4 py-2 rounded-xl bg-white text-black font-medium hover:opacity-90 transition"
          >
            {t("consent.accept")}
          </button>

          <button
            onClick={onReject}
            className="w-full px-4 py-2 rounded-xl bg-white/10 border border-white/10 hover:bg-white/15 transition"
          >
            {t("consent.reject")}
          </button>

          <a
            href={`/privacy?from=${encodeURIComponent(slug ?? "")}`}
            className="text-center text-xs text-white/60 hover:text-white hover:underline mt-1"
          >
            {t("consent.privacy")}
          </a>
        </div>
      </div>
    </div>
  );
}
