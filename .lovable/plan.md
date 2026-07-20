
# Relatórios — Dois Centros

Reestruturar a área de Relatórios em **dois centros** distintos, sem mexer no que já funciona.

## Arquitetura

```text
/relatorios (layout com 2 grupos de abas)
├── Operacionais  (dependem de competência — INTACTO)
│   ├── /relatorios                     Frequências
│   ├── /relatorios-executivo           Executivo
│   ├── /relatorios-consolidado         Consolidado
│   ├── /relatorios-status              Status por Unidade
│   ├── /relatorios-profissional        Por Profissional
│   └── /relatorios-piso                Piso Enfermagem
│
└── Gerenciais  (NOVOS — cadastros atuais, sem competência)
    ├── /relatorios-gerenciais/profissionais
    ├── /relatorios-gerenciais/unidades
    ├── /relatorios-gerenciais/setores
    ├── /relatorios-gerenciais/cargos
    ├── /relatorios-gerenciais/funcoes
    ├── /relatorios-gerenciais/estrutura
    ├── /relatorios-gerenciais/indicadores
    ├── /relatorios-gerenciais/piso           (visão gerencial do piso)
    └── /relatorios-gerenciais/auditoria
```

O componente `RelatoriosTabs` vira **duas barras**: "Operacionais" e "Gerenciais", com destaque visual do grupo ativo. Nada nas rotas antigas muda.

## Novos relatórios (escopo)

Cada relatório gerencial segue o mesmo esqueleto:

- **PageHeader** (título + descrição).
- **FilterBar** com filtros de cadastro (Secretaria/Unidade/Setor/Cargo/Função/Vínculo/Status conforme o caso). Nunca competência.
- **KPIs** no topo (2–4 cards).
- **Tabela** paginada + botões **Exportar CSV** e **Exportar PDF** (usando `csv-export.ts` e `pdf-institucional.ts`).
- Filtros persistidos via search params.

### Profissionais (`/relatorios-gerenciais/profissionais`)
Sub-abas internas (via tabs no topo do painel):
- **Cadastro Geral** — tabela completa com todos filtros.
- **Por Unidade / Setor / Cargo / Função / Vínculo** — agrupamentos.
- **Status**: Ativos, Afastados, Férias, Licenciados, Inativos.
- **Pendências cadastrais**:
  - Sem Lotação (sem unidade), Sem Setor, Sem Cargo, Sem Função, Sem Matrícula.
  - Dados Incompletos: CPF, Telefone, E-mail, Nascimento, Carga Horária.

Cada sub-aba é uma query pré-filtrada sobre `profissionais` + joins mínimos.

### Unidades (`/relatorios-gerenciais/unidades`)
- Relação geral, por Tipo, Ativas/Inativas.
- **Sem Diretor**, **Sem Coordenador**, **Sem Telefone**, **Sem CNES**, **Sem CNPJ**, **Sem E-mail** (queries `is null` + agregação).
- Quantidade de servidores por unidade.
- Lotação da Unidade (drill: servidor / cargo / função / setor / status) — acessível via botão "Ver Lotação".

### Setores (`/relatorios-gerenciais/setores`)
Relação, por Unidade, Sem Coordenador, Sem Profissionais, Com apenas 1 servidor, Distribuição.

### Cargos e Funções
Relação, quantidade por cargo/função, sem profissionais, mais utilizados.

### Estrutura Organizacional (`/relatorios-gerenciais/estrutura`)
- Organograma Diretor → Coordenador → Profissionais (árvore hierárquica).
- Unidades e responsáveis; Setores e responsáveis.

### Indicadores (`/relatorios-gerenciais/indicadores`)
Resumo executivo (totais) + distribuições (vínculo, sexo, escolaridade, idade, unidade, cargo, função, setor). Usa Recharts (BarChart + PieChart).

### Piso da Enfermagem — visão gerencial
Piso Efetivos, Piso Contratados, Comparativo entre meses, Sem cálculo, Divergências, Valores importados, Histórico de importações, Resumo financeiro, Conferência por unidade/profissional, Log de atualizações. Reaproveita queries já existentes em `piso-enfermagem.functions.ts`.

### Auditoria (`/relatorios-gerenciais/auditoria`)
Consulta `audit_log` com filtros por operação/tabela/usuário/período. Views pré-configuradas: quem alterou cadastro, unidade, setor, cargo, função, usuário, importou piso, recalculou piso, excluiu.

## Detalhes técnicos

- **Reuso**: `useUnidadesLookup`, `useSetoresLookup`, `useCargosLookup`, `useFuncoesLookup`, `useVinculosLookup`, `useUsuariosLookup` (já existem em `use-lookups.ts`).
- **Queries novas** ficam em `src/lib/relatorios-gerenciais.ts` (client-side supabase) — só SELECTs.
- **Layout compartilhado**: novo `src/routes/_authenticated/relatorios-gerenciais.tsx` (parent com `<Outlet />` + sidebar de sub-rotas). As rotas viram `relatorios-gerenciais.<slug>.tsx`.
- **Duas barras de aba**: novo componente `RelatoriosCentros` que agrupa "Operacionais" vs "Gerenciais" e é renderizado em cada rota das duas famílias.
- **Permissões**: nenhum novo `permissao.codigo`; usa RLS existente (só leitura).
- **Zero migration**. Zero mudança em Operacionais existentes.

## Rollout em ondas

1. **Onda 1** — esqueleto: layout `relatorios-gerenciais`, sub-nav dos 2 centros, páginas **Profissionais** (todas sub-abas) e **Indicadores** (resumo + distribuições) + exportação CSV/PDF.
2. **Onda 2** — **Unidades**, **Setores**, **Cargos**, **Funções**.
3. **Onda 3** — **Estrutura Organizacional** (organograma) + **Piso Gerencial**.
4. **Onda 4** — **Auditoria** com filtros ricos e views prontas.

Cada onda é independente e commitável.

## Riscos

- Volume grande de queries — mitigado por lookups já cacheados e `staleTime` de 5 min.
- Organograma pode ficar pesado com muitos nós — renderização virtualizada / colapsável por unidade.
- Auditoria pode retornar muitos registros — paginação obrigatória + filtro de período default (últimos 30 dias).

Ao aprovar, começo pela **Onda 1**.
