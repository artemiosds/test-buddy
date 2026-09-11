# Afastamentos e ausências também por unidade e por setor

Hoje o relatório e a tela Geral Cargos mostram os afastamentos somente por tipo, com os cargos
mais afetados (bloco 8). Vamos manter esse bloco e acrescentar dois novos, com a mesma lógica de
contagem (todos os registros fora dos ativos: afastados, licenças, INSS, vacância, cedidos etc.).

## Novos blocos

**8-A Afastamentos por unidade**
Colunas: Unidade | Quantidade | % dos afastamentos | Principais tipos (até 3, com número).
Ordenado do maior para o menor, com linha de TOTAL. Registros sem unidade aparecem como
"Sem unidade".

**8-B Afastamentos por setor**
Colunas: Setor (com a unidade entre parênteses) | Quantidade | % dos afastamentos |
Principais tipos (até 3). Ordenado por quantidade, com TOTAL. Como setor é opcional, quem não tem
setor entra em uma linha "Sem setor informado" — informativo, nunca como pendência.

Ambos aparecem logo depois do bloco 8 atual, no PDF, no Word, no Excel (novas abas) e na tela,
seguindo o mesmo escopo (Ativos ou Geral) e a mesma competência escolhida.

## Detalhes técnicos

- `src/lib/geral-cargos.ts`: durante a varredura de `foraDosAtivosLinhas`, acumular também por
  `unidade_id` e `setor_id`, guardando `Map<situacao, qtd>` para os principais tipos. Novos tipos
  `AfastamentoPorLocal` e campos `afastamentosPorUnidade` / `afastamentosPorSetor` em
  `GeralCargosDados`. Nomes vindos dos `Map` de unidades e da lista de setores já carregados
  (setor → `unidade_id` para compor o rótulo).
- `src/routes/_authenticated/relatorios-gerenciais.geral-cargos.tsx`: dois novos `AbntBloco`
  (8-A e 8-B) com `keepTogether`, alinhamentos e `foot` de total; duas novas seções de tabela na
  tela, no mesmo padrão visual da tabela de afastamentos atual.
- `src/lib/geral-cargos-export.ts`: abas "Afast. Unidades" e "Afast. Setores".
- `src/lib/geral-cargos-docx.ts`: mesmas duas tabelas no Word.
- O payload do parecer por IA passa a incluir as 5 unidades mais afetadas, para o texto citar
  concentração geográfica sem inventar números.
- Validação: `bunx tsgo --noEmit`.

## Fora do escopo

- Nenhuma mudança na regra de quem é ativo/afastado nem no cadastro.
- Sem alteração nos demais relatórios.
