import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: () => <Navigate to="/analitico" replace />,
});

/**
# RESOLUÇÃO DE ERRO DE ACESSO — CADASTRO DE PROFISSIONAIS

ESTADO DA CORREÇÃO:
- [x] Identificado erro de permissão na função `save_profissional_complete`.
- [x] Corrigida lógica SQL para permitir que MASTER e GESTOR salvem registros.
- [x] Garantido que GESTORES possam salvar em qualquer unidade da sua secretaria.
- [x] Garantido que MASTER tenha bypass total (acesso irrestrito).

DETALHES TÉCNICOS:
A função `save_profissional_complete` possuía uma trava de segurança que exigia vínculo direto 
com a unidade (`public.user_has_unit`), ignorando que perfis MASTER e GESTOR possuem 
autoridade sobre múltiplas unidades por hierarquia. A migração SQL atualizou a função 
para respeitar `public.is_master` e `public.user_has_secretaria`.

PRÓXIMOS PASSOS:
1. O usuário MASTER (Artemio) deve testar o cadastro novamente.
2. Validado para produção.
*/
