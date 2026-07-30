## Objetivo

Inverter a arquitetura do módulo: hoje a lista nasce do arquivo importado; passará a nascer do **Cadastro de Profissionais**. A importação deixa de criar pessoas e passa a apenas atualizar valores financeiros da competência, sempre casando por CPF.

```text
Cadastro de Profissionais  →  Lista automática (por competência)
                                      ↑
                       Importação Piso + Importação FOPAG (por CPF)
                                      ↓
                        Registro consolidado da competência
```

## 1. Normalização de cargos

Nova função de normalização (`src/lib/piso-categorias.ts`) que converte qualquer grafia em três categorias:

- `ENFERMEIRO` — Enfermeira, Enfermeiro, ENFERMEIRO(A), Enfermeiro(a)
- `TECNICO_ENFERMAGEM` — TEC. EM ENFERMAGEM, Técnico/Técnica de Enfermagem
- `AUXILIAR_ENFERMAGEM` — Auxiliar de Enfermagem

Comparação sem acento, sem pontuação, caixa única. Qualquer outro cargo fica fora da elegibilidade. Testes unitários cobrindo todas as grafias listadas.

## 2. Banco de dados (migração)

Nova tabela `piso_competencia_profissional` — um registro consolidado por (profissional, competência):

- vínculo ao profissional e à competência (texto, ex. "Julho/2026")
- valores do Piso: salário base, insalubridade, auxílio financeiro piso, valor de referência, complementação, total remuneração
- valores FOPAG: tempo de serviço, HE 50%, HE 100%, plantão, sobreaviso, gratificações, vale transporte, INSS, IRRF, total descontos, total proventos, valor líquido
- origem de cada bloco (piso / fopag / ambos), status da importação, flag e detalhe de divergência
- referência à importação que gerou (para desfazer)

A tabela `piso_enfermagem` atual continua existindo como *staging* das linhas cruas do arquivo; o consolidado passa a ser a nova tabela. RLS espelhando exatamente as políticas já usadas em `piso_enfermagem` (nada de regra de segurança nova ou relaxada), com GRANTs para `authenticated`/`service_role`.

Também nova tabela `piso_pendencias` (ou view derivada) para as ocorrências: CPF não encontrado, profissional inativo, cargo incompatível, competência duplicada, valores divergentes, CPF duplicado.

## 3. Tela principal (`/piso-enfermagem`)

- Nunca abre vazia: `listPisoElegiveis` faz LEFT JOIN entre profissionais ativos das categorias de enfermagem e o consolidado da competência selecionada.
- Cards: elegíveis, enfermeiros, técnicos, auxiliares, importados, pendentes, valor total do complemento.
- Tabela com as colunas pedidas: Nome, CPF, Matrícula, Cargo, Categoria normalizada, Unidade, Carga Horária, Situação Funcional, Salário Base, Insalubridade, Auxílio Financeiro Piso, Valor de Referência, Total da Remuneração, Status da Importação.
- Filtros por categoria, unidade, status (importado/pendente/divergente) e busca por nome/CPF; paginação mantida.

## 4. Importação

Assistente atual é mantido (upload → mapeamento → pré-visualização → gravação em lotes com barra de progresso), com mudanças:

- Dois tipos de arquivo: **Piso** e **FOPAG**. O tipo é escolhido no início e define o mapeamento automático de colunas.
- Mapeamento automático FOPAG: CPF, Salário Base, Tempo de Serviço, Insalubridade, HE 50%, HE 100%, Plantão, Sobreaviso, Gratificações, Vale Transporte, Auxílio Financeiro, INSS, IRRF, Total Descontos, Total Proventos, Valor Líquido, Competência.
- Match **exclusivamente por CPF** contra o cadastro. Sem CPF correspondente → linha vai para pendências, nunca cria profissional.
- Upsert no consolidado por (profissional, competência): a segunda planilha complementa a primeira em vez de sobrescrever tudo.
- Nenhuma escrita em `profissionais`.

## 5. Aba "Cálculo" (memória de cálculo)

No dossiê/drawer do profissional, aba mostrando a conta passo a passo:

```text
Salário Base            R$ x
+ Insalubridade         R$ x
= Base considerada      R$ x
Valor de Referência     R$ x
= Complementação        R$ x
```

Quando o valor calculado diferir do importado, exibe "⚠ Divergência encontrada" com a diferença em reais, e a linha é marcada como divergente na tabela e nas pendências.

## 6. Histórico por profissional

Aba "Histórico" listando todas as competências do profissional (Julho/2026, Agosto/2026, …) com salário base, complementação e total, mais gráfico de evolução.

## 7. Dashboard

Indicadores: total elegíveis, importados, pendentes, valor total pago, maior e menor complemento, quantidade por unidade, por categoria e por carga horária, valor total por unidade e por categoria.

## 8. Tela de Pendências (`/piso-enfermagem/pendencias`)

Lista agrupada pelos seis tipos de ocorrência, com CPF/nome do arquivo, competência, detalhe e ação de ir para o cadastro do profissional.

## 9. Integração com a Folha

Nas páginas de Folha de Efetivos e Contratados, colunas adicionais alimentadas pelo consolidado da competência: Complementação Piso, Valor de Referência, Valor Total — sem sair da tela.

## 10. Auditoria

`historico_importacoes` passa a registrar por importação: usuário, data/hora, arquivo, tipo (Piso/FOPAG), competência, quantidade importada, atualizada, rejeitada, pendências e tempo de execução. "Desfazer importação" reverte o consolidado ao estado anterior daquela importação.

## Detalhes técnicos

- Servidor: novas server functions em `src/lib/piso-enfermagem.functions.ts` (`listPisoElegiveis`, `getPisoDashboard`, `listPisoPendencias`, `getPisoHistoricoProfissional`, `commitImportFopag`), todas com `requireSupabaseAuth` + checagem de permissão (`piso.visualizar` / `piso.importar`) igual ao que já existe.
- Cálculo em módulo puro `src/lib/piso-calculo.ts`, testado, reaproveitado no servidor e na UI.
- Gravação em chunks com progresso e rollback por importação (já existe em `startImportPiso`/`appendPisoLinhas`/`finalizeImportPiso`, será estendido).
- Nenhuma alteração nas políticas RLS existentes; as novas tabelas seguem o mesmo padrão.

## Ordem de execução

1. Migração das novas tabelas + RLS/GRANTs
2. Normalização de cargos e cálculo (com testes)
3. Server functions de listagem/dashboard/pendências
4. Tela principal reescrita
5. Importação Piso + FOPAG com consolidação por CPF
6. Dossiê: abas Cálculo e Histórico
7. Tela de Pendências
8. Integração com as Folhas + auditoria
