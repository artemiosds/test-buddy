# Correção do PDF oficial da Folha de Contratados

## Diagnóstico confirmado

O PDF enviado tem 4 páginas. As assinaturas são repetidas no rodapé de todas elas e, na página 4, ocupam a mesma faixa do QR Code e do bloco de validação institucional. No gerador atual:

- a tabela reserva apenas 45 mm no rodapé;
- as assinaturas começam a 42 mm do fim da página;
- o selo de validação usa essa mesma região na última página;
- as células numéricas imprimem `0` quando o valor é zero;
- o corpo da tabela usa fonte 7 e o cabeçalho 6,5.

## Alterações

1. **Separar as áreas inferiores do PDF**
   - Reservar faixas independentes para tabela, assinaturas, validação eletrônica e rodapé.
   - Subir as assinaturas para uma posição segura.
   - Posicionar o QR Code e a validação abaixo das assinaturas, sem cobrir nomes, cargos ou linhas.
   - Aplicar o limite também às posições antigas salvas no editor de assinatura.

2. **Substituir zero por traço somente quando não há dado**
   - Nas colunas DIAS, FLT, ATT, 50%, 100%, ADN, PLANT., SOBR. e INC., imprimir `-` quando o valor for vazio, nulo ou numericamente zero.
   - Preservar normalmente valores positivos, decimais e textos de situação funcional.
   - Não alterar CPF, conta, nome, cargo ou lotação.

3. **Aumentar levemente a legibilidade**
   - Aumentar o corpo da tabela de 7 para 7,5 pontos.
   - Aumentar o cabeçalho de 6,5 para 7 pontos.
   - Manter quebra de linha e ajustar a altura automaticamente para evitar cortes.

4. **Validação visual obrigatória**
   - Gerar novamente a folha oficial de contratados.
   - Conferir todas as páginas em imagem, especialmente a última.
   - Validar ausência de sobreposição, traços nos campos sem dados, textos legíveis e rodapé completo.
   - Confirmar que o projeto continua sem erros após a alteração.

## Resultado esperado

O PDF continuará no mesmo formato oficial em A4 paisagem, porém com fonte mais legível, campos sem lançamento representados por `-` e uma faixa final organizada, sem qualquer sobreposição entre assinaturas, validação eletrônica e rodapé.
