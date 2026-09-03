# Melhoria de UX/UI: posicionamento de múltiplas assinaturas no PDF

Vale para Efetivos e Contratados: os dois usam o mesmo modal ("Posicionar assinaturas no documento"), então uma única alteração atende as duas folhas.

## Situação atual (verificada no código)

- As demais assinaturas incluídas aparecem no preview como "fantasmas" com `pointer-events-none` — não é possível clicar nelas para selecioná-las.
- A troca só acontece clicando no nome dentro do card lateral; a área do card (padding, checkbox) não seleciona.
- A assinatura ativa tem borda tracejada e não possui handles de redimensionamento, o que dificulta perceber qual está selecionada.
- Não há trava de permissão no modal: todas as assinaturas do array são editáveis por qualquer perfil (nada a corrigir para o Master, apenas confirmar).

## O que será feito

### 1. Seleção direta no preview
- Tornar as caixas fantasma clicáveis: clicar em qualquer assinatura do documento a define como ativa e sincroniza o card lateral e os sliders (X, Y, Tamanho, Página).
- Cursor de ponteiro e leve realce ao passar o mouse sobre uma assinatura inativa.

### 2. Troca de cards na barra lateral
- O card inteiro passa a selecionar a assinatura (clique em qualquer área, exceto no checkbox "Incluir no documento").
- Selecionar não altera o estado do checkbox: é possível editar a posição de uma assinatura marcada ou não marcada.
- Marcar o checkbox de uma assinatura também a torna a ativa.

### 3. Feedback visual
- Ativa: borda azul sólida (primary), opacidade total, sombra e 4 handles nos cantos.
- Inativas incluídas: borda cinza tracejada leve, sem handles, opacidade reduzida.
- O card lateral ativo mantém destaque e ganha indicação de "editando".

### 4. Redimensionamento pelos handles
- Arrastar um handle de canto ajusta o tamanho percentual (30%–200%), mantendo a proporção e respeitando os limites da página; os sliders refletem o valor em tempo real.

### 5. Permissão Master
- Confirmar que nenhum filtro de perfil restringe a lista de assinaturas no modal; o Master continua podendo reposicionar a assinatura de qualquer titular.

## Detalhes técnicos

- Arquivo afetado: `src/components/pdf/PdfPosicaoProvider.tsx` (usado pelos PDFs de Efetivos e Contratados via `pdf-posicao-bus`).
- Sem mudança de schema, de server functions ou do pipeline de geração do PDF (`src/lib/pdf-pipeline.ts`); apenas interatividade e estilos do modal.
- Fantasmas passam a receber `onPointerDown` para seleção; o arraste continua exclusivo da assinatura ativa.
- Handles usam a mesma matemática de escala (mm ↔ px) já existente, com `clamp` reaproveitado.
