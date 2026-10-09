# De-Para de funções na tela Geral Cargos

## O que você vai poder fazer

A tela **Relatórios → Geral Cargos** já tem os dois botões `categoria consolidada` / `cargo exato` para os cargos. Nesta mudança a mesma escolha passa a valer também para a **lista de funções**:

- **categoria consolidada** — as variações de nome de função que você cadastrar viram uma linha só (ex.: "Coordenador de UBS", "COORDENADOR (A) DE UBS" → **Coordenação de UBS**).
- **cargo exato** — cada função aparece separada, exatamente como está cadastrada (é o que acontece hoje).

As contas continuam as mesmas: efetivos, prestadores, ativos, disponível e total.

## Onde você cadastra as equivalências

Uma nova tabela editável **"De-Para de funções"** entra no bloco de conferência que já existe no pé da tela (hoje ele só mostra o De-Para de cargos, que continua somente leitura).

```text
De-Para de cargos aplicados (72 equivalências)        [somente leitura, como hoje]

De-Para de funções                                    [editar]
  Nome da função cadastrada        Categoria consolidada
  Coordenador de UBS               [Coordenação de UBS      v]
  COORDENADOR (A) DE UBS           [Coordenação de UBS      v]
  Vice-Diretor                     [Vice-Direção            v]
  ...                              [manter nome próprio     v]
                                     [Salvar equivalências]
```

- A lista de funções cadastradas vem sozinha do cadastro — nada precisa ser digitado do zero.
- Quem não for agrupado continua com o próprio nome (igual ao que já ocorre com cargos isolados).
- Só salva para quem já tem a permissão de configuração (o mesmo acesso de **Cargos e Funções**); os demais só veem a tabela de conferência.

## Como os arquivos saem

- **Excel:** a aba "Funções" sai com o agrupamento que estiver ativo, e o nome da aba/título avisa se é consolidado ou exato.
- **PDF (ABNT):** o bloco "Lista de funções" segue o mesmo agrupamento, com a legenda no subtítulo.
- **Word:** permanece como está (as funções ainda não entram nesse arquivo).

## Garantias de segurança

- Nenhum cadastro é alterado: a função de cada profissional continua exatamente como está. O De-Para é só de leitura/agrupamento.
- Sem alteração de banco de dados (sem tabela nova, sem migração). As equivalências ficam guardadas nos parâmetros já existentes da Configuração Municipal, no mesmo lugar onde estão as regras da Folha financeira.
- O De-Para de cargos, os KPIs do topo, unidades, setores, afastamentos e a seleção "Conteúdo" continuam funcionando igual.
- Se nada for cadastrado, a lista de funções sai como sai hoje.

## Detalhes técnicos

- Novo módulo puro `src/lib/funcao-categorias.ts`: normalização (sem acento/pontuação, caixa alta), `categoriaDaFuncao(nome, dePara)` e leitura do De-Para salvo; sem consultas nem efeitos colaterais.
- `src/lib/geral-cargos.ts`: passa a ler `municipio_config.parametros.funcoes_depara` (JSON) junto das demais tabelas e aplica a categoria no bloco `acumFuncoes` quando `agrupamento === "categoria"`; com `agrupamento === "cargo"` mantém o nome exato.
- `src/routes/_authenticated/relatorios-gerenciais.geral-cargos.tsx`: título da tabela vira "Lista de funções (categoria consolidada)" / "(função exata)"; segundo `TabsTrigger` renomeado para "cargo/função exato"; novo bloco `De-Para de funções` editável com salvamento em `parametros.funcoes_depara` (grava junto, sem sobrescrever `parametros.financeiro`); visível para todos, editável com `configuracao.editar`.
- `src/lib/geral-cargos-export.ts` e o gerador de PDF: recebem o rótulo de agrupamento já usado para cargos, para as funções saírem com a mesma legenda.
- Verificação: `tsgo --noEmit` nos arquivos alterados + conferência da tela no preview (alternar os dois botões e baixar Excel/PDF).
