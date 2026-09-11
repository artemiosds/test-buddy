# Setores sem coordenador + correções do Relatório Geral Inteligente

Duas frentes independentes. Nada muda em cadastro, banco ou nas seções que já estão corretas.

## Parte 1 — Tabela de setores só com números

Na seção "6-B Setores vinculados" (tela Geral Cargos, PDF e Word):

- Colunas passam a ser: Setor | Efetivos | Prestadores/Contratados | Total.
- A coluna Coordenador e a marca "! SEM COORDENADOR" desaparecem por completo.
- O subtítulo perde o aviso "(X sem coordenador vinculado…)" e fica apenas com a contagem de setores.
- O nome do setor ganha a largura liberada, com leitura mais espaçada; números continuam à direita.

## Parte 2 — Relatório Geral Inteligente / Executivo

1. **Números sem R$.** Hoje contagens saem como "R$ 922,00" porque o formatador decide pelo nome do campo (qualquer campo com "valor" vira dinheiro). Passa a decidir pelo tipo declarado do campo: quantidade → `922`, percentual → `46,8%`, e "R$" somente em campos realmente salariais. Vale para PDF institucional, PDF ABNT, Word, Excel e CSV.
2. **Assinatura só no fim.** O carimbo e a assinatura deixam de ser repetidos em todas as páginas. Da página 1 até a penúltima fica apenas o rodapé neutro: data/hora à esquerda, "Página X de Y" à direita.
3. **Fechamento oficial na última página.** Depois do último bloco, com página nova se sobrar menos de 50 mm: à esquerda o carimbo da Diretora Administrativa (sem a linha de texto que hoje fica encavalada); à direita linha de assinatura, "Secretário(a) Municipal de Saúde" e o nome da Secretaria. 12 mm abaixo, o box discreto de fé pública com hash SHA-256, emitente, data/hora, IP e link de validação — uma única vez.
4. **Cargos consolidados.** As tabelas de cargos passam a usar a mesma regra de consolidação da tela Geral Cargos, unificando variações de grafia ("TEC. EM ENFERMAGEM", "Técnica de Enfermagem" → "Técnico em Enfermagem"; "Enfermeira" → "Enfermeiro(a)").
5. **Disponíveis no painel de IA.** Os dois relatórios (Geral Inteligente e Geral de Cargos) passam a aparecer como opções de geração e parecer tanto no assistente HSM Expert quanto no painel de Inteligência dos Relatórios Gerenciais.

## Detalhes técnicos

- `src/lib/geral-cargos.ts`: remove `coordenador`/`semCoordenador` do tipo `SetoresUnidade` e da agregação (o campo `responsavel_nome` deixa de ser lido nesta agregação).
- `src/routes/_authenticated/relatorios-gerenciais.geral-cargos.tsx`: blocos 6-B com 4 colunas, sem `alertas`, nota simplificada, `columnStyles` dando ~55% ao nome do setor; tabela equivalente na tela sem a coluna.
- `src/lib/relatorio-abnt.ts`: mantém `keepTogether`; suporte a alerta vermelho continua existindo, apenas não é usado nos setores.
- Formatação: `FieldDef.tipo` ganha `"moeda" | "percentual"`; `fmtCell` (`render.ts`), `cellStr` (`export-multi.ts`), o corpo de tabela de `export-pdf-abnt.ts` e `export-word.ts` passam a receber o tipo do campo em vez de adivinhar pelo id; heurística `v > 200 && total/soma → BRL` é removida. Blocos do `catalog.ts` marcam percentuais.
- Assinaturas: a chamada `finalizarPdf` de `export-multi.ts` e `export-pdf-abnt.ts` passa `repetirEmTodasPaginas: false` e `somenteImagem: true`, com `yPadraoMm`/`xPadraoMm` no fechamento da última página.
- Fechamento e fé pública: nova função de encerramento em `export-multi.ts`/`export-pdf-abnt.ts` reaproveitando o padrão de duas colunas e o box de certificado já usados em `relatorio-abnt.ts` (`fe-publica.ts`).
- Cargos: `relatorios-gerenciais-intelligence.ts` aplica `categoriaDoCargo` de `src/lib/cargo-categorias.ts` ao montar `distribuicoes.porCargo` e `rankings.cargosMaisUtilizados`.
- Painel de IA: registrar os dois relatórios nas listas do `hsm-expert` e do `intelligence-panel`.
- Validação: `bunx tsgo --noEmit` e leitura do log de build. Não consigo abrir a tela autenticada daqui (banco externo), então a conferência visual das 21 páginas fica com você.
