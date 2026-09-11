# Profissionais: filtro de Status corrigido + filtro de Categoria Consolidada

## O que está errado hoje

Confirmado na tela de Profissionais:

- O filtro **Status** consulta apenas a coluna macro `status`. As situações detalhadas
  (afastamento por INSS, licenças, afastado por laudo, férias, vacância etc.) estão
  gravadas em `situacao_funcional` — e na maioria dos cadastros o `status` está
  vazio/genérico. Resultado: selecionar "Férias" ou "Afastado" devolve pouco ou nada,
  e combinar vários status devolve resultado incompleto.
- Os mesmos três lugares repetem a regra solto (lista, contadores/KPIs e exportação),
  então o número dos cartões, o "Exibindo X de Y" e o Excel podem discordar entre si.
- O filtro "Categoria" existente cobre só as três categorias de enfermagem do Piso.
  Não existe o agrupamento gerencial (De-Para) usado na tela Geral Cargos.

## O que vai mudar

### 1. Status passa a considerar as duas colunas

Um único helper de filtro, usado na listagem, nos cartões de KPI e na exportação:

- Casa quando `situacao_funcional` está entre os valores escolhidos, **ou** quando ela
  está vazia e o `status` está entre eles (mesma prioridade já usada em Geral Cargos).
- Cada rótulo escolhido é expandido para os valores equivalentes do banco
  (ex.: "Afastado" cobre afastamento por INSS, laudo, cedido, vacância, falta PAD),
  reaproveitando `valoresDoFiltroSituacao`/`VALORES_DO_GRUPO`.
- Só entra na consulta quando há pelo menos um status escolhido.
- A chave de cache passa a receber as seleções ordenadas e serializadas
  (`[...f].sort().join(",")`) em todos os filtros múltiplos, para não sobrar
  resultado antigo em tela.
- Revisão dos outros múltiplos (Cargo, Função, Setor, Vínculo, Unidade): mantêm
  `.in(...)` — correto para colunas de id — apenas com a chave de cache serializada e
  guarda de lista vazia.

### 2. Novo filtro "Categoria Consolidada"

- Novo campo na barra de filtros, com busca e contador, ao lado de "Categoria".
- Usa exatamente o De-Para gerencial de Geral Cargos (`src/lib/cargo-categorias.ts`):
  Técnico em Enfermagem, Auxiliar de Enfermagem, Enfermeiro(a), Apoio/Serviços Gerais,
  Administrativo, Motoristas, seção médica etc.
- Ao escolher categorias, o sistema traduz para os cargos e funções cadastrados que
  caem nelas e filtra por esses ids; categorias podem ser combinadas (união).
- Convive com o filtro de Categoria (Piso) e com Cargo/Função: os dois se somam.
- "Exibindo X de Y", os cartões de indicadores e a exportação em Excel usam a mesma
  tradução, então os três números batem.
- O botão "Limpar" e o contador de filtros ativos incluem o novo campo.

## Detalhes técnicos

- Arquivo principal: `src/routes/_authenticated/profissionais.tsx`.
- Extrair um helper compartilhado (em `src/lib/situacao-funcional.ts` ou um pequeno
  módulo ao lado) que gera a expressão de situação:
  `situacao_funcional.in.(...),and(situacao_funcional.is.null,status.in.(...))`,
  com os valores já expandidos por `valoresDoFiltroSituacao`.
- Substituir as três ocorrências de `q.in("status", fStatus)` (listagem ~L462,
  export ~L572, KPIs ~L917/L973) por esse helper; `applyProfFilters` passa a aplicar
  status também, evitando divergência entre lista, cartões e Excel.
- Cada `.or(...)` extra (busca, categorias, status) é um parâmetro `or=` separado —
  PostgREST combina os repetidos com AND, o comportamento desejado.
- Novo estado `fCategoriaConsolidada: string[]` (slugs de `CATEGORIAS`), com
  `useMemo` mapeando slug → `cargo_id`/`funcao_id` via `categoriaDoCargo` sobre
  `cargosLookup`/`funcoesLookup`; a query só habilita quando os lookups chegaram.
- Quando a seleção não casa com nenhum cargo/função, a consulta retorna vazio em vez
  de ignorar o filtro.
- Validação: `bunx tsgo --noEmit` e conferência de que lista, KPIs e Excel devolvem os
  mesmos totais com status múltiplos e categoria consolidada aplicados.

## Fora do escopo

- Nenhuma alteração no cadastro individual do profissional, nas regras de contagem de
  Ativos/Disponível para escala, ou nas telas de dashboards e relatórios.
