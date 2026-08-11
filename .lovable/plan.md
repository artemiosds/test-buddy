---
name: Auditoria e Correção has_permission_core
description: Plano para resolver o erro "function public.has_permission_core(uuid, unknown) is not unique" mantendo a integridade do RBAC.
type: feature
---

# Plano de Auditoria e Correção Segura: has_permission_core

## 1. Diagnóstico e Causa Raiz
Existem duas assinaturas da função `has_permission_core` no banco de dados:
1. `has_permission_core(_user_id uuid, _perm_codigo text)`
2. `has_permission_core(_user_id uuid, _codigo text, _unidade_id uuid DEFAULT NULL, _secretaria_id uuid DEFAULT NULL)`

O erro "is not unique" ocorre quando o PostgreSQL não consegue decidir qual chamar (ex: `has_permission_core(uid, 'cod')` onde o segundo argumento pode ser tanto `_perm_codigo` quanto `_codigo`).

## 2. Ações Propostas

### Fase 1: Padronização de Assinatura
Manteremos a assinatura mais completa como a oficial:
`public.has_permission_core(uuid, text, uuid, uuid)`

1. **Remoção da Assinatura Duplicada**:
   - Identificar dependências da versão simplificada (2 argumentos).
   - Executar `DROP FUNCTION public.has_permission_core(uuid, text)` (apenas a versão de 2 argumentos).
   - *Nota: Como a versão de 4 argumentos tem defaults para os últimos 2, ela atende chamadas com 2 argumentos sem ambiguidade.*

### Fase 2: Refatoração da Lógica Interna
Implementar a prioridade estrita de permissões conforme exigido:
1. **Revogação Individual** (Prevalece sobre tudo).
2. **Concessão Individual**.
3. **Herança do Perfil** (Com suporte a override por unidade).

```sql
-- Esboço da lógica (Resumo)
-- 1. Check Master via is_master_db
-- 2. Check Revogação em usuario_permissoes (tipo = 'revogada') -> RETURN FALSE
-- 3. Check Concessão em usuario_permissoes (tipo = 'concedida') -> RETURN TRUE
-- 4. Check Perfil em perfil_permissoes -> RETURN TRUE/FALSE
```

### Fase 3: Segurança e Isolamento
- **is_master_db**: Utilizada como fonte única de verdade para Master.
- **SECURITY DEFINER**: Mantido para garantir acesso às tabelas de permissões protegidas.
- **Validação Territorial**: A função responderá apenas sobre a *capacidade funcional*. O isolamento de Unidade/Secretaria continuará sendo aplicado via RLS nas tabelas de negócio e via `user_has_unit` / `user_has_secretaria`.

## 3. Detalhes Técnicos
- **Arquivo**: Migração SQL via `supabase--migration`.
- **Dependências**: A função `has_permission` (wrapper com cache) continuará chamando a assinatura de 4 argumentos.
- **Impacto**: Nulo para o frontend, pois as chamadas existentes via RPC ou RLS já utilizam os nomes de parâmetros ou a ordem compatível.

## 4. Plano de Testes
1. `SELECT has_permission_core(uid, 'perm.codigo')` -> Deve funcionar sem erro de ambiguidade.
2. Teste de Revogação: Criar perfil com permissão e revogação individual -> Deve retornar FALSE.
3. Teste de Concessão: Perfil sem permissão e concessão individual -> Deve retornar TRUE.
4. Teste de Master: Usuário Master -> Deve retornar TRUE independente de permissões específicas.
5. Teste de Diretor: Deve respeitar overrides em `perfil_permissoes_unidade`.
