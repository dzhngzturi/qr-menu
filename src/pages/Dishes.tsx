import { DishFiltersCard } from "./dishes/DishFiltersCard";
import { DishForm } from "./dishes/DishForm";
import { DishesTable } from "./dishes/DishesTable";
import Pagination from "../components/Pagination";
import { useDishesPage } from "./dishes/hooks/useDishesPage";

export default function Dishes() {
  const vm = useDishesPage();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{vm.t("nav.dishes")}</h2>
        </div>
      </div>

      <DishFiltersCard
        cats={vm.cats}
        query={vm.query}
        disableAll={vm.disableAll}
        onChangeQuery={vm.setQuery}
        activeLang={vm.active}   // или vm.activeLang
      />


      <DishForm vm={vm} />

      <DishesTable
        rows={vm.rows}
        loading={vm.loading}
        disableAll={vm.disableAll}
        onDragEnd={vm.onDragEnd}
        onEdit={vm.onEdit}
        onDelete={vm.onDelete}
        getDisplayName={(d) => vm.getDisplayName(d, vm.active)}
        activeId={vm.editing?.id ?? null}
      />

      <Pagination
        totalPages={vm.pages.length}
        currentPage={Number(vm.query.page ?? 1)}
        loading={vm.loading}
        disableAll={vm.disableAll}
        onPick={(p) => vm.setQuery((q) => ({ ...q, page: p }))}
      />
    </div>
  );
}
