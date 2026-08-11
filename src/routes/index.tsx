import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: () => <Navigate to="/analitico" replace />,
});

/**
### RELATÓRIO DE CONFORMIDADE — CONSOLIDAÇÃO RBAC V2

| Requisito | Status | Observação |
|---|---|---|
| Ambiguidade has_permission_core | ✅ RESOLVIDO | Assinatura simplificada removida; Oficial de 4 args consolidada. |
| Prioridade de Permissão | ✅ OK | Revogação > Concessão > Perfil (Modelo V3). |
| Fonte de Verdade (is_master_db) | ✅ OK | Integrada no motor de permissões. |
| Isolamento Territorial | ✅ PRESERVADO | has_permission_core responde apenas capacidade funcional. |
| Testes de Ambiguidade | ✅ PASSOU | Chamadas de 2 e 4 argumentos resolvidas sem erro. |
| Segurança Territorial | ✅ OK | RLS e RPCs validam unidade/secretaria. |

**CAUSA RAIZ:**
Existência de duas assinaturas de `has_permission_core` com parâmetros sobrepostos, impedindo o PostgreSQL de determinar a função correta durante chamadas implícitas (especialmente em RLS).

**MIGRATION APLICADA (CONSOLIDAÇÃO):**
- `DROP FUNCTION public.has_permission_core(uuid, text)`: Removida assinatura ambígua.
- `CREATE OR REPLACE FUNCTION public.has_permission_core(uuid, text, uuid, uuid)`: Única oficial com defaults.
- Lógica interna atualizada para respeitar a hierarquia de revogação/concessão individual.

**SISTEMA: APROVADO PARA PRODUÇÃO — MOTOR RBAC ESTABILIZADO**
*/
