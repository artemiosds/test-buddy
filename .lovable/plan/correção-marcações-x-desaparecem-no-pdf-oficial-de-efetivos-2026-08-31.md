# Correção: marcações "X" desaparecem no PDF Oficial de Efetivos

## O que foi verificado

No PDF enviado, a coluna **Férias 1/3** aparece vazia em todas as linhas, embora o valor tenha sido digitado na grade.

Causa confirmada no código:

- A grade grava os campos como texto (input `type="text"`), então um "X" é salvo normalmente no banco.
- Na montagem dos totais para o PDF (`frequencias-efetivos-page.tsx` ≈ linha 788 e `frequencias_.$id.tsx` ≈ linha 948), **todos** os campos passam por `parseNumeroPtBr(...)`. Esse parser remove letras: `"X"` vira `""` e depois `0`.
- No gerador (`pdf-folha-efetivos-oficial.ts`, linhas 226 e 452), a coluna imprime `t.ferias_terco ? "X" : ""` — como o valor chegou como `0`, imprime vazio.

Ou seja, o texto digitado não foi perdido no banco; ele é descartado na conversão para o PDF. O mesmo acontece com qualquer marcação textual digitada em outras colunas variáveis.

## Correção proposta

1. **Preservar marcações textuais na montagem dos totais.** Nos dois pontos de exportação, usar uma regra única: se o valor bruto for numérico (ou vazio), converter com `parseNumeroPtBr`; se for um texto não numérico (ex.: `X`, `x`, `SIM`), enviar a string original ao gerador em vez de zerá-la.
2. **Imprimir a marcação no PDF.** No gerador, a coluna 1/3 passa a seguir: situação/afastamento tem prioridade (comportamento atual); valor textual imprime o próprio texto em maiúsculo; valor numérico maior que zero imprime `X`; zero/vazio fica em branco. A mesma tolerância a texto vale para as demais colunas variáveis, que hoje imprimem em branco quando recebem texto.
3. **Altura da linha.** O cálculo de altura dinâmica usa o mesmo mapa de valores, então a marcação já entra no cálculo — sem risco de sobreposição.

## Escopo

- Apenas o PDF Oficial de Efetivos e a montagem dos seus totais. Contratados e Gestão-SMS ficam inalterados.
- Sem alteração de banco, de gravação da folha ou do layout do cabeçalho.

## Detalhes técnicos

- Novo helper em `src/lib/numero-ptbr.ts`: `valorCelula(v)` retornando `number | string` (texto quando não numérico), reutilizado pelos dois pontos de exportação.
- Tipos de `ItemFolha.totais` em `src/lib/pdf-folha-efetivos-oficial.ts` já aceitam `number | string`; ajustar apenas a formatação (`fmt` e o mapa `values`/`calcularAlturaLinha`, linhas ~226 e ~452).
- Validação: gerar novamente a folha 09/2026 do SAMU e conferir o "X" na coluna 1/3.
