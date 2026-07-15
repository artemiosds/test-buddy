import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ProfessionalFilters } from '@/context/professional-filter-context';

export function useProfissionais(filters: ProfessionalFilters, page = 1, pageSize = 25) {
  const offset = (page - 1) * pageSize;
  return useQuery([
    'profissionais',
    filters.q ?? null,
    filters.cpf ?? null,
    filters.matricula ?? null,
    filters.unidadeId ?? null,
    filters.setorId ?? null,
    filters.cargoId ?? null,
    filters.funcaoId ?? null,
    filters.vinculoId ?? null,
    filters.status ?? null,
    page,
    pageSize,
  ],
  async () => {
    // build base query
    let query = supabase
      .from('profissionais')
      .select('id, nome_completo, cpf, matricula, unidade_id, setor_id, cargo_id, funcao_id, vinculo_id, status', { count: 'exact' });

    if (filters.q) {
      const q = `%${filters.q.trim()}%`;
      // Use ilike on name and OR on cpf/matricula
      query = query.ilike('nome_completo', q).or(`cpf.ilike.${q},matricula.ilike.${q}`);
    }
    if (filters.cpf) query = query.eq('cpf', filters.cpf);
    if (filters.matricula) query = query.eq('matricula', filters.matricula);
    if (filters.unidadeId) query = query.eq('unidade_id', filters.unidadeId);
    if (filters.setorId) query = query.eq('setor_id', filters.setorId);
    if (filters.cargoId) query = query.eq('cargo_id', filters.cargoId);
    if (filters.funcaoId) query = query.eq('funcao_id', filters.funcaoId);
    if (filters.vinculoId) query = query.eq('vinculo_id', filters.vinculoId);
    if (filters.status) query = query.eq('status', filters.status);

    const { data, count, error } = await query.range(offset, offset + pageSize - 1);
    if (error) throw error;

    const rows = data ?? [];

    // Fetch related unidades names for display (minimize to only used ids)
    const unidadeIds = Array.from(new Set(rows.map((r: any) => r.unidade_id).filter(Boolean)));
    let unidadesMap: Record<string, string> = {};
    if (unidadeIds.length > 0) {
      const { data: unidades, error: uErr } = await supabase
        .from('unidades')
        .select('id, nome')
        .in('id', unidadeIds as string[]);
      if (uErr) throw uErr;
      unidadesMap = (unidades ?? []).reduce((acc: Record<string, string>, u: any) => {
        acc[u.id] = u.nome;
        return acc;
      }, {});
    }

    const mapped = rows.map((r: any) => ({ ...r, unidade_nome: r.unidade_id ? (unidadesMap[r.unidade_id] ?? r.unidade_id) : null }));

    return { rows: mapped, count: count ?? 0 };
  }, { keepPreviousData: true });
}
