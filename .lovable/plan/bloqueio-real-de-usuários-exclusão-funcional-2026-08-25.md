# Bloqueio real de usuários + exclusão funcional

## O que está acontecendo hoje (verificado)

1. **Bloqueado/Inativo continua navegando** — a guarda de rota `src/routes/_authenticated.tsx` (`beforeLoad`) só verifica se existe sessão e o nível de MFA. O `status` do usuário nunca é avaliado, mesmo estando disponível: a função `get_my_user_context` já retorna `status` e já ignora usuários com `deleted_at` preenchido (nesse caso retorna vazio).
2. **Excluir retorna `{}`** — a exclusão atual (`deleteUsuario`) apaga o usuário do Auth e depois a linha em `public.usuarios`. Porém 15 chaves estrangeiras apontam para `usuarios.id` sem regra de remoção em cascata (frequências, aprovações, pendências, assinaturas institucionais, competências etc.). Qualquer histórico do usuário impede a remoção, e o erro do banco chega à tela como objeto vazio porque a mensagem não é extraída da resposta.

## Correções propostas

### 1. Guarda de acesso (bloqueio real)

Na guarda `_authenticated`, após obter o contexto do usuário:

- Se o contexto vier vazio (usuário removido/soft-deleted) ou `status` for `bloqueado`, `inativo` ou `suspenso`: executar `supabase.auth.signOut()`, limpar o cache de dados e redirecionar para `/auth`.
- Passar o motivo pela URL (`?bloqueado=1`) para que a tela de login exiba o toast: "Acesso bloqueado. Entre em contato com a administração."
- Mesma verificação no listener de mudança de sessão já existente, para que um usuário bloqueado enquanto navega seja derrubado na próxima navegação/refetch.

Reforço no banco (defesa real, não só de tela): a função `has_permission` passa a negar tudo quando o usuário está bloqueado/inativo/soft-deleted, de modo que requisições feitas com um token ainda válido não retornem nem gravem dados.

### 2. Exclusão de usuário

- Criar a função de banco `excluir_usuario_completo(p_user_id uuid)` que, executada apenas por usuário MASTER e nunca sobre a própria conta:
  - remove os vínculos dependentes (unidades, secretarias, permissões, notificações);
  - desvincula referências históricas que não podem ser apagadas (aprovações, frequências, pendências, assinaturas) preservando a auditoria;
  - remove a linha em `public.usuarios`;
  - retorna JSON `{ sucesso, mensagem, id }` em vez de estourar erro cru.
- A função de servidor `deleteUsuario` passa a chamar essa RPC e depois remover a conta do Auth. Erros retornam a mensagem real (nunca `{}`).
- Na tela de usuários: toast de sucesso com a mensagem retornada e recarga da lista; em caso de falha, exibir a mensagem textual da RPC.

### 3. Alteração de status para "Bloqueado"

Ao mudar o status no dropdown, além de gravar, o sistema encerra as sessões ativas daquele usuário (revogação via Auth Admin), de forma que ele caia na tela de login na próxima ação.

## Detalhes técnicos

- Migração: `public.excluir_usuario_completo(p_user_id uuid) returns jsonb`, `security definer`, `set search_path = public`, com checagem `is_master(auth.uid())` e `grant execute to authenticated`; ajuste em `has_permission` para retornar `false` quando `status <> 'ativo'` ou `deleted_at is not null`.
- `src/routes/_authenticated.tsx`: verificação de status no `beforeLoad` + `signOut` + `redirect({ to: "/auth", search: { bloqueado: "1" } })`.
- `src/routes/auth.tsx`: leitura do parâmetro e `toast.error`.
- `src/lib/users-admin.functions.ts`: `deleteUsuario` via `context.supabase.rpc("excluir_usuario_completo", ...)`, seguido de `supabaseAdmin.auth.admin.deleteUser`; `alterarPerfilStatusUsuario` revoga sessões quando o status deixa de ser `ativo`.
- `src/routes/_authenticated/usuarios.tsx`: tratamento de retorno/erros do delete.
