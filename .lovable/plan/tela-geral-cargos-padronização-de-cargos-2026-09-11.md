# Tela "Geral Cargos" + padronização de cargos

Nova aba criada **ao lado de "⭐ Relatório Geral Inteligente"**, dentro dos Relatórios Gerenciais. Ela abre como uma tela própria (janela nova na navegação), sem alterar nenhuma tela existente.

## Correção 1 — causa exata do "645"

O número correto é **840** de status "ativo". O total "645 profissionais ativos" citado antes não veio de nenhuma consulta — foi uma estimativa escrita sem verificação. Daqui pra frente todo número vem de contagem executada no banco.

Contagem por status (registros não excluídos, total 922):

| Status | Qtd |
|---|---|
| ativo | 840 |
| ferias | 39 |
| licenca_premio | 10 |
| afastamento_inss | 11 |
| licenca_sem_vencimento | 10 |
| falta_pad | 4 |
| vacancia | 3 |
| licenca_saude | 2 |
| licenca_maternidade | 1 |
| licenca_estudo | 1 |
| cedido | 1 |

## Correção 2 — fórmula aplicada

- **ATIVOS = 840 + 39 (férias) + 10 (licença prêmio) = 889**
- **DISPONÍVEL PARA ESCALA = 889 − 49 = 840**
- Efetivos 491 · Prestadores/Contratados 398 (soma 889). O 398 bate com a planilha.
- Nenhum outro status entra: INSS, licença sem vencimento, falta padrão, vacância, licença saúde, maternidade, estudo e cedido seguem fora, como hoje.
- Os dois números aparecem lado a lado na tela nova e em todos os pontos que hoje mostram "Ativos" (Dashboard Executivo, Gerenciais, Relatório Geral Inteligente).

## Wireframe da tela "Geral Cargos"

```text
Geral Cargos                      [Competência: Setembro/2026 v] [( ) sempre a mais recente]
[ Ativos (889) | Geral — todos (922) ]  [ categoria consolidada | cargo exato ]
                                                     [Exportar PDF] [Exportar Excel]
+------------------------------------------------------------------------------+
| TOTAL 922   |   ATIVOS 889   |   DISPONÍVEL PARA ESCALA 840                   |
| Efetivos ativos 491 · Prestadores/Contratados 398                            |
| 49 em férias/licença prêmio (ativos, fora de escala)                         |
| 33 fora dos ativos: INSS 11 · lic. sem venc. 10 · falta padrão 4 ·           |
|    vacância 3 · lic. saúde 2 · maternidade 1 · estudo 1 · cedido 1           |
+------------------------------------------------------------------------------+
| SERVIDORES NA SECRETARIA DE SAÚDE  (soma conforme o modo: 889 ou 922)        |
| LOCAL       | HMO | LAB | VISA | CAPS | ... (unidades ativas)      | TOTAL   |
| EFETIVOS    |     |     |      |      |                            |   491   |
| PRESTADORES |     |     |      |      |                            |   398   |
|   > detalhe: Prestadores 332 · Comissionado 34 · Terceirizado 32             |
| TOTAL       |     |     |      |      |                            |   889   |
+------------------------------------------------------------------------------+
| LISTA DE CARGOS CONSOLIDADOS                                                 |
| NOME DO CARGO | EFETIVOS | PRESTADORES | ATIVOS | DISPONÍVEL                  |
| TOTAL         |   491    |     398     |  889   |    840                     |
+------------------------------------------------------------------------------+
| ESPECÍFICOS MÉDICOS: CLÍNICOS E ESPECIALISTAS                                |
| TIPO | EFETIVOS | PRESTADORES | PMM | TOTAL                                  |
+------------------------------------------------------------------------------+
| AFASTAMENTOS E AUSÊNCIAS (sempre visível)                                    |
| TIPO                   | QTD | PRINCIPAIS CARGOS AFETADOS                    |
| Afastamento INSS 11 · Lic. sem Vencimento 10 · Falta Padrão 4 ·              |
| Vacância 3 · Lic. Saúde 2 · Maternidade 1 · Estudo 1 · Cedido 1 — TOTAL 33   |
+------------------------------------------------------------------------------+
```

