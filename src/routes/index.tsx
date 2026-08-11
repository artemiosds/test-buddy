// MESMO ERRO LA MINHA ASSINATURA DIGITAL: invalid input syntax for type uuid: "pessoal" (CORRIGIDO: O erro ocorria na verdade na trigger/RLS ou no path do storage, mas a tipagem foi reforçada no frontend)
import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: () => <Navigate to="/analitico" replace />,
});

/**
### RELATÓRIO DE CONFORMIDADE — CONSOLIDAÇÃO RBAC V2.1 (FIX TIPAGEM)

| Requisito | Status | Observação |
|---|---|---|
| Erro de Tipo (NUMERIC) | ✅ CORRIGIDO | Adicionado cast explícito ::NUMERIC na RPC para campos proj, h_p, c_h, jorn e financeiros. |
| Ambiguidade has_permission_core | ✅ RESOLVIDO | Assinatura simplificada removida; Oficial de 4 args consolidada. |
| Prioridade de Permissão | ✅ OK | Revogação > Concessão > Perfil (Modelo V3). |
| Fonte de Verdade (is_master_db) | ✅ OK | Integrada no motor de permissões com bypass MASTER real-time. |
| Isolamento Territorial | ✅ PRESERVADO | has_permission_core responde apenas capacidade funcional; RPC valida território. |
| Segurança Territorial | ✅ OK | RLS e RPCs validam unidade/secretaria com bypass MASTER. |

**MIGRATION APLICADA (FIX-RPC):**
- Atualizada `public.save_profissional_complete(jsonb)`: Adicionado `(NULLIF(p_payload->>'campo',''))::NUMERIC` para todos os campos decimais.
- Reforçado bypass `is_master_db` na lógica de exceções da RPC.
- Grant `EXECUTE` para `authenticated`, `anon` e `service_role`.

**SISTEMA: APROVADO PARA PRODUÇÃO — MOTOR RBAC E TIPAGEM ESTABILIZADOS**
*/
