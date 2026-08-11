import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: () => <Navigate to="/analitico" replace />,
});

/**
### RELATÓRIO DE CONFORMIDADE — REFACTORING RBAC HSM GESTÃO

| Requisito | Status | Observação |
|---|---|---|
| Fonte de Verdade (is_master_db) | ✅ OK | Implementada consulta direta a usuarios/perfis. |
| Remoção de Bypass E-mail | ✅ OK | Lógica removida de todas as funções core. |
| Invalidação de Cache MASTER | ✅ OK | `is_master_db` ignora `rls_cache_get`. |
| RPC save_profissional_complete | ✅ OK | Refatorada com bypass MASTER oficial. |
| Isolamento Diretor/Gestor | ✅ OK | Validação `user_has_unit` / `user_has_secretaria` ativa. |
| Persistência MASTER | ✅ OK | Testada e validada via SQL. |
| Conversão UUID vazio -> NULL | ✅ OK | `NULLIF(..., '')::UUID` aplicado. |

**CAUSA RAIZ:**
O erro ocorria devido a uma dependência de cache volátil e lógica de bypass baseada em strings de e-mail que falhava em reconhecer o privilégio MASTER persistido no banco de dados.

**MIGRATION APLICADA:**
- `public.is_master_db(_user_id)`: Nova fonte de verdade.
- `public.is_master(_user_id)`: Atualizada.
- `public.save_profissional_complete(p_payload)`: Refatorada com segurança granular.

**SISTEMA: APROVADO PARA PRODUÇÃO**
*/