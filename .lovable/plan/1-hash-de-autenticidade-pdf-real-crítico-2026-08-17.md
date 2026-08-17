---
title: Plano de Correção de Vulnerabilidades Técnicas e Estabilidade (Pós-Auditoria)
description: Correção de hash de autenticidade PDF, bypass de backend em folhas aprovadas, RLS fail-safe em exclusão de assinaturas, controle de concorrência otimista e otimização N+1 em relatórios.
---

## 1. Hash de Autenticidade PDF Real (CRÍTICO)

O sistema atualmente utiliza um placeholder `SHA-256-PENDENTE`. Vamos implementar o cálculo real no momento da finalização do PDF.

- **Ação:** No `src/lib/pdf-pipeline.ts`, usar a API `SubtleCrypto` para calcular o hash do PDF (gerado via `doc.output('arraybuffer')`) antes de persistir no banco.
- **Retrocompatibilidade:** Documentos com o placeholder serão identificados na UI como "Pendente de Regularização" ou "Hash não calculado".

## 2. Bloqueio de Bypass de Backend em Folhas Aprovadas (CRÍTICO)

Usuários técnicos podem chamar `salvarFolhaEfetivos` diretamente via RPC, ignorando a trava da UI.

- **Ação:** Em `frequencias-efetivos.functions.ts` e `frequencias-contratados.functions.ts`, adicionar uma verificação de status no início do `.handler()`. 
- **Regra:** Se a folha estiver `aprovada`, apenas usuários com `is_master === true` podem prosseguir com o `upsert`.

## 3. RLS Fail-Safe para Exclusão de Assinaturas (CRÍTICO)

Políticas de RLS baseadas em funções externas podem falhar por timeout ou erro, o que no Postgres pode resultar em permissão indesejada se não houver cautela.

- **Ação:** Ajustar a policy de Storage para `assinaturas` garantindo que a negação seja explícita. O Postgres RLS é `DENY` por padrão se nenhuma política der `ALLOW`, mas vamos refinar a lógica para garantir que, se `assinatura_em_uso` não retornar `false` explicitamente (incluindo falha), a exclusão seja bloqueada.

## 4. Controle de Concorrência Otimista (ALTO)

Evitar que um usuário sobrescreva as edições de outro se ambos estiverem editando a mesma folha simultaneamente.

- **Ação:**
    - No banco, as tabelas `frequencia_profissional` e `frequencias_contratados` já possuem `updated_at`.
    - No frontend, carregar o `updated_at` de cada linha.
    - No backend (salvamento), comparar o `updated_at` enviado com o valor atual no banco.
    - Se o banco estiver mais recente, retornar erro 409 (Conflict) com a mensagem solicitada.

## 5. Otimização N+1 em Relatórios Gerenciais (ALTO)

A página `/relatorio-inteligente` está resolvendo cargos de forma ineficiente.

- **Investigação:** O `useProfissionaisLista` já faz join nominal, mas o `useGerencial` (que alimenta o `getGerencialAggregate`) pode estar fazendo queries em loop.
- **Ação:** Consolidar as estatísticas no `getGerencialAggregate` (se for o caso) ou otimizar o processamento de agrupamento no cliente para não re-processar dados pesados a cada renderização.

## Technical Details

- **SHA-256:** `crypto.subtle.digest('SHA-256', buffer)`
- **RLS:** `NOT (SELECT public.assinatura_em_uso(name))` -> Garantir que a falha da subquery não resulte em bypass.
- **Concorrência:** Adicionar campo `version` (UUID ou timestamp) no payload de salvamento.

---

Vou começar a implementação ponto a ponto.