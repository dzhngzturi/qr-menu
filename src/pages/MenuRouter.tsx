// src/pages/MenuRouter.tsx
import { useParams } from "react-router-dom";

import AvvaMenu from "../public/AvvaMenu";
import PublicMenu from "../public/PublicMenu";
import EresMenu from "../public/EresMenu";
import ThePearlMenu from "../public/ThePearlMenu";
import ConsentBanner from "../components/ConsentBanner";
import NotFound from "./NotFound";

import { PublicConfigProvider, usePublicConfig } from "../public/PublicConfigContext";
import PublicLangSwitcherFlags from "../public/PublicLangSwitcherFlags";

function MenuFrame({ slug }: { slug?: string }) {
  const cfg = usePublicConfig();

  // 1) чакаме само /config
  if (cfg.loading) return null;

  // 2) ако slug не съществува или има грешка -> NotFound (и НЕ рендерираме меню)
  if (cfg.notFound || cfg.error) {
    return <NotFound />;
  }

  // 3) валиден ресторант -> показваме меню
  const MenuEl = (() => {
    if (slug === "avva") return <AvvaMenu />;
    if (slug === "eres") return <EresMenu />;
    if (slug === "thepearl") return <ThePearlMenu />;
    return <PublicMenu />;
  })();

  return (
    <>
      <div className="fixed top-3 right-3 z-[60]">
        <PublicLangSwitcherFlags />
      </div>

      {MenuEl}

      <ConsentBanner slug={slug} />
    </>
  );
}

export default function MenuRouter() {
  const { slug } = useParams<{ slug: string }>();

  return (
    <PublicConfigProvider slug={slug}>
      <MenuFrame slug={slug} />
    </PublicConfigProvider>
  );
}