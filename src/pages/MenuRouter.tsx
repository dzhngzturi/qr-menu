// src/pages/MenuRouter.tsx
import { useParams } from "react-router-dom";
import AvvaMenu from "../public/AvvaMenu";
import PublicMenu from "../public/PublicMenu";

export default function MenuRouter() {
  const { slug } = useParams<{ slug: string }>();

  if (slug === "avva") return <AvvaMenu />;   // ⬅️ твоят специален UI

  // по подразбиране — общото меню
  return <PublicMenu />;
}
