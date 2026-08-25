# Correção do modal de edição de Competências

## Problema
Ao clicar em "Editar" na listagem de Competências, o modal abre com campos em branco ou desatualizados (prazos, descrição, observações) e sem os campos de período (`data_inicio` / `data_fim`).

## Solução
Ajustar o componente do formulário e a server function de edição para popular corretamente os valores e permitir a edição do período.

## Escopo
- Apenas a tela `src/routes/_authenticated/competencias.tsx`.
- Apenas a server function `editarCompetencia` em `src/lib/competencias.functions.ts`.

## Tarefas

1. **Popular formulário ao abrir (useEffect / form reset)**
   - Adicionar um `useEffect` em `CompetenciaForm` que reaja à mudança de `editing`.
   - Quando `editing` existir, injetar todos os valores nos estados:
     - `mes`: `String(competencia.mes)` (compatível com o `Select`).
     - `ano`: `competencia.ano`.
     - `secretaria_id`: `competencia.secretaria_id || ""`.
     - `prazo_envio`: `competencia.prazo_envio?.split('T')[0] || ""`.
     - `prazo_analise`: `competencia.prazo_analise?.split('T')[0] || ""`.
     - `descricao`: `competencia.descricao || ""`.
     - `observacoes`: `competencia.observacoes || ""`.
   - Quando `editing` for `null` (novo registro), resetar para os valores padrão (mês/ano atual).

2. **Adicionar campos de período (data início e data fim)**
   - Incluir inputs `type="date"` para `data_inicio` e `data_fim` no modal.
   - Formatar os valores para `YYYY-MM-DD` quando vierem do banco.
   - Manter o cálculo automático de `data_inicio` / `data_fim` ao alterar mês/ano no modo criação, mas permitir override manual nos inputs.

3. **Correção na mutation/update**
   - Atualizar o schema `EditarSchema` de `editarCompetencia` para aceitar `ano`, `mes`, `data_inicio`, `data_fim` e `secretaria_id` (todos opcionais na edição, já que a regra de negócio pode restringir edição de mês/ano/secretaria quando a competência não está "aberta").
   - Enviar esses campos no payload da edição a partir do formulário.
   - Tratar strings vazias como `null` para `prazo_envio`, `prazo_analise`, `descricao` e `observacoes`.
   - A invalidação `queryClient.invalidateQueries({ queryKey: ['competencias'] })` já existe no `onSuccess`; mantê-la.

## Critérios de aceitação
- Ao clicar em "Editar", todos os campos da competência aparecem preenchidos corretamente.
- Os campos `data_inicio` e `data_fim` são visíveis e editáveis.
- Após salvar, a tabela de competências é atualizada sem necessidade de refresh manual.
- Valores vazios de prazos/descrição/observações são persistidos como `null` no banco.

## Detalhes técnicos
- O estado interno do `CompetenciaForm` é inicializado apenas uma vez via `useState`; por isso o modal não reflete a competência selecionada. A correção depende de um `useEffect` que observe `editing`.
- A server function `editarCompetencia` atualmente só aceita `descricao`, `observacoes`, `prazo_envio` e `prazo_analise`. Será estendida para permitir a edição do período.
- Os inputs `type="date"` exigem o formato `YYYY-MM-DD`; as datas do Supabase vêm como ISO (`YYYY-MM-DDTHH:mm:ss`), portanto devem ser truncadas no cliente.
