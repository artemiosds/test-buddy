# Missão: Correção Forense de Autorização (RBAC)

## 1. Auditoria Estrutural (Estrutura REAL)
- **Tabelas de Vínculo**: `usuario_unidades` (Master tem 13 vínculos), `usuario_secretarias`.
- **Hierarquia**: Determinada por `perfis.codigo` ('MASTER', 'GESTOR', 'DIRETOR_UNIDADE') e flags `acesso_todas_unidades`/`secretarias`.
- **Funções de Decisão**: `is_master_db`, `has_permission_core`, `user_has_unit`, `user_has_secretaria`.
- **RLS**: Utiliza `is_master(auth.uid())` como bypass principal em `SELECT`.

## 2. Diagnóstico de Bloqueio (Matriz Forense)

| Camada | Status | Observação |
| :--- | :--- | :--- |
| **A) auth.uid()** | OK | Identificado corretamente nas RPCs. |
| **B) Perfil** | OK | Usuário `artemiosouza99@gmail.com` é 'MASTER'. |
| **C) is_master_db** | **FALHA** | **Causa Raiz 1**: A função `is_master_db` exige que `(acesso_todas_secretarias AND acesso_todas_unidades)` sejam TRUE **OU** que o código seja exatamente 'MASTER'. Se o cache ou o JOIN falhar, o bypass em RPCs de escrita é ignorado. |
| **D) mfa_exigido_core** | **RISCO** | Identificada lógica que bloqueia usuários com `acesso_todas_unidades` se não tiverem MFA verificado e o JWT estiver em `aal1`. |
| **E) RLS** | **CONFLITO** | **Causa Raiz 2**: A política `freq_prof_update` não possui o bypass `is_master(auth.uid())`. Ela depende exclusivamente de `has_permission(..., 'frequencia.editar', cu.unidade_id)`. Se o vínculo de unidade falhar ou o cache de permissão expirar, o Master é bloqueado. |
| **F) RPC `save_...`** | **CRÍTICO** | A RPC `save_profissional_complete` usa `is_master_db` na linha 18. Se retornar FALSE, cai nas validações restritivas de unidade/secretaria. |

## 3. Plano de Correção

### Fase A: Unificação de `is_master`
- Atualizar `is_master_db` para ser idêntica à `is_master` (SQL), incluindo o fail-safe por e-mail e garantindo que o bypass seja absoluto.

### Fase B: Endurecimento de RLS
- Adicionar `is_master(auth.uid()) OR ...` explicitamente em **todas** as políticas de `UPDATE` e `DELETE` das tabelas de Frequência e Profissionais, onde hoje falta o bypass.

### Fase C: Sincronização de Cache
- Ajustar `rls_cache_put` para garantir que a invalidação ocorra ao alterar perfis, evitando que um estado "Não-Master" persista na sessão.

---
*Procedendo com a criação da Migration Forense.*
