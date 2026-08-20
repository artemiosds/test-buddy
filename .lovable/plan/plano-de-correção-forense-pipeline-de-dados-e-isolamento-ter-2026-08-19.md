# Plano de Correção Forense: Pipeline de Dados e Isolamento Territorial

Este plano visa resolver a ruptura na visibilidade de dados para usuários MASTER e garantir o isolamento estrito para DIRETORES DE UNIDADE, consolidando a identidade de segurança e corrigindo o fluxo de carregamento de competências e analytics.

## 1. Consolidação da Identidade MASTER (Banco de Dados)
Substituiremos a lógica fragmentada por uma única fonte de verdade no PostgreSQL.

- **Ações:**
  - Unificar a lógica na função `public.is_master(_user_id uuid)`. Ela será a única fonte de verdade, consultando `acesso_todas_unidades`, `acesso_todas_secretarias` e códigos de perfil específicos (`MASTER`, `ADMINISTRADOR_MASTER`, `ADMIN_SMS`).
  - Atualizar `is_master_db`, `is_master_core` e `current_user_is_master` para apenas chamarem `is_master(_user_id)`.
  - Refatorar `get_my_user_context()` para utilizar `is_master(auth.uid())` internamente.
  - Garantir que a policy de `SELECT` na tabela `profissionais` e `usuarios` utilize essa lógica unificada.

## 2. Resiliência da Competência Ativa
Evitaremos que a ausência de uma competência aberta trave o dashboard.

- **Ações:**
  - Ajustar `use-competencia-ativa.ts` para lidar com retornos nulos de forma graciosa.
  - Implementar estados visuais no frontend para "Nenhuma competência ativa disponível" em vez de mascarar falhas como "0 registros".

## 3. Correção de Filtros Territoriais (useAnalytics)
Corrigir o bypass indevido e a filtragem incorreta para MASTER e Diretores.

- **Ações:**
  - **MASTER:** Omitir o filtro `.eq("unidade_id", ...)` no hook `useAnalytics` quando nenhuma unidade estiver selecionada (permitindo visão global).
  - **DIRETOR:** Tornar o filtro de `unidade_id` obrigatório e validado contra vínculos ativos (`usuario_unidades`).
  - Remover todas as ocorrências de `.eq("unidade_id", null)` que tentam simular visão global.

## 4. Isolamento Estrito para Diretores
Garantir que usuários sem vínculo territorial ativo não acessem dados globais.

- **Ações:**
  - Refatorar `use-unit-scope.ts` para que `unidadePadraoId` seja resolvido de forma fail-safe.
  - Se um Diretor não tiver unidades ativas vinculadas (`deleted_at IS NULL`), o sistema bloqueará queries territoriais e exibirá um alerta informativo.

## 5. Validação e Limpeza
- **Ações:**
  - Inserir logs temporários `AUDIT_GLOBAL_SESSION` e `AUDIT_QUERY_PARAMS` para validar a correção em tempo real.
  - Executar testes de bypass (Diretor tentando acessar ID de outra unidade via API).
  - Remover todos os logs de auditoria antes da entrega final.

---
**Critério de Aceite Final:** MASTER vê global; Diretor vê apenas sua unidade; Dashboard diferencia "Sem dados" de "Falha de escopo".
