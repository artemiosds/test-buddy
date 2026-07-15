import React from 'react';
import { useProfissionais } from '@/hooks/use-profissionais';
import { useProfessionalFilters } from '@/context/professional-filter-context';
import { Link } from '@tanstack/react-router';

export default function ProfessionalsTable({ page, setPage, pageSize = 25 }:
  { page: number; setPage: (p: number) => void; pageSize?: number }) {
  const { filters } = useProfessionalFilters();
  const { data, isLoading, error } = useProfissionais(filters, page, pageSize);

  const total = data?.count ?? 0;
  const rows = data?.rows ?? [];

  return (
    <div className="rounded-md border bg-card p-4">
      {isLoading && <div>Carregando...</div>}
      {error && <div className="text-destructive">Erro: {(error as any).message}</div>}
      <table className="w-full table-auto text-sm">
        <thead>
          <tr className="text-left">
            <th className="p-2">Nome</th>
            <th className="p-2">CPF</th>
            <th className="p-2">Matrícula</th>
            <th className="p-2">Unidade</th>
            <th className="p-2">Ações</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r: any) => (
            <tr key={r.id} className="border-t">
              <td className="p-2">{r.nome_completo}</td>
              <td className="p-2">{r.cpf}</td>
              <td className="p-2">{r.matricula}</td>
              <td className="p-2">{r.unidade_nome ?? '-'}</td>
              <td className="p-2">
                <Link to={`/profissionais/${r.id}`}>Abrir</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 flex items-center justify-between">
        <div>Mostrando {rows.length} de {total}</div>
        <div className="flex gap-2">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            className="rounded-md border px-3"
            disabled={page === 1}
          >Anterior</button>
          <button
            onClick={() => setPage(page + 1)}
            className="rounded-md border px-3"
            disabled={page * pageSize >= total}
          >Próxima</button>
        </div>
      </div>
    </div>
  );
}
