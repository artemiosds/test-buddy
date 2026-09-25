# Restaurar o padrão correto dos carimbos nos PDFs

## Objetivo
Voltar ao padrão mostrado no anexo: imagem do carimbo na parte superior, traço horizontal, nome e cargo abaixo, sem sobreposição com a tabela, validação ou rodapé.

## Causa confirmada
A última alteração mudou os três geradores para `somenteImagem: true`, removendo o traço, nome e cargo que faziam parte do padrão anterior. Na mesma alteração, a validação eletrônica foi deslocada de 30 mm para 36 mm acima do fim da página, aproximando-a da área dos carimbos.

## Correção
1. Restaurar o bloco completo de assinatura nos três fluxos:
   - PDF Oficial de Efetivos;
   - PDF Oficial de Contratados;
   - Modelo Gestão-SMS de Contratados.
2. Repor a validação eletrônica na faixa anterior, abaixo das assinaturas, preservando o espaço do rodapé.
3. Manter intactas as configurações cadastradas de posição horizontal, tamanho, ordem, assinatura e carimbo.
4. Manter a compactação atual das tabelas, fontes e regra do traço para campos vazios.
5. Ajustar somente o limite vertical de segurança para considerar a altura completa do conjunto imagem + traço + nome + cargo, impedindo qualquer colisão.

## Validação
- Gerar os três tipos de PDF com duas assinaturas.
- Conferir visualmente que o resultado corresponde ao anexo.
- Confirmar ausência de sobreposição entre tabela, carimbos, nomes, cargos, validação e rodapé.
- Verificar que nenhuma posição ou tamanho salvo foi alterado no cadastro.
- Confirmar que o projeto permanece sem erros.
