# Aumentar o tamanho das letras de afastamentos e licenças no PDF de Efetivos

## Problema
No PDF oficial de Efetivos, os textos de situação funcional (ex.: "LICENÇA PRÊMIO", "Licença sem Vencimento") repetidos nas colunas DIAS, FLT, ATT, 50%, etc. ficaram pequenos demais depois do último ajuste — hoje estão em 4pt (colunas < 10 mm) e 4,2pt (demais).

## O que será feito
No arquivo `src/lib/pdf-folha-efetivos-oficial.ts`, nos dois pontos que desenham o texto de situação (cálculo de altura da linha e desenho da célula):

1. **Subir o tamanho da fonte** de 4/4,2pt para **5,2pt** nas colunas a partir de 10 mm e **4,8pt** nas colunas mais estreitas (Proj, H.P, C.H, Jorn, ATT, MAT, 1/3).
2. **Auto-ajuste inteligente**: em vez de tamanho fixo, começar em 6pt e reduzir em passos de 0,4pt apenas quando o texto precisar de mais linhas do que cabem na altura máxima da linha (32 mm) — assim textos curtos como "FÉRIAS" ficam maiores e só os longos encolhem um pouco.
3. Manter o espaçamento entre linhas proporcional (1,1×) e a quebra por palavras, sem cortar texto.

## O que não muda
- Tabela continua parando em 136 mm (reserva de assinatura de 74 mm) — as assinaturas continuam livres da tabela.
- Números e demais células (fonte 8pt), layout, paginação, QR Code e validação permanecem iguais.
- Nenhuma alteração em banco, permissões ou fluxos.

## Validação
- Regenerar o PDF de Efetivos de outubro/2026 e inspecionar as páginas com afastados/licenças: letras legíveis (entre ~4,8 e 6pt), sem invadir assinaturas nem estourar a altura das linhas.
