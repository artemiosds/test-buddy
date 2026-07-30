import React, { useState } from "react";
import ProfessionalsTable from "./ProfessionalsTable";
import { useProfessionalFilters } from "@/context/professional-filter-context";
import { usePermissions } from "@/hooks/use-permissions";
import { FilterBar } from "@/components/shared";

export default function ProfessionalsPage() {
  const { filters, setFilters, reset } = useProfessionalFilters();
  const { has } = usePermissions();
  const [page, setPage] = useState(1);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Centro de Gestão de Profissionais</h1>
      </div>

      <FilterBar
        actions={
          <button
            onClick={() => {
              reset();
              setPage(1);
            }}
            className="rounded-md border px-3"
          >
            Limpar
          </button>
        }
      >
        <FilterBar.Field label="Pesquisar">
          <input
            value={filters.q ?? ""}
            onChange={(e) => setFilters({ q: e.target.value })}
            placeholder="Nome, CPF ou matrícula"
            className="w-full rounded-md border p-2"
          />
        </FilterBar.Field>
        <FilterBar.Field label="CPF">
          <input
            value={filters.cpf ?? ""}
            onChange={(e) => setFilters({ cpf: e.target.value })}
            placeholder="CPF"
            className="w-full rounded-md border p-2"
          />
        </FilterBar.Field>
        <FilterBar.Field label="Matrícula">
          <input
            value={filters.matricula ?? ""}
            onChange={(e) => setFilters({ matricula: e.target.value })}
            placeholder="Matrícula"
            className="w-full rounded-md border p-2"
          />
        </FilterBar.Field>
      </FilterBar>

      <ProfessionalsTable page={page} setPage={setPage} pageSize={25} />
    </div>
  );
}
