create or replace function public.devolver_frequencias_contratados_transacional(
  _frequencia_ids uuid[],
  _justificativa text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_ids uuid[];
  v_total integer := 0;
  v_validas integer := 0;
  v_editaveis integer := 0;
  v_cu_count integer := 0;
  v_competencia_unidade_id uuid;
  v_competencia_id uuid;
  v_unidade_id uuid;
  v_has_geral boolean := false;
  v_setores uuid[];
  v_freq_atualizadas integer := 0;
  v_linhas_devolvidas integer := 0;
begin
  if v_uid is null then
    raise exception 'Usuário não autenticado.'
      using errcode = '42501';
  end if;

  if not (
    public.is_master(v_uid)
    or public.has_permission(v_uid, 'frequencia.rejeitar')
  ) then
    raise exception 'Sem permissão para devolver folha de frequência.'
      using errcode = '42501';
  end if;

  select array_agg(distinct x order by x)
    into v_ids
  from unnest(_frequencia_ids) as t(x)
  where x is not null;

  if v_ids is null or cardinality(v_ids) = 0 then
    raise exception 'Nenhuma frequência foi informada.';
  end if;

  perform 1
  from public.frequencias f
  where f.id = any(v_ids)
  order by f.id
  for update;

  select
    cardinality(v_ids),
    count(*) filter (
      where f.deleted_at is null
        and f.tipo = 'contratados'
    ),
    count(*) filter (
      where f.deleted_at is null
        and f.tipo = 'contratados'
        and f.status in ('enviada', 'em_analise', 'com_pendencias')
    ),
    count(distinct f.competencia_unidade_id)
  into
    v_total,
    v_validas,
    v_editaveis,
    v_cu_count
  from public.frequencias f
  where f.id = any(v_ids);

  if v_validas <> v_total then
    raise exception 'O conjunto contém frequência inexistente, excluída ou que não é de Contratados.';
  end if;

  if v_editaveis <> v_total then
    raise exception 'Uma ou mais folhas já não estão em estado permitido para devolução.';
  end if;

  if v_cu_count <> 1 then
    raise exception 'As frequências informadas não pertencem à mesma unidade/competência.';
  end if;

  select
    f.competencia_unidade_id,
    cu.competencia_id,
    cu.unidade_id
  into
    v_competencia_unidade_id,
    v_competencia_id,
    v_unidade_id
  from public.frequencias f
  join public.competencia_unidades cu
    on cu.id = f.competencia_unidade_id
  where f.id = v_ids[1]
    and f.deleted_at is null
    and cu.deleted_at is null;

  if v_competencia_unidade_id is null
     or v_competencia_id is null
     or v_unidade_id is null then
    raise exception 'Não foi possível resolver competência e unidade da frequência.';
  end if;

  select
    bool_or(f.setor_id is null),
    array_agg(distinct f.setor_id order by f.setor_id)
      filter (where f.setor_id is not null)
  into
    v_has_geral,
    v_setores
  from public.frequencias f
  where f.id = any(v_ids);

  update public.frequencias f
     set status = 'devolvida'::public.status_frequencia,
         updated_by = v_uid
   where f.id = any(v_ids)
     and f.deleted_at is null
     and f.tipo = 'contratados'
     and f.status in ('enviada', 'em_analise', 'com_pendencias');

  get diagnostics v_freq_atualizadas = row_count;

  if v_freq_atualizadas <> v_total then
    raise exception 'Nem todas as folhas puderam ser devolvidas. A operação foi cancelada.';
  end if;

  update public.frequencias_contratados fc
     set status = 'devolvida'::public.status_frequencia,
         updated_at = now(),
         updated_by = v_uid,
         devolvida_por = v_uid,
         devolvida_em = now(),
         justificativa_devolucao =
           case
             when _justificativa is not null and btrim(_justificativa) <> ''
               then _justificativa
             else fc.justificativa_devolucao
           end
    from public.profissionais p
   where p.id = fc.profissional_id
     and fc.competencia_id = v_competencia_id
     and fc.unidade_id = v_unidade_id
     and fc.deleted_at is null
     and p.deleted_at is null
     and (
       coalesce(v_has_geral, false)
       or (
         v_setores is not null
         and p.setor_id = any(v_setores)
       )
     )
     and fc.status in ('enviada', 'em_analise', 'com_pendencias');

  get diagnostics v_linhas_devolvidas = row_count;

  return jsonb_build_object(
    'ok', true,
    'competencia_unidade_id', v_competencia_unidade_id,
    'competencia_id', v_competencia_id,
    'unidade_id', v_unidade_id,
    'setores', coalesce(to_jsonb(v_setores), '[]'::jsonb),
    'abrange_unidade_inteira', coalesce(v_has_geral, false),
    'frequencias_atualizadas', v_freq_atualizadas,
    'linhas_devolvidas', v_linhas_devolvidas
  );
end;
$$;

revoke all on function public.devolver_frequencias_contratados_transacional(uuid[], text) from public;
revoke all on function public.devolver_frequencias_contratados_transacional(uuid[], text) from anon;
grant execute on function public.devolver_frequencias_contratados_transacional(uuid[], text) to authenticated;
grant execute on function public.devolver_frequencias_contratados_transacional(uuid[], text) to service_role;
