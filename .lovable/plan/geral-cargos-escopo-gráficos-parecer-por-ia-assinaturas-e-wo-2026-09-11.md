# Geral Cargos: escopo, gráficos, parecer por IA, assinaturas e Word

## 1. Escopo do documento (Ativos x Geral)

Hoje as tabelas já seguem o modo escolhido na tela, mas o cabeçalho mistura números gerais
(total de cadastros) com o modo "Ativos", o que dá impressão de divergência.

- Título/subtítulo passam a trazer o escopo: "Escopo: Somente Ativos (ativo + férias + licença
  prêmio)" ou "Escopo: Geral (Quadro Completo)".
- No modo Ativos os indicadores do cabeçalho são: Ativos, Disponível para escala, Efetivos,
  Prestadores/Contratados (sem "Total de cadastros"); no modo Geral entra também o total.
- Tabela, gráficos e destaques usam exatamente o mesmo conjunto exibido na tela, para que cada
  cargo (ACS, técnicos, enfermeiros) bata linha a linha.
- Mesmo escopo aplicado ao Excel e ao novo Word.

## 2. Gráficos no relatório (PDF e Word)

Dois gráficos, com os mesmos dados e cores dos painéis Gerenciais (Profissionais por
Unidade/Setor/Cargo):

- Barras: Top 10 cargos por quantitativo.
- Pizza/rosca: Efetivos x Prestadores de Serviço.

No PDF eles entram logo após os indicadores; no Word são embutidos como imagem, gerada a partir
do mesmo gráfico usado na tela.

## 3. Parecer Técnico Gerencial gerado por IA

Seção destacada em caixa clara, antes do fechamento: "Parecer Técnico Gerencial (Quadro da Força
de Trabalho)", escrita pela mesma inteligência artificial já integrada ao sistema (a usada na
extração de FOPAG / Piso da Enfermagem).

- A IA recebe apenas os números consolidados do escopo escolhido (efetivos x prestadores,
  disponibilidade para escala, afastamentos por tipo e cargos mais afetados) e devolve de 3 a 5
  parágrafos curtos.
- Não inventa números: os totais citados vêm do payload enviado.
- Se a IA estiver indisponível ou demorar, o relatório sai com um parecer resumido de reserva e
  aviso "parecer não assinado por IA nesta emissão" — nunca bloqueia a exportação.

## 4. Bloco de fechamento em duas colunas

- Remove a assinatura em texto da Diretora que hoje colide com o carimbo.
- Esquerda: carimbo institucional da Diretora Administrativa (Thays Mara O. Farias — Decreto
  nº 045/2025).
- Direita: traço de assinatura com "Secretário(a) Municipal de Saúde" e "Secretaria Municipal de
  Saúde de Oriximiná".
- 15 mm abaixo, apenas o box discreto de fé pública (SHA-256, autor, data/hora, IP, link de
  validação), uma única vez, na última página.

## 5. Botão "Word"

Novo botão ao lado de Excel e PDF, gerando documento com cabeçalho institucional
(Prefeitura / Secretaria), escopo e competência, os dois gráficos, tabela com bordas sóbrias e
linhas zebradas, parecer da IA e fechamento em duas colunas.

## 6. Prova de validação antes da entrega

Gero o PDF nos dois modos (Ativos e Geral) e envio prints comparando a soma da seção de
destaque/ranking com o KPI do cabeçalho de cada modo, além do confronto com a tabela da tela.

## Detalhes técnicos

- `src/routes/_authenticated/relatorios-gerenciais.geral-cargos.tsx`: escopo no título/subtítulo,
  KPIs condicionais ao modo, gráficos (Top 10 cargos e Efetivos x Prestadores), campo `parecer`,
  novo botão Word.
- `src/lib/relatorio-abnt.ts`: suportar bloco opcional `parecer` (caixa com título e parágrafos)
  antes do fechamento; no modo `fechamentoUnico`, fechamento em 2 colunas (carimbo à esquerda via
  `pdf-assinaturas`/`aplicarSelo`, traço + cargo à direita) e box de fé pública 15 mm abaixo, sem
  repetição nas páginas intermediárias. Os gráficos usam o suporte já existente (`graficos`:
  `barras` e `rosca`).
- Novo `src/lib/geral-cargos-parecer.functions.ts` (`createServerFn`) chamando a camada de IA
  existente (`src/lib/ai-providers/runtime.server.ts`, mesma usada por `piso-fopag-ia`), com
  prompt determinístico, limite de tokens e fallback textual em caso de erro/timeout.
- Novo `src/lib/geral-cargos-docx.ts` com a biblioteca `docx` (adicionar dependência), importado
  dinamicamente no clique do botão; gráficos convertidos em PNG a partir do render de recharts
  (mesma paleta) e embutidos via `ImageRun`.
- Validação: `bunx tsgo --noEmit` + geração real do PDF nos dois modos com prints de conferência.

## Fora do escopo

- Nenhuma alteração em cadastros, permissões ou nos números do banco.
- Sem mudança nos demais relatórios (as novas opções são opcionais).
