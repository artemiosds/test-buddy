# Documentos Emitidos — diagnóstico e correção

## Resposta curta

A tela **existe e está ligada ao menu**, mas **está fora do fluxo real**: hoje ela nunca vai mostrar
nada. Conferi direto no banco: a trilha de documentos emitidos tem **0 registros**, mesmo com
dezenas de relatórios em PDF já gerados no sistema.

O motivo é uma diferença entre o que o sistema tenta gravar e o que a tabela realmente aceita: o
registro é gravado com um campo de "descrição" que **não existe mais** na tabela. A gravação é
recusada, o erro é engolido em silêncio (fica apenas no console do navegador) e o PDF é baixado
normalmente — dando a impressão de que tudo funcionou. Resultado: nenhum documento entra na
trilha oficial, nenhum código de autenticidade é válido e a validação pública nunca encontra nada.

## O que já está pronto

- Item "Documentos Emitidos" no menu, com controle de permissão.
- Filtros de busca, tipo, situação e período, tabela com protocolo, autor, data e situação.
- Selo com QR Code desenhado no rodapé dos PDFs e páginas públicas de validação.
- Janela de revogação com motivo obrigatório.
- Rotina no banco que revoga com registro em auditoria (autor ou Master).
- Área de arquivo privada para guardar o PDF original.

## O que está faltando / quebrado

1. **Nada é registrado (causa raiz).** Os dois pontos que gravam o documento enviam um campo de
   descrição que não existe na tabela → gravação recusada. Tabela vazia, tela vazia.
2. **Selo e QR Code apontam para o vazio.** Como o registro não é criado, o código impresso no PDF
   ("HSM-2026-XXXX") não é encontrado na validação pública — o documento parece falso.
3. **Revogar nunca funciona.** A tela grava a revogação direto na tabela, mas não existe regra de
   acesso que permita alteração pela tela, e as colunas de situação/motivo/data de revogação também
   não existem mais. A rotina correta do banco (que grava auditoria e só permite autor ou Master)
   existe e **não é usada**.
4. **PDF original nunca fica guardado.** O caminho do arquivo é salvo na mesma gravação bloqueada;
   hoje há 0 arquivos na área privada. Consequências: "Assinar novamente" devolve erro 404, e o
   botão de baixar o original na validação sempre diz que não está disponível.
5. **Falta permissão de leitura do arquivo guardado.** A área privada permite enviar, mas não permite
   ler — então nem o autor consegue gerar o link do PDF original.
6. **Descrição sem sentido.** A tela monta a descrição como "Nome do assinante - tipo", perdendo o
   nome real do relatório e a competência, o que torna a busca por protocolo/descrição inútil.
7. **Aviso de "documento assinado" nunca chega.** A rotina que gera esse aviso procura campos que não
   existem (título, protocolo, usuário) — o evento falha em vez de notificar.
8. **Sem exportação e sem paginação.** Limite fixo de 500 registros, filtros de tipo e situação
   aplicados só depois de carregar, e nenhuma exportação Excel/PDF ABNT, ao contrário dos outros
   painéis oficiais.
9. **Duas telas de validação diferentes** (uma por link amigável, outra por busca de código), com
   textos e regras distintos.

## Correção proposta

### Etapa 1 — Fazer a trilha existir de verdade (essencial)
- Acertar a tabela: voltar a ter descrição, situação (ativo/revogado), data, autor e motivo da
  revogação, além do caminho do arquivo — para a rotina de revogação com auditoria funcionar como foi
  escrita.
- Corrigir os dois pontos de gravação para usar exatamente os campos existentes, e **deixar de
  engolir o erro**: se o registro falhar, o usuário é avisado e a falha aparece no log.
- Guardar de fato o PDF original e liberar a leitura do arquivo para o autor e para quem administra
  documentos.
- Registrar descrição útil: nome do relatório + competência/unidade, quando houver.

### Etapa 2 — Revogação e validação confiáveis
- A tela passa a revogar pela rotina oficial do banco (autor ou Master, motivo obrigatório, registro
  em auditoria) em vez de gravar direto.
- Validação pública mostrando situação real, motivo e data da revogação, e o download do original
  funcionando para quem tem direito.
- Unificar as duas telas de validação em uma única página (busca por código e link direto).

### Etapa 3 — Tela no padrão dos demais painéis
- Filtros aplicados no servidor, paginação e contadores (emitidos, ativos, revogados no período).
- Exportação em Excel e PDF ABNT.
- Corrigir o aviso de "documento assinado" para usar os campos certos.

## Verificação
- Gerar um relatório em PDF → o documento aparece na tela com protocolo, autor e data.
- Ler o QR Code do PDF → a validação pública confirma o documento como autêntico.
- Revogar com motivo → situação muda, aparece na auditoria e a validação passa a mostrar "revogado".
- "Assinar novamente" e "baixar original" abrem o PDF guardado.
