# Tabelas Consolidadas no Relatório de Dados Salariais

Objetivo: enriquecer o bloco "Dados Salariais" (`/relatorios-gerenciais/salarios`) com 4 tabelas sintéticas de consolidação financeira, exibidas na Prévia (Etapa 6) e no PDF (Etapa 7), **antes** da listagem analítica — que permanece intacta.

## O que será entregue

Após o Resumo Executivo / Semáforo, e antes da listagem individual:

**A) Consolidado por Unidade**
Unidade | Qtd Profissionais | Total Salário Base | Total Salário Bruto | Total Salário Líquido | Custo Total
Última linha: **TOTAL GERAL DA SECRETARIA**.
Custo Total = Bruto + Horas Extras + Adicional Noturno + Gratificação Incentivo.

**B) Consolidado por Setor**
Setor | Unidade | Qtd Profissionais | Total Bruto | Total Líquido

**C) Consolidado por Cargos**
Cargo | Qtd Ocupantes | Salário Médio (bruto) | Massa Salarial Bruta Total | % da Folha
Cargos normalizados (ex.: "ENFERMEIRO(A)" e "Enfermeiro" somam no mesmo grupo).

**D) Consolidado por Vínculo Funcional**
Vínculo | Qtd | Total Base | Total Bruto | Total Líquido
Ordem fixa: Efetivo, Comissionado, Prestador de Serviços, Terceirizado, demais vínculos encontrados.

## Regras adotadas

- As tabelas consolidadas respeitam **os mesmos filtros** aplicados no wizard (unidade, setor, cargo, vínculo, status, faixas salariais e busca textual) — os totais sempre batem com a listagem analítica exibida logo abaixo.
- Só aparecem quando o bloco `dados_salariais` está presente (rota de Salários e modo salarial rápido).
- Unidades/setores sem profissionais no recorte filtrado não geram linha (evita páginas de zeros); o total geral cobre toda a base filtrada.
- Valores em BRL (R$) com separadores pt-BR, tanto na tela quanto no PDF; % da Folha com 2 casas.
- Linhas de total em negrito e destacadas.

## Detalhes técnicos

- Novo módulo puro `src/lib/relatorio-inteligente/consolidados-salariais.ts`: recebe as linhas já filtradas do bloco `dados_salariais` e devolve 4 estruturas no formato `BlocoExport` (`titulo`, `colunas`, `linhas`), com normalização de cargo/vínculo/unidade/setor e cálculo de subtotais e total geral.
- `src/routes/_authenticated/relatorio-inteligente.tsx`:
  - `StepPrevia`: renderiza os 4 quadros consolidados (cards com tabela compacta) acima dos blocos analíticos, usando `rawRows` do bloco salarial.
  - `StepExportar`: monta os consolidados e os insere no início de `blocosExp`, de modo que PDF institucional, PDF ABNT, Word, Excel e CSV recebam as tabelas na ordem correta (Cabeçalho → Resumo → Consolidados → Analítico → Assinaturas).
- Nenhuma alteração de banco, RLS ou permissões; o escopo de dados continua governado pelo RLS por unidade já existente.
