# Assinaturas em todas as páginas + zona limpa no rodapé

## O que muda para o usuário

- Ao baixar o PDF oficial de Efetivos ou Contratados com várias páginas, as assinaturas escolhidas passam a aparecer em **todas** as páginas, sempre na mesma posição e tamanho definidos no modal.
- O seletor "Página X de Y" do modal continua servindo só para olhar a prévia; ele não limita mais onde a assinatura é impressa.
- O fim de cada página fica com um espaço em branco reservado (cerca de 45 mm) para as assinaturas, então nenhuma linha de funcionário fica por baixo do carimbo: a tabela quebra para a página seguinte antes de invadir essa faixa.

## Detalhes técnicos

### 1. Repetição em todas as páginas (`src/lib/pdf-pipeline.ts`)

- Criar `desenharAssinaturaEmTodasPaginas(doc, assinatura, pos)`: itera `for (let p = 1; p <= doc.getNumberOfPages(); p++)` chamando `desenharAssinaturaEm` com `pagina: p`, e ao final restaura a página corrente com `doc.setPage(total)`.
- Usar essa função nos três caminhos de desenho do `finalizarPdf`:
  - `desenharPadroes()` (fluxo sem modal, modal indisponível e fallback),
  - o laço final sobre `escolha.itens` (ignorando `item.pagina`, que passa a valer só para a prévia).
- Adicionar a opção `repetirEmTodasPaginas?: boolean` (padrão `true`) nas opções de `finalizarPdf`, para que qualquer relatório que precise do comportamento antigo possa optar por página única.
- `salvarPosicaoPadrao` continua gravando apenas X/Y/tamanho (sem página).

### 2. Zona de assinatura reservada

- Contratados (`src/lib/pdf-folha-contratados-oficial.ts`): `margin.bottom` do `autoTable` sobe de 15 para 45 mm, de modo que a quebra de página respeite a faixa. O bloco que hoje cria uma página extra para as assinaturas passa a apenas calcular `yPadraoMm` dentro da faixa reservada (`pageH - 42`), sem `addPage` adicional.
- Efetivos (`src/lib/pdf-folha-efetivos-oficial.ts`): `rodapeReserva` já é 55 mm; manter e confirmar que `limiteBaixo` cobre a altura da linha mais alta, mantendo `yPadraoMm = pageHeight - 50` dentro da faixa livre e acima do rodapé institucional (`pageHeight - 12`).

### 3. Verificação

- Typecheck com `tsgo`.
- Gerar um PDF de Efetivos e outro de Contratados com múltiplas páginas e conferir visualmente que cada página tem a assinatura na mesma posição e nenhuma linha da tabela sob ela.
