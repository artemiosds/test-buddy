import React, { useState } from 'react';
import ProfessionalsTable from './ProfessionalsTable';
import { useProfessionalFilters } from '@/context/professional-filter-context';
import { usePermissions } from '@/hooks/use-permissions';

export default function ProfessionalsPage() {
  const { filters, setFilters, reset } = useProfessionalFilters();
  const { has } = usePermissions();
  const [page, setPage] = useState(1);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Centro de Gestão de Profissionais</h1>
      </div>

      <div className="mb-4 grid gap-2 md:grid-cols-4">
        <input
          value={filters.q ?? ''}
          onChange={(e) => setFilters({ q: e.target.value })}
          placeholder="Pesquisar por nome, CPF ou matrícula"
          className="rounded-md border p-2"
        />
        <input
          value={filters.cpf ?? ''}
          onChange={(e) => setFilters({ cpf: e.target.value })}
          placeholder="CPF"
          className="rounded-md border p-2"
        />
        <input
          value={filters.matricula ?? ''}
          onChange={(e) => setFilters({ matricula: e.target.value })}
          placeholder="Matrícula"
          className="rounded-md border p-2"
        />
        <div className="flex gap-2">
          <button onClick={() => { reset(); setPage(1); }} className="rounded-md border px-3">Limpar</button>
        </div>
      </div>

      <ProfessionalsTable page={page} setPage={setPage} pageSize={25} />
    </div>
  );
}
