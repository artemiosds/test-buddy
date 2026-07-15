
# Folha de Efetivos Aprovada — Réplica visual do padrão Ágili

Objetivo: gerar um PDF **visualmente equivalente** ao SAUDE.pdf. Somente para folhas com `status = aprovada`. Marca do rodapé mantida idêntica ao Ágili nesta primeira versão; hierarquia de agrupamento com placeholders visuais marcados.

## 1. Especificação visual confirmada no PDF de referência

- **Formato**: A4 **paisagem**, margens ~10mm.
- **Cabeçalho institucional**: retângulo com borda fina em volta, brasão à esquerda, texto à direita em 2 linhas — linha 1 pequena ("ESTADO DO PARÁ"), linha 2 em negrito ("PREFEITURA MUNICIPAL DE ORIXIMINÁ"). Fonte Helvetica.
- **Barras hierárquicas** (4 níveis), largura total, altura ~5mm cada, texto branco em **Courier** (monoespaçado):
  - Nível 1 `1 - Raiz` — marrom escuro `#8B6A2A`
  - Nível 2 `1.18 - SECRETARIA…` — marrom médio `#B8934A`
  - Nível 3 `1.18.00X - UNIDADE` — mostarda `#D4A853`
  - Nível 4 `X - SETOR` — mostarda clara `#E8C578`
- **Linha "Qtd funcionários: N"** logo abaixo das barras, sem borda, alinhada à esquerda.
- **Tabela com grade completa** (bordas verticais e horizontais em todas as células), duas linhas de cabeçalho:
  - Banda superior (mesclada): `Totalizadores` | `Hora extra` | `Férias` | `Variáveis`
  - Colunas: `Matricula | Nome | Proj | H.P | C.H | Jorn | DIAS | FALTA | ATT | MAT | 50% | 100% | 1/3 | Integ. | SAL.SUB/H. | ADIC NOT | AULAS SUPLE. | PLANTÃO | SOBRE AVISO | INCENTIVO`
  - Sub-rótulos em 2 linhas quando o texto quebra (`SAL./SUB/H.`, `ADIC/NOT`, `AULAS/SUPLE.`, `SOBRE/AVISO`).
- **Linha do profissional**: célula alta (~14mm) contendo dois blocos empilhados:
  - Bloco superior: `Matricula` centralizada em negrito | `Nome` em negrito
  - Bloco inferior separado por linha fina: `Cargo` em rótulo à esquerda | valor do cargo centralizado
  - Colunas numéricas (Proj, H.P, C.H, Jorn, …) mesclam verticalmente a linha dupla e ficam centralizadas.
- **Rodapé em 2 linhas** com régua superior:
  - Linha 1 (negrito 9pt): esquerda `Data: dd/MM/aaaa HH:mm:ss` · direita `Página: X de Y`
  - Linha 2 (regular 7pt cinza): esquerda `Data da emissão: …` · centro `ÁGILIBlue Recursos Humanos - Ágili Software Brasil` · direita `Emitido por: NOME`

## 2. Arquitetura

- Novo gerador puro em `src/lib/pdf-folha-efetivos-oficial.ts`
  - Usa **jsPDF + jspdf-autotable** já instalados.
  - Coordenadas em mm calibradas contra o PDF de referência.
  - Renderiza cabeçalho institucional, barras hierárquicas, cabeçalho de tabela em 2 níveis (via `head` do autoTable), linhas duplas (via `didParseCell`/`didDrawCell` desenhando o `Cargo`), rodapé fixo (via `didDrawPage`).
  - Segunda passada preenche `Página: X de Y` usando `doc.getNumberOfPages()`.
- Nova server function `gerarFolhaEfetivosAprovadaPDF` em `src/lib/frequencias-efetivos.functions.ts`
  - `.middleware([requireSupabaseAuth])`.
  - Recebe `{ competenciaId, unidadeId }`.
  - Verifica que **todas** as linhas estão `status = 'aprovada'` — senão retorna `{ ok: false, motivo }`.
  - Retorna DTO ordenado: `{ header, grupos: [{ unidade, setor, funcionarios: [...] }] }`.
- Botão "Baixar PDF Oficial" em `frequencias-efetivos-page.tsx`, habilitado somente quando a folha está aprovada; chama a server function, alimenta o gerador no cliente.
- Rota pública `/validar/:id` já existente é reaproveitada; o QR de assinatura é desenhado em uma faixa acima do rodapé oficial **apenas na última página**, sem invadir o layout.

## 3. Placeholders explicitamente marcados

Onde o banco ainda não fornece o dado exato do modelo Ágili, o campo é preenchido com valor visualmente coerente e destacado com `⚠` em nota discreta na 1ª página listando pendências:

- Códigos hierárquicos das 4 barras (`1`, `1.18`, `1.18.00X`, `X` do setor) — hoje `unidades`/`setores` não têm `codigo_hierarquico`.
- Rótulo "Raiz" e "SEMSA" fixos até termos `secretarias.codigo` + `municipio_config.raiz`.
- "Emitido por" usa `nome_completo` de `usuarios`; se ausente, cai para o e-mail.
- Ordem de colunas do banco → colunas do modelo já mapeada (DIAS/FALTA são separadas visualmente mas usam o mesmo `dias_falta` até desdobrarmos).

## 4. Validação visual obrigatória

Após implementar, gero um PDF de exemplo com dados reais aprovados, converto com `pdftoppm -r 200` e comparo lado a lado com `SAUDE.pdf` página 1 e 2. Ajusto larguras de coluna, cores e espaçamentos até bater. Só considero pronto após esse passe.

## 5. Fora do escopo desta entrega

- Migração para criar `codigo_hierarquico` em `unidades`/`setores` (fica para uma 2ª iteração quando você validar o visual).
- Substituição da marca central do rodapé pela identidade da Prefeitura (fica para quando você definir o texto).
- Alterações no fluxo de aprovação (permanece em `/aprovacoes`).

## 6. Ordem de execução

1. Criar `src/lib/pdf-folha-efetivos-oficial.ts` com o layout completo + dados mock e um botão de teste.
2. Calibrar larguras/cores contra o PDF de referência (Playwright + pdftoppm, iterativo).
3. Adicionar `gerarFolhaEfetivosAprovadaPDF` bloqueando não-aprovadas.
4. Ligar o botão na página de Efetivos (habilitado só quando aprovada).
5. Validação visual final e checklist de placeholders.
