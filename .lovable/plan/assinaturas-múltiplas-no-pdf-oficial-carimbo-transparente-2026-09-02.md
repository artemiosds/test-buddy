# Assinaturas múltiplas no PDF Oficial + carimbo transparente

## Problema

1. Ao clicar em **PDF Oficial**, o modal "Posicionar assinatura no documento" trabalha com **uma única assinatura**. O pipeline (`obterAssinaturaInstitucionalAtual`) escolhe apenas uma candidata (prioridade Unidade > Secretaria > Global), por isso vem só a assinatura da Diretora da unidade selecionada — mesmo quando o usuário logado (Administrador Master / Gestor / Secretário) já tem carimbo cadastrado.
2. O carimbo é convertido para PNG com **fundo branco chapado** (`removerFundoTransparente`) para evitar fundo preto no jsPDF. Resultado: um retângulo branco por cima do documento, que não acompanha o fundo da folha.

## O que será feito

### 1. Modal com todas as assinaturas disponíveis
- O pipeline passa a resolver **a lista completa** de assinaturas aplicáveis (Direção da Unidade, Gestor/Secretário do usuário logado, carimbos institucionais) em vez de uma só.
- O modal ganha um **seletor de assinatura** (abas/lista lateral com nome + cargo). O usuário escolhe uma por vez e arrasta/ajusta X, Y, tamanho e página; cada assinatura guarda sua própria posição.
- Cada assinatura tem um interruptor **Incluir no documento**, já ligado para a do usuário logado e para a da Direção da Unidade.
- "Confirmar e Baixar" desenha **todas as assinaturas marcadas** nas posições escolhidas; "Salvar como padrão" grava a posição de cada uma separadamente.
- Se nenhuma assinatura estiver disponível, o comportamento atual (baixar direto com o selo de validação) é mantido.

### 2. Carimbo adaptado ao fundo do PDF
- Em vez de achatar contra branco, o carimbo passa a ser normalizado preservando transparência: pixels quase brancos do fundo digitalizado viram transparentes (tolerância configurável) e o traço da assinatura é mantido.
- O PNG resultante é inserido com alfa no jsPDF, então o carimbo se mistura ao fundo da folha (linhas, tabela, faixas coloridas) sem caixa branca.
- Fallback: se a conversão falhar, mantém-se o comportamento atual (fundo branco) para nunca quebrar a emissão.

## Detalhes técnicos

- `src/lib/pdf-pipeline.ts`: novo fluxo em `finalizarPdf` — resolve a lista via `resolverAssinaturasDocumento`, filtra candidatas com imagem ou titular, pré-carrega imagens (`garantirImagemAssinatura`) e desenha em loop com `desenharAssinaturaEm`. `obterAssinaturaInstitucionalAtual` é mantida para os fluxos legados (`semModal`, snapshots).
- `src/lib/pdf-posicao-bus.ts`: `PdfPosicaoRequest` passa a receber `assinaturas: AssinaturaResolvida[]`; `PdfPosicaoResult` passa a devolver um array `{ assinaturaId, xMm, yMm, pagina, tamanhoPercentual, incluir, salvarPadrao }`.
- `src/components/pdf/PdfPosicaoProvider.tsx`: estado por assinatura (mapa id → posição), seletor, checkbox de inclusão e preview do item selecionado sobre o canvas.
- `src/lib/pdf-assinaturas.ts`: `removerFundoTransparente` passa a ter modo "preservar transparência / limpar fundo claro" usado pela normalização de carimbos.
- Nenhuma alteração de banco de dados é necessária.
