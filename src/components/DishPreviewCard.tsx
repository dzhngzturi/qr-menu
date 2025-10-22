// src/components/DishPreviewCard.tsx
import type { Dish } from "../lib/types";
import { bgnToEur, fmtBGN, fmtEUR } from "../lib/money";

export default function DishPreviewCard({ dish }: { dish: Dish }) {
  const hasPrice = typeof dish.price === "number" && dish.price > 0;
  const priceBGN = hasPrice ? fmtBGN.format(dish.price) : null;
  const priceEUR = hasPrice ? fmtEUR.format(bgnToEur(dish.price)) : null;

  return (
    <article className="text-neutral-900">
      {/* IMAGE */}
      {dish.image_url && (
        <div className="relative mb-4 overflow-hidden rounded-2xl border border-black/10">
          <img
            src={dish.image_url}
            alt={dish.name}
            className="block w-full h-auto object-cover"
            style={{ aspectRatio: "16 / 9" }}
            loading="lazy"
          />
        </div>
      )}

      {/* TITLE */}
      <h3 className="text-xl md:text-2xl font-semibold tracking-wide">
        {dish.name}
      </h3>

      {/* PRICE */}
      {(priceBGN || priceEUR) && (
        <div className="mt-1 text-sm md:text-[15px] font-medium text-neutral-600">
          {priceBGN}
          {priceEUR ? <span className="opacity-80"> | {priceEUR}</span> : null}
        </div>
      )}

      {/* DESCRIPTION */}
      {dish.description && (
        <p className="mt-4 text-[15px] leading-relaxed text-neutral-700">
          {dish.description}
        </p>
      )}
    </article>
  );
}