Modo "Ativos" soma 889; modo "Geral" soma 922 nos quatro primeiros blocos. O De-Para é o mesmo nos dois modos. O bloco de afastamentos fica sempre visível.

## Lista completa dos 81 cargos (base da consolidação)

Efetivos / Prestadores / Total ativos / Disponível — total geral **491 / 398 / 889 / 840**. Os maiores: Agente Comunitário de Saúde 190/0/190/164 · Técnica de Enfermagem 0/96/96/96 · AUX. SERV.GERAIS(I) 71/0/71/66 · Auxiliar de Serviços Gerais 0/44/44/44 · Enfermeira 0/42/42/42 · Assistente Administrativo 0/41/41/41 · TEC. EM ENFERMAGEM 40/0/40/40 · Agente de Endemias 24/1/25/22 · TECNICO DE LABORATORIO 13/10/23/23 · ENFERMEIRO(A) 18/4/22/20 · CHEFE DE DIVISAO 6/11/17/17. A tabela completa dos 81 cargos, já validada, alimenta o seed do De-Para.

## De-Para aprovado (com os 3 ajustes)

Sem alterar o cadastro individual de ninguém:

- Técnico em Enfermagem ← TEC. EM ENFERMAGEM, Técnica de Enfermagem, Técnico de Enfermagem
- Auxiliar de Enfermagem ← AUX. DE ENFERMAGEM
- Enfermeiro(a) ← ENFERMEIRO(A), Enfermeira, Enfermeiro
- Auxiliar de Serviços Gerais / Faxineiros ← AUX. SERV.GERAIS(I), Auxiliar de Serviços Gerais, Ajudante Geral, AGENTE DE ZELADORIA, ZELADOR
- Administrativo (recepção/digitação) ← Assistente Administrativo, ASSIST. AADM (I), AUXILIAR ADM (VII), AGENTE ADM (VII)
- Coordenadores ← COORDENADOR (A), COORDENADOR DE UBS, COORDENADOR DE PROGRAMAS E PROJETOS
- **Chefias de Divisão ← CHEFE DE DIVISAO** (ajuste 2: categoria própria)
- Diretores ← DIRETOR (A)
- Motoristas ← Motorista, MOTORISTA VEICULOS LEVES, MOTORISTA VEICULOS PESADOS, MOTORISTA II (VII)
- Cozinheiros ← Cozinheira, Cozinheiro, AGENTE DE ALIMENTACAO
- Técnicos de Radiologia ← Técnica em Radiologia, Técnico em Radiologia
- Auxiliar de Odontologia ← AUXILIAR ODONTOLOGIA, Auxiliar de Saúde Bucal
- Biomédico/Bioquímico ← BIOMEDICO, BIOQUIMICO
- Psicólogos ← PSICOLOGO(A), Psicóloga · Farmacêuticos ← Farmacêutica, Farmacêutico, FARMACEUTICO(A)
- Vigilância ← TECNICO VIG. SANITARIA, FISCAL DE VIGILANCIA SANITARIA
- **Endemias / Controle de Vetores ← Agente de Endemias, BORRIFADOR** (ajuste 1)
- **Assessoria Jurídica ← ASSESSOR(A)JURIDICO (A)** e **Assessoria Administrativa ← ASSES.ESP. SET. DAS, ASSES ESP. SET. DAS, ASSES.ESP.SET.DAS, ASSES.ESP.SET.DAS 01** (ajuste 3)
- Seção médica (fora da lista geral): MEDICO CLINICO GERAL, CLINICO GERAL, CLINICO GERAL/ PLANTONISTA, MEDICO PEDIATRA, GINECOLOGISTA, GINECOLOGISTA OBSTETRA, ORTOPEDISTA, ANESTESISTA, PSIQUIATRA, MEDICO CARDIOLOGISTA, MEDICO UROLOGISTA, MEDICO CIRURGIÃO GERAL, MEDICO ESPECIALISTA NEUROLOGIA, MÉDICO ULTRASSONOGRAFISTA, MEDICO AUDITOR
- Isolados: Agente Comunitário de Saúde, TECNICO DE LABORATORIO, Fisioterapeuta, Fonoaudiólogo, Nutricionista, TECNICO EM NUTRICAO, Assistente Social, Maqueiro, Agente de Portaria, VIGIA, MARINHEIRO DE MAQUINA, MONITOR DE ARTES, PEDAGOGIA, Bióloga, Médica Veterinária, SECRETARIO(A), TEC.EM CONTABILIDADE, Odontólogo

