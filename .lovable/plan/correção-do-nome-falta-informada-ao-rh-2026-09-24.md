# Correção do nome “Falta informada ao RH”

## Diagnóstico confirmado

O sistema usa internamente o código `falta_pad` em status e situação funcional. Há 8 profissionais nesse fluxo: 4 com o código somente em Status e 4 em Status e Situação Funcional.

O fluxo está funcionando, mas o texto exibido ainda contém “(PAD)” em quatro pontos: cadastro/lista de profissionais, catálogo geral de status, lançamento individual da frequência e criação automática das linhas da frequência.

## Correção

1. Manter o código interno `falta_pad` para não perder os 8 registros existentes nem quebrar filtros, indicadores, importações e histórico.
2. Alterar o nome visível para **“Falta informada ao RH”** em todas as telas e rotinas.
3. Remover “PAD” também da descrição explicativa, usando **“Falta injustificada informada ao RH.”**
4. Garantir que Status e Situação Funcional continuem reconhecendo o mesmo código, inclusive no fallback usado pelos profissionais antigos.
5. Conferir frequência, filtros, relatórios e exportações para que nenhum texto “(PAD)” permaneça.
6. Validar o projeto e pesquisar novamente todos os usos antes de concluir.

## Resultado

O usuário verá somente **“Falta informada ao RH”** em todo o sistema. A mudança é apenas de nomenclatura; os dados existentes, contagens e regras funcionais serão preservados.
