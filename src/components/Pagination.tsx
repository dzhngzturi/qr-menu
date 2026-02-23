import { useEffect, useMemo, useState } from "react";

type PaginationProps = {
  currentPage: number;
  totalPages: number;
  onPick: (page: number) => void;
  loading?: boolean;
  disableAll?: boolean; // optional
};

export default function Pagination({
  currentPage,
  totalPages,
  onPick,
  loading = false,
  disableAll = false,
}: PaginationProps) {
  const safeTotal = Math.max(1, Number(totalPages || 1));
  const safeCurrent = Math.max(1, Math.min(Number(currentPage || 1), safeTotal));

  const [localPage, setLocalPage] = useState<number>(safeCurrent);

  useEffect(() => {
    setLocalPage(safeCurrent);
  }, [safeCurrent]);

  const pages = useMemo(() => {
    return Array.from({ length: safeTotal }, (_, i) => i + 1);
  }, [safeTotal]);

  const locked = disableAll || loading || safeTotal <= 1;

  return (
    <div className="flex flex-wrap gap-2">
      {pages.map((p) => {
        const isActive = p === localPage;

        return (
          <button
            key={p}
            type="button"
            disabled={locked}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (locked) return;

              // 🔥 моментално оцветяване (UI не чака fetch)
              setLocalPage(p);
              onPick(p);
            }}
            className={[
              "px-3 py-1.5 rounded-lg border transition-colors duration-150",
              locked ? "opacity-60 cursor-not-allowed" : "cursor-pointer",
              isActive
                ? "bg-black text-white border-black hover:bg-black"
                : "bg-white border-gray-300 hover:bg-gray-50",
            ].join(" ")}
          >
            {p}
          </button>
        );
      })}
    </div>
  );
}
