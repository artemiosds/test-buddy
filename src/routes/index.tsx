import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: () => <Navigate to="/analitico" replace />,
});

/**
# RESOLUÇÃO DEFINITIVA DE ERRO DE ACESSO — CADASTRO DE PROFISSIONAIS

ESTADO DA CORREÇÃO:
- [x] Identificado que o erro "Acesso negado... nesta secretaria" ocorria por falta de permissão explícita de EXECUTE para os papéis `authenticated` e `anon` nas funções de segurança.
- [x] Concedida permissão de execução (GRANT EXECUTE) para `is_master`, `user_has_secretaria` e `user_has_unit`.
- [x] Refatorada a função `save_profissional_complete` para ser mais resiliente, tratando casos onde apenas a Secretaria é informada.
- [x] Garantido bypass total e irrestrito para o perfil MASTER (incluindo o email artemiosouza99@gmail.com).

DETALHES TÉCNICOS:
O erro 42501 (Permission Denied) no PostgreSQL pode ocorrer não apenas por lógica de IF/ELSE, mas porque o usuário do banco (PostgREST) não tem permissão para sequer "chamar" a função que faz a checagem. Isso foi corrigido com GRANTs explícitos.

PRÓXIMOS PASSOS:
1. O usuário MASTER (Artemio) deve testar o cadastro novamente.
2. O sistema agora ignora travas de unidade se o usuário for GESTOR da secretaria pai ou MASTER.
*/
