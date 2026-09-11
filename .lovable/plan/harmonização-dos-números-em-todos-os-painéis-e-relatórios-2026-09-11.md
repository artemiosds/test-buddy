# Harmonização dos números em todos os painéis e relatórios

## O problema confirmado

Consultei o banco: hoje existem 922 cadastros ativos no sistema, sendo 837 em exercício pleno, 39 em férias, 11 em licença prêmio e 35 realmente afastados. Isso dá exatamente os números da tela de Profissionais (Ativos 887, Disponível para escala 837, Afastados 35).

A "Visão Geral do Sistema" mostra 855 e 67 porque o cálculo usado por ela tem dois defeitos confirmados:

1. Ele lê apenas o campo "situação funcional" e ignora o campo "status" quando o primeiro está vazio. São 836 cadastros com a situação em branco — entre eles pessoas em licença sem vencimento, INSS, falta PAD, vacância e cedidos — que acabam contadas como ativas. 836 + 19 = 855.
2. Quem está de férias ou em licença prêmio é jogado no cartão "Afastados" (39 + 11 + 35 = 85, e 922 − 855 = 67 pela contagem atual), quando pela regra homologada essas pessoas continuam ativas, apenas fora da escala.

## O que será feito

### 1. Uma única regra de contagem

- Corrigir a função de resumo do banco para considerar situação **e** status (mesma preferência usada em Profissionais) e devolver já pronto o bloco: Total, Ativos, Disponível para escala, Férias/Licença prêmio e Afastados.
- Criar um módulo único de indicadores de força de trabalho que traduz qualquer distribuição de situações nesses cinco números, e passar todas as telas a consumi-lo — sem contas locais próprias.
- Grade de indicadores da Visão Geral do Sistema passa a ser: Total | Ativos | Disponível p/ Escala | Afastados | Unidades Ativas.

Telas alinhadas: Visão Geral do Sistema, Dashboard Executivo (Secretaria), Sala de Situação, Dashboard Executivo — RH, Situação Funcional, Centro de Controle da Força de Trabalho, Quadro de Lotação, Distribuição por Setor e os relatórios Operacionais/Gerenciais.

### 2. "Afastado por Laudo"

Passa a ser reconhecido em todos os cartões, listas, filtros e gráficos desses painéis: sempre dentro de Afastados, nunca em Ativos nem em Disponível para escala, com o rótulo "Afastado por Laudo" e cor de atenção. Hoje a tela Situação Funcional tem uma lista fixa de situações que deixa essa e outras de fora — ela passa a usar o agrupamento central.

### 3. Fim das pendências que não se aplicam

Complemento do que já foi ajustado: banco, agência e conta só são exigidos de contratados/prestadores, nunca de efetivos; e ficar sem setor deixa de gerar aviso, contador negativo ou perda de nota de integridade em qualquer relatório ou painel — ter a unidade basta.

### 4. Cargos consolidados

Rankings e listas de cargos dos painéis passam a usar o De-Para consolidado (mesma consolidação do Geral Cargos), acabando com variações repetidas do mesmo cargo.

### 5. Filtros em sincronia

Competência, unidade e modo de visualização ("Ativos" x "Quadro Geral") passam a aplicar os mesmos critérios em todas as telas e nas exportações, de forma que tela, PDF, Word e Excel batam.

## Detalhes técnicos

- Migração em `get_dashboard_summary`: `status_prof` passa a agrupar por `COALESCE(NULLIF(situacao_funcional::text,''), status::text, 'ativo')` e o retorno ganha `kpis_situacao` (total, ativos, disponiveis, ferias_licenca_premio, afastados) calculado com a mesma regra.
- Novo `src/lib/kpis-forca-trabalho.ts`: `kpisDoBreakdown(map)` derivado de `derivarSituacao`/`grupoSituacao`/`ATIVOS_STATUS`/`DISPONIVEL_STATUS` de `src/lib/situacao-funcional.ts`, mais `AFASTADOS_STATUS` explícito (afastado, afastado_laudo, atestado, afastamento_inss, licenca_sem_vencimento, licenca_maternidade, licenca_saude, licenca_estudo, falta_pad, vacancia, cedido).
- Consumidores atualizados: `src/components/dashboard/DashboardClassico.tsx`, `src/hooks/use-analytics.ts` (expor `kpisSituacao`), `src/routes/_authenticated/sala-situacao.tsx`, `gestao-rh.tsx`, `gestao-pessoas.index.tsx`, `gestao-pessoas.situacao-funcional.tsx` (remover o `if/else` fixo de situações), `controle-forca-trabalho.tsx` (separar Ativos de Disponível), `gestao-pessoas.lotacao.tsx`, `gestao-pessoas.distribuicao-setor.tsx`, `relatorios-gerenciais.profissionais.tsx` e `relatorios-gerenciais.index.tsx`.
- Rótulo/cor de `afastado_laudo` conferidos em `src/lib/status.ts` (StatusBadge) e usados nos filtros dessas telas.
- Cargos: aplicar `categoriaDoCargo` de `src/lib/cargo-categorias.ts` nos rankings de cargos dos painéis e relatórios.
- Integridade cadastral: `src/hooks/use-analytics.ts` deixa de pontuar `setor` e `banco`; remoção dos últimos contadores de "sem setor" como achado negativo em `relatorios-gerenciais-intelligence.ts` e no painel de inteligência.
- Validação: `bunx tsgo --noEmit`, testes de `situacao-funcional`/`workforce-alerts`, e conferência por consulta ao banco de que Total 922 / Ativos 887 / Disponível 837 / Afastados 35 batem com os cartões.