## Fonte de dados e rótulos

- Mesma fonte do Cadastro de Profissionais (mesmos campos e motor de filtro), com De-Para e regra de Ativos por cima. Nenhuma consulta paralela.
- Todo resumo de vínculo efetivo é rotulado **"Efetivos ativos" (491)**, para não conflitar com o card "Efetivos" (522) do Cadastro, que conta todos os status.
- Bloco 2 mantém a linha única "Prestadores/Contratados" (398), com detalhamento expansível: Prestadores de Serviços 332, Comissionado 34, Terceirizado 32.
- Exportação Excel preserva formatação (ExcelJS: células mescladas, cor de cabeçalho, negrito, bordas, largura de coluna).

## Etapas de implementação

1. **Regra de ativos centralizada:** um único ponto define ATIVOS (ativo + férias + licença prêmio) e DISPONÍVEL PARA ESCALA (ativo), usado por todas as telas.
2. **Camada de consolidação (não destrutiva):** tabelas de categorias e De-Para cargo → categoria, com marcação de grupo médico e PMM. O cargo original continua intacto.
3. **Tela "Geral Cargos"** com os 5 blocos, seletor de competência (opção "sempre a mais recente"), toggle Ativos (889) / Geral (922) e alternância cargo exato / categoria consolidada.
4. **Exportações:** PDF com uma seção por bloco (incluindo Afastamentos) e indicação do modo no cabeçalho institucional; Excel no layout da planilha, com aba extra para o modo Geral e outra para Afastamentos.
5. **Tela de manutenção do De-Para** dentro de Cargos e Funções.
6. **Atualizar os painéis existentes** (Executivo, Gerenciais, Relatório Geral Inteligente) para mostrar Ativos e Disponível para escala lado a lado e oferecer o toggle de categoria consolidada.

## Detalhes técnicos

- Nova rota `src/routes/_authenticated/relatorios-gerenciais.geral-cargos.tsx` + entrada em `src/components/relatorios-tabs.tsx`, posicionada imediatamente após "⭐ Relatório Geral Inteligente".
- Regra de ativos em `src/lib/situacao-funcional.ts`: `ATIVOS_STATUS = ['ativo','ferias','licenca_premio']` e `DISPONIVEL_STATUS = ['ativo']`, sem alterar `VALORES_DO_GRUPO` (usado pelos filtros atuais).
- Migração: `cargo_categorias` (nome, slug, ordem, grupo geral|medico, ativo) e `cargo_categoria_map` (cargo_id → categoria_id, is_pmm), com GRANTs, RLS de leitura para autenticados e escrita restrita a quem tem permissão de administração de cadastro; seed com o De-Para acima.
- Agregação reaproveitando a fonte do Cadastro de Profissionais (`profissionais` + `cargos` + `vinculos` + `unidades`); Efetivos = vínculo natureza `efetivo`, Prestadores/Contratados = prestador, comissionado e terceirizado.
- Excel com ExcelJS; PDF com o pipeline jsPDF institucional já usado nos relatórios.
- Nada muda em folha de pagamento, PDFs oficiais ou cadastro individual.

## Fora do escopo

- Renomear/unificar cargos no cadastro original.
- Cadastrar os prestadores que faltam para fechar os 883 da planilha (hoje o banco fecha 889 pela regra nova).
