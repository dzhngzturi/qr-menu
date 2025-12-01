// src/pages/MenuRouter.tsx
import { useParams } from "react-router-dom";
import AvvaMenu from "../public/AvvaMenu";
import PublicMenu from "../public/PublicMenu";
import EresMenu from "../public/EresMenu";

export default function MenuRouter() {
  const { slug } = useParams<{ slug: string }>();

  if (slug === "avva") return <AvvaMenu />;   // ⬅️ твоят специален UI
  if (slug === "eres") return <EresMenu />;  // ⬅️ новият ресторант ER & ES

  // по подразбиране — общото меню
  return <PublicMenu />;
}
