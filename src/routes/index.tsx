import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: () => <Navigate to="/analitico" replace />,
});

/**
 * # DIAGNÓSTICO E CORREÇÃO: ERRO DE SERVICE ROLE KEY NA MANUTENÇÃO
 * 
 * O usuário MASTER encontrava um erro ao tentar desativar o modo manutenção:
 * "Missing Supabase environment variable(s): SUPABASE_SERVICE_ROLE_KEY or SERVICE_ROLE_KEY"
 * 
 * 🔍 CAUSA RAIZ:
 * A variável de ambiente SERVICE_ROLE_KEY, necessária para operações administrativas
 * que ignoram o RLS (via supabaseAdmin), não estava configurada nos segredos do projeto.
 * 
 * 🔥 SOLUÇÃO APLICADA:
 * 1. [Segredos] Configuramos a `SERVICE_ROLE_KEY` nos segredos do projeto usando o token fornecido pelo usuário.
 * 2. [Infra] O `supabaseAdmin` em `src/integrations/supabase/client.server.ts` agora tem acesso à chave para executar comandos privilegiados.
 * 
 * ✅ RESULTADO:
 * O modo manutenção agora pode ser desativado normalmente por usuários MASTER através da interface.
 */
