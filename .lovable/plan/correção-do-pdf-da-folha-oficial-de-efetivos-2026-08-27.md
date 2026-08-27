# Correção do PDF da Folha Oficial de Efetivos

Duas correções: valor de INCEN. saindo como "1,50" e coluna DIAS em branco.

## O que foi verificado

- No banco, as matrículas 539 e 266 têm `incentivo = "1.500"` e `dias_trabalhados = "30"`. As colunas da tabela `frequencia_profissional` são de texto, ou seja, **o valor digitado não foi perdido** — o problema é de interpretação/exibição.
- O valor "1.500" é convertido com `Number("1.500")`, que em JavaScript resulta em **1.5** (ponto tratado como decimal). Depois o formatador do PDF imprime "1,50".
- Os dois pontos de geração do PDF Oficial (tela de detalhe da frequência e a página de folha de efetivos) montam o objeto de totais **sem incluir `dias_trabalhados`**, por isso a coluna DIAS fica vazia quando o servidor não tem afastamento — apesar de o valor existir no banco.

## Correção 1 — Valores das colunas variáveis (INCEN., PLANT., SOBR., ADIC NOT, SAL. SUB/H., AULAS SUPLE.)

- Criar um parser pt-BR único (helper compartilhado) que interprete corretamente:
  - `"1.500"` e `"1.500,00"` → 1500
  - `"1500,75"` → 1500,75
  - `"1,5"` → 1,5
  - Regra: se houver vírgula, o ponto é separador de milhar; se houver apenas ponto seguido de exatamente 3 dígitos, também é milhar.
- Usar esse parser nos dois pontos que montam os totais para o PDF, em lugar de `Number(...)` direto.
- No gerador do PDF, formatar as colunas monetárias/variáveis em pt-BR com separador de milhar (`1.500,00`), sem truncar; colunas de contagem de dias (DIAS, FLT, ATT, MAT) continuam como inteiros.

## Correção 2 — Coluna DIAS

- Incluir `dias_trabalhados` no objeto de totais enviado ao gerador nos dois pontos de exportação.
- Regra de preenchimento no PDF: se o servidor tem situação/afastamento, mantém o texto da ocorrência (comportamento atual); caso contrário, imprime os dias trabalhados da competência e, se esse campo estiver vazio/zero, usa o valor de `Proj` como fallback.

## Detalhes técnicos

- Novo helper `parseNumeroPtBr` em `src/lib/` (módulo puro, sem dependências).
- Ajustes de exibição em `src/lib/pdf-folha-efetivos-oficial.ts`: a função `fmt` passa a receber o tipo de coluna (inteiro vs. valor) e formata com `toLocaleString("pt-BR")`; o mapa `values`/`calcularAlturaLinha` ganha `dias` com fallback para `proj`.
- Montagem dos totais corrigida em `src/routes/_authenticated/frequencias_.$id.tsx` (≈ linha 872) e `src/components/frequencias/frequencias-efetivos-page.tsx` (≈ linha 698), incluindo `dias_trabalhados` e o parser pt-BR.
- Escopo restrito ao PDF Oficial de Efetivos; folhas de contratados e Gestão-SMS não são alteradas.
- Validação: gerar o PDF da competência das matrículas 539 e 266 e conferir INCEN. = `1.500,00` e DIAS = `30`.
