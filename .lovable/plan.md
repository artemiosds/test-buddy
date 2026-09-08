# Ajuste de layout no PDF de Contratados

## Problema
Após remover o fallback hardcoded "CAPS II" da coluna Lotação, nomes longos de setor (ex: "UNIDADE BASICA DE SAUDE DR LAURO CORREA PINTO") estão fazendo a coluna quebrar em várias linhas, o que esprema as outras colunas. A coluna "Nº" (índice 0) está sem largura fixa, fazendo números de dois dígitos quebrarem em duas linhas.

## Alterações
1. Travar a largura da coluna Nº (índice 0) em `autoTable` para garantir espaço para até 3 dígitos.
2. Priorizar a sigla da lotação quando disponível no payload, caindo para `p.setor`, depois para o nome da unidade da folha e, por último, para "-".

## Arquivo
- `src/lib/pdf-folha-contratados-oficial.ts`

## Detalhes técnicos
- Linha 367: alterar `p.setor || input.unidadeNome || "-"` para `(it as any).lotacao_sigla || p.setor || input.unidadeNome || "-"`.
- Linha 412: alterar `0: { halign: "center" }` para `0: { cellWidth: 10, halign: "center" }`.
- Manter as demais colunas e estilos inalterados.
- Após a edição, executar `bunx tsgo --noEmit` para verificar que não há regressão de tipos.

## Validação
- Gerar um PDF de Contratados de uma unidade da Atenção Básica com setores de nome longo e confirmar que:
  - Números de dois/três dígitos na coluna Nº não quebram linha.
  - A Lotação exibe a sigla quando disponível, reduzindo a altura da linha.
  - A tabela não fica espremida nas colunas vizinhas.
