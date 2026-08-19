# Plano de Restauração de Acesso Master Incondicional

O usuário Artemio Silva de Souza (MASTER) relatou perda de acesso ("acesso restrito") mesmo após correções anteriores. A auditoria identificou que, embora o perfil dele esteja correto no banco, o claim `is_master` no JWT ou o contexto do RPC podem estar falhando em situações específicas, ou há inconsistência entre o código do perfil ('MASTER') e o que as políticas RLS esperam.

## Ações Imediatas

1. **Reforçar a função SQL `is_master`**:
   - Garantir que ela seja `SECURITY DEFINER`.
   - Incluir verificação explícita pelo e-mail do administrador master principal (fail-safe).
   - Garantir que a flag `acesso_todas_unidades` seja soberana.

2. **Sincronizar Claims do JWT**:
   - O Supabase usa claims no JWT para RLS eficiente. Se o usuário foi alterado mas não deslogou, o claim pode estar antigo.
   - Vou disparar uma atualização forçada nos metadados do usuário via Admin API para garantir que `is_master: true` esteja no JWT.

3. **Correção na Interface de Usuários**:
   - Ajustar `src/routes/_authenticated/usuarios.tsx` para garantir que o estado `isMaster` (vindo do hook `useCurrentUser`) reflita a verdade absoluta e não bloqueie a tela de administração para quem é master.

4. **Verificação de RLS nas Unidades**:
   - Revisar se a política de `SELECT` em `public.unidades` está bloqueando o Master de ver a lista de unidades, o que causa o erro de "Nenhuma unidade vinculada".

## Detalhes Técnicos

- **SQL**: `CREATE OR REPLACE FUNCTION public.is_master...` com lógica de bypass total.
- **Hook**: Validar `useCurrentUser` em `src/hooks/use-permissions.ts` para garantir que `is_master` seja calculado corretamente se o RPC falhar ou demorar.
- **Admin**: Forçar `raw_app_metadata` no Supabase Auth para o e-mail em questão.
