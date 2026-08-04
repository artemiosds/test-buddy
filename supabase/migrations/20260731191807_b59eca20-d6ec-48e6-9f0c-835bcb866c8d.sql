create or replace function public.compliance_riscos(
  _competencia_id uuid default null,
  _unidade_id uuid default null
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
with base as (
  select fc.profissional_id, fc.competencia_id, fc.unidade_id, 'contratados'::text as tipo
  from frequencias_contratados fc
  where fc.deleted_at is null
    and (_competencia_id is null or fc.competencia_id = _competencia_id)
    and (_unidade_id is null or fc.unidade_id = _unidade_id)
  union all
  select fp.profissional_id, cu.competencia_id, cu.unidade_id, 'efetivos'::text
  from frequencia_profissional fp
  join frequencias f on f.id = fp.frequencia_id and f.deleted_at is null
  join competencia_unidades cu on cu.id = f.competencia_unidade_id and cu.deleted_at is null
  where fp.deleted_at is null
    and (_competencia_id is null or cu.competencia_id = _competencia_id)
    and (_unidade_id is null or cu.unidade_id = _unidade_id)
),
prof as (
  select distinct b.profissional_id, b.competencia_id, b.unidade_id, b.tipo,
         p.cpf, p.nome_completo, p.carga_horaria_semanal,
         p.banco, p.agencia, p.conta_corrente, p.status
  from base b
  join profissionais p on p.id = b.profissional_id and p.deleted_at is null
),
det as (
  select pr.*,
         c.ano, c.mes,
         u.nome as unidade_nome, u.sigla as unidade_sigla
  from prof pr
  left join competencias c on c.id = pr.competencia_id
  left join unidades u on u.id = pr.unidade_id
),
dupes as (
  select d.cpf, d.competencia_id, d.ano, d.mes,
         min(d.nome_completo) as nome_completo,
         coalesce(sum(distinct d.carga_horaria_semanal), 0) as carga_total,
         count(*) as ocorrencias,
         jsonb_agg(distinct jsonb_build_object(
           'unidade', coalesce(d.unidade_sigla, d.unidade_nome),
           'tipo', d.tipo
         )) as vinculos
  from det d
  where d.cpf is not null and length(regexp_replace(d.cpf, '\D', '', 'g')) = 11
  group by d.cpf, d.competencia_id, d.ano, d.mes
  having count(distinct (d.unidade_id::text || d.tipo)) > 1
),
malha as (
  select distinct on (d.profissional_id, d.competencia_id)
         d.profissional_id, d.nome_completo, d.cpf, d.ano, d.mes,
         coalesce(d.unidade_sigla, d.unidade_nome) as unidade,
         d.tipo, d.carga_horaria_semanal,
         (d.cpf is null or length(regexp_replace(d.cpf, '\D', '', 'g')) <> 11) as cpf_invalido,
         (coalesce(nullif(trim(d.banco), ''), null) is null
          or coalesce(nullif(trim(d.conta_corrente), ''), null) is null) as banco_ausente,
         (d.carga_horaria_semanal is null or d.carga_horaria_semanal <= 0
          or d.carga_horaria_semanal > 44) as carga_irregular
  from det d
  order by d.profissional_id, d.competencia_id, d.nome_completo
)
select jsonb_build_object(
  'duplicidades', coalesce((select jsonb_agg(to_jsonb(x) order by x.nome_completo) from dupes x), '[]'::jsonb),
  'malha_fina', coalesce((
     select jsonb_agg(to_jsonb(m) order by m.nome_completo)
     from malha m
     where m.cpf_invalido or m.banco_ausente or m.carga_irregular
  ), '[]'::jsonb)
);
$$;

revoke all on function public.compliance_riscos(uuid, uuid) from public;
grant execute on function public.compliance_riscos(uuid, uuid) to authenticated;
grant execute on function public.compliance_riscos(uuid, uuid) to service_role;