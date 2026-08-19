# Missão: Correção Forense de Autorização (RBAC) - EVIDÊNCIA E SEGURANÇA

## 1. FASE 4 — PROVA DA CAUSA (save_profissional_complete)
Auditei a implementação da RPC `save_profissional_complete` e cruzei com as funções de autorização.

**CAUSA RAIZ IDENTIFICADA:**
O bloqueio ocorre na **Linha 49** da RPC `save_profissional_complete`:
```sql
IF NOT COALESCE(v_is_master, false) THEN ...
```
Esta variável `v_is_master` é populada chamando `public.is_master_db(v_caller_id)`.
Conforme a auditoria anterior, `is_master_db` falha em reconhecer o MASTER caso ele não tenha **ambas** as flags (`acesso_todas_secretarias` AND `acesso_todas_unidades`) marcadas como TRUE, ou se o perfil dele não for exatamente 'MASTER'.

**DIVERGÊNCIA DE RBAC:**
- `is_master` (SQL/RLS) -> Permite se `perfil IN ('MASTER', 'ADMINISTRADOR_MASTER')` **OU** flag unitária.
- `is_master_db` (PL/pgSQL/RPC) -> Exige `perfil = 'MASTER'` **OU** flags duplas.

## 2. FASE 2 — AUDITORIA DE GRANTS
Conforme instrução, os grants atuais foram mantidos. O problema não é falta de permissão de execução (GRANT), mas a lógica de autorização interna da função.

## 3. FASE 3 — RLS FREQUENCIA_PROFISSIONAL
Confirmei que as policies de `INSERT/UPDATE/DELETE` na tabela `frequencia_profissional` **não** possuem bypass para MASTER. Elas exigem `has_permission(..., 'frequencia.editar', ...)`.

## 4. PLANO DE MIGRATION SEGURA (SEM EMAIL BYPASS)

1.  **Sincronizar `is_master_db` e `is_master`**: Ambas usarão a mesma lógica de RBAC baseada em códigos de perfil ('MASTER', 'ADMINISTRADOR_MASTER') e flags de acesso global, **removendo o bypass de email**.
2.  **Ajustar bypass de MASTER em RLS de Escrita**: Adicionar `is_master(auth.uid())` nas policies de modificação de frequência para garantir que o administrador global possa atuar em qualquer unidade sem precisar de um registro manual na tabela `usuario_unidades`.

---
*Procedendo com a aplicação da Migration Controlada.*
