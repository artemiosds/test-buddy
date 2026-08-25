# Correção de Layout: Altura Dinâmica de Linha no PDF de Efetivos

## Contexto
O gerador `src/lib/pdf-folha-efetivos-oficial.ts` desenha a tabela manualmente com primitivas do jsPDF (não usa `autoTable`). Hoje a altura de cada linha de servidor é fixa (`LINHA_ALTURA = 12 mm`). Quando o servidor está com uma situação diferente de "Ativo", o texto da ocorrência (ex.: "Falta informada ao RH (PAD)", "Licença sem Vencimento") é replicado em todas as colunas numéricas, mas a célula não expande, causando sobreposição com a linha seguinte.

## Objetivo
Fazer com que a linha de cada servidor cresça dinamicamente conforme o maior conteúdo textual das suas células, eliminando sobreposições e mantendo o texto das ocorrências em todas as colunas numéricas, como está hoje.

## Escopo
Apenas `src/lib/pdf-folha-efetivos-oficial.ts`. Não alterar os geradores de Contratados nem outros modelos.

## Mudanças propostas

### 1. Calcular altura mínima da linha antes de desenhar
- Criar função `calcularAlturaLinha(doc, item)` que:
  - Para cada coluna numérica/ de ocorrência, gere o texto final com `fmt()` e aplique `doc.splitTextToSize(texto, larguraUtilDaCelula)`.
  - Considere também as células de matrícula/nome/cargo para garantir que nenhum conteúdo vaze.
  - Retorne a altura mínima necessária, respeitando uma altura mínima de segurança (ex.: 12 mm) e uma altura máxima razoável para não estourar a página.
- A largura útil da célula será `c.w - 2 mm` de padding lateral para evitar que o texto toque as bordas.

### 2. Reduzir fonte de textos longos
- Quando o texto de uma célula for considerado longo (mais de uma linha após `splitTextToSize`), usar `fontSize: 6` (ou `5.5` se ainda houver muitas quebras) e `lineHeightFactor` próximo de `1.1` para compactar verticalmente sem truncar.
- Para textos curtos, manter `fontSize: 7.5`.

### 3. Centralizar conteúdo vertical e horizontalmente
- Desenhar o texto com alinhamento horizontal central (`align: 'center'`).
- Calcular o offset vertical para centralizar o bloco de linhas dentro da célula, considerando a altura real da linha.

### 4. Desenhar linha com altura calculada
- Alterar `drawProfissionalRow(doc, y, item)` para:
  - Chamar `calcularAlturaLinha` no início.
  - Usar essa altura `h` para desenhar os retângulos das células.
  - Manter a divisão horizontal no meio da célula apenas para as colunas "matricula" e "nome" (metade superior para matrícula/nome, metade inferior para o rótulo "Cargo" / cargo).
  - Para as demais colunas, desenhar o texto centralizado verticalmente na altura calculada.
- Retornar `y + h` para que a próxima linha comece exatamente no fim da anterior.

### 5. Ajustar quebra de página
- Substituir a condição `if (y + LINHA_ALTURA > limiteBaixo)` por `if (y + alturaCalculada > limiteBaixo)` usando a altura da linha que será desenhada.
- Isso evita que uma linha alta seja cortada na transição de página.

### 6. Preservar comportamentos existentes
- Manter a lógica que replica o texto da situação em todas as colunas numéricas quando `situacao` está presente e é diferente de "Ativo".
- Não alterar o cabeçalho institucional, as barras hierárquicas, o rodapé nem o bloco de assinaturas.

## Validação
- Gerar um PDF de teste com dados que contenham ocorrências longas ("Falta informada ao RH (PAD)", "Licença sem Vencimento") em pelo menos dois servidores consecutivos.
- Verificar visualmente que:
  - O texto aparece em todas as colunas numéricas.
  - A linha do servidor aumenta de altura de forma limpa.
  - Não há sobreposição com a linha seguinte.
  - A quebra de página não corta linhas pela metade.

## Riscos e notas
- Como o desenho é manual, a centralização vertical precisa ser calculada corretamente; caso contrário o texto pode ficar deslocado para cima ou para baixo dentro da célula.
- Textos muito longos podem exigir alturas grandes; se necessário, aplicar truncamento inteligente com reticências após um limite máximo de linhas.
