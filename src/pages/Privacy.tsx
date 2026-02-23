// src/pages/Privacy.tsx
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

export default function Privacy() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  // очакваме: /privacy?from=eres  (или viva/thepearl/...)
  const fromSlug = params.get("from");

  function goBack() {
    if (fromSlug) navigate(`/menu/${fromSlug}`);
    else navigate("/"); // fallback ако е отворено директно
  }

  const s1Items = t("privacy.s1_items", { returnObjects: true }) as string[];
  const s3Items = t("privacy.s3_items", { returnObjects: true }) as string[];

  return (
    <div className="min-h-screen bg-neutral-900 text-white">
      <div className="max-w-3xl mx-auto px-5 py-10">
        {/* Back */}
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={goBack}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 border border-white/10 hover:bg-white/15 transition"
            aria-label={t("privacy.back")}
            title={t("privacy.back")}
          >
            <span className="text-lg">←</span>
            <span className="text-sm font-medium">{t("privacy.back")}</span>
          </button>

          <div className="text-sm text-white/60">{t("privacy.badge")}</div>
        </div>

        <h1 className="text-3xl font-semibold mb-6">{t("privacy.title")}</h1>

        <p className="text-white/80 mb-6">{t("privacy.intro")}</p>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-2">{t("privacy.s1_title")}</h2>
          <ul className="list-disc pl-5 space-y-1 text-white/80">
            {Array.isArray(s1Items) ? s1Items.map((x, i) => <li key={i}>{x}</li>) : null}
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-2">{t("privacy.s2_title")}</h2>
          <p className="text-white/80">{t("privacy.s2_text")}</p>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-2">{t("privacy.s3_title")}</h2>
          <ul className="list-disc pl-5 space-y-1 text-white/80">
            {Array.isArray(s3Items) ? s3Items.map((x, i) => <li key={i}>{x}</li>) : null}
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-2">{t("privacy.s4_title")}</h2>
          <p className="text-white/80">{t("privacy.s4_text")}</p>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-2">{t("privacy.s5_title")}</h2>
          <p className="text-white/80">{t("privacy.s5_text")}</p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-2">{t("privacy.s6_title")}</h2>
          <p className="text-white/80">{t("privacy.s6_text")}</p>

          {/* Ниво 1: глобален контакт (по желание можеш да го вкараш и в i18n) */}
          <p className="mt-2 text-white/80">
            Email: <span className="underline">dzhengiz.ferad@icloud.com</span>
          </p>
        </section>

        <div className="text-sm text-white/50">
          {t("privacy.updated")}: {new Date().toLocaleDateString()}
        </div>
      </div>
    </div>
  );
}
