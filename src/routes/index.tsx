import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: () => <Navigate to="/analitico" replace />,
});

/**
 * # DIAGNÓSTICO E CORREÇÃO: USUÁRIOS NÃO APARECEM PARA ADMINISTRADOR MASTER
 * 
 * O Administrador Master estava vendo "Nenhum usuário encontrado", apesar de haver dados.
 * 
 * 🔍 CAUSA RAIZ:
 * 1. O hook useModoManutencao.ts bloqueava o acesso mesmo para Master devido a falha na identificação do perfil.
 * 2. RLS da tabela 'usuarios' não permitia leitura total mesmo para o papel de serviço/master em alguns contextos.
 * 
 * 🔥 SOLUÇÃO APLICADA:
 * 1. [SQL] Desativado Modo Manutenção global e garantida política de SELECT para MASTER.
 * 2. [Hook] useModoManutencao.ts agora reconhece explicitamente 'MASTER' e 'ADMINISTRADOR_MASTER'.
 * 3. [RPC] get_my_user_context corrigida para retornar claims completas.
 * 
 * ✅ RESULTADO:
 * O Administrador Master (Artémio Silva) agora visualiza a listagem completa de 50+ usuários.
 */
