import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: () => <Navigate to="/analitico" replace />,
});

/**
 * # CONTEXTO (achado confirmado, não é hipótese)
 *
 * 1. O sistema de manutenção estava bloqueando o usuário "MASTER" (yifeh27927@duvips.com)
 *    porque o hook useModoManutencao.ts usava uma verificação incompleta de "is_master".
 *
 * **O QUE FOI CORRIGIDO:**
 * 1. Atualizamos o hook useModoManutencao.ts para incluir todas as variantes de Master
 *    (is_master boolean, códigos MASTER e ADMINISTRADOR_MASTER).
 * 2. Garantimos que o motor de permissões JWT esteja sincronizado para injetar a claim
 *    "Master" no token para usuários com acesso total.
 */
