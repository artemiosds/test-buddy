# Ajuste de contraste no PDF de Contratados

## Objetivo
Aumentar a legibilidade da tabela no PDF oficial de Contratados (`src/lib/pdf-folha-contratados-oficial.ts`), deixando grades e textos em preto puro, sem alterar tamanho de fonte ou layout das colunas.

## Arquivo alterado
- `src/lib/pdf-folha-contratados-oficial.ts`

## Alterações
1. Constantes globais de cor no topo do arquivo:
   - `COR_BORDA` de `[180, 180, 180]` para `[0, 0, 0]`.
   - `COR_TEXTO` de `[0, 0, 0]` já está correto; confirmar que permanece preto puro.

2. Bloco `styles` do `autoTable`:
   - `textColor: [0, 0, 0]`
   - `lineColor: [0, 0, 0]`
   - `lineWidth: 0.2` (aumentado levemente de `0.15`)
   - `fontSize` inalterado

3. Bloco `headStyles` do `autoTable`:
   - `textColor: [0, 0, 0]`
   - `lineColor: [0, 0, 0]`
   - `fontStyle: "bold"` mantido

## Validação
- Executar `bunx tsgo --noEmit` para confirmar ausência de regressão de tipos.
- Verificar no código-fonte que nenhum outro `textColor` ou `lineColor` do `autoTable` sobrescreve os valores com outra cor.
- Após aprovação, orientar o usuário a gerar um PDF de Contratados e inspecionar a nitidez da grade e dos textos na impressão.
