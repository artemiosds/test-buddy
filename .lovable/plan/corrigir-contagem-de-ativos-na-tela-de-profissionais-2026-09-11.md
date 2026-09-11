# Corrigir contagem de "Ativos" na tela de Profissionais

Hoje o cartão **Ativos** da tela de Profissionais conta apenas quem está com a situação `ativo`. A tela **Geral Cargos** já usa a regra institucional, e as duas telas mostram números diferentes. Vamos alinhar a tela de Profissionais à mesma regra.

## Regra que passa a valer (a mesma de Geral Cargos)

- **Ativos** = ativo + férias + licença prêmio
- **Disponível para escala** = somente ativo
- A situação considerada é a "Situação funcional" do cadastro; quando ela está vazia, usa-se o status geral (mesma prioridade que a tela já usa na coluna "Situação").

Conferência feita agora no banco (922 cadastros, sem excluídos): ativo 837, férias 39, licença prêmio 11 → **Ativos 887**, **Disponível para escala 837**. Os números que você citou (889 / 840) eram os de dias atrás; a diferença é movimentação de cadastro, não erro de cálculo. Os cartões passam a calcular sempre pelo banco, então acompanham qualquer mudança.

## O que muda na tela

- O cartão **Ativos** passa a somar ativo + férias + licença prêmio, com a explicação "ativo + férias + licença prêmio".
- Entra um cartão **Disponível para escala** (somente ativo), para deixar claro quem pode ir para escala.
- Para caber sem apertar, os cartões ficam assim: Total (após filtros), Ativos, Disponível para escala, Efetivos, Unidades no sistema.
- Os cartões continuam respeitando os filtros da página (unidade, vínculo, cargo, função, setor, categoria, gestor, pesquisa) e continuam ignorando o filtro de situação, como já acontecia com "Ativos".

## Detalhes técnicos

- Arquivo: `src/routes/_authenticated/profissionais.tsx`.
- Reaproveitar as constantes já existentes em `src/lib/situacao-funcional.ts` (`ATIVOS_STATUS`, `DISPONIVEL_STATUS`) em vez de repetir listas.
- Substituir o `.eq("status", "ativo")` de `kpiAtivos` por um filtro que respeite a prioridade situação funcional > status, no formato:
  `or("situacao_funcional.in.(ativo,ferias,licenca_premio),and(situacao_funcional.is.null,status.in.(ativo,ferias,licenca_premio))")`,
  mantendo `count: "exact", head: true` e `applyProfFilters`.
- Nova query `kpiDisponivel` com a mesma estrutura, restrita a `ativo`.
- Grid de KPIs ajustado para 5 cartões (`lg:grid-cols-5`).
- Nenhuma alteração de dados, cadastro ou permissões; nada muda em Geral Cargos.
