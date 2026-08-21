# Plano de Ação - Correção de Gestão de Usuários (Master)

Este plano visa corrigir o bloqueio de ações administrativas (alteração de status, perfil e exclusão) para usuários com perfil **Administrador Master**, garantindo que as operações no Supabase Auth ocorram via funções privilegiadas no servidor e que a RLS na tabela pública permita as mutações necessárias.

## Alterações Técnicas

### 1. Banco de Dados (Supabase)
- Criar políticas de RLS ausentes na tabela `public.usuarios` para permitir `UPDATE` e `DELETE` por usuários Master.
- Adicionar política para `INSERT` na tabela `public.usuarios` (caso necessário, para garantir que o Master possa criar a linha pública após o Auth criar o usuário).
- Garantir que as tabelas de vínculo (`usuario_unidades`, `usuario_secretarias`, `usuario_permissoes`) tenham políticas de `ALL` para Master.

### 2. Funções de Servidor (TanStack Start)
- Revisar `src/lib/users-admin.functions.ts`:
  - Garantir que `deleteUsuario` e `updateUsuario` utilizem o `supabaseAdmin` (Service Role) para manipular o `auth.users`.
  - Revisar `alterarPerfilStatusUsuario` para assegurar que ele tenha permissão de escrita na tabela pública (via RLS ou usando admin client se necessário, embora RLS seja preferível para a tabela pública).
  - Validar a regra de "não excluir a si mesmo" no backend.

### 3. Frontend (UI)
- Editar `src/routes/_authenticated/usuarios.tsx`:
  - Desabilitar o botão de exclusão na linha que corresponde ao `userId` do usuário logado.
  - Garantir que os dropdowns de Status e Perfil chamem as mutations corretas.
  - Adicionar feedback visual (toasts) detalhado em caso de erro ou sucesso.
  - Verificar se a mutation de exclusão está corretamente vinculada ao botão de lixeira.

## Detalhes Adicionais (Não Técnicos)
- O Administrador Master agora terá controle total sobre a lista de usuários, podendo ativar/desativar contas e remover acessos, exceto a própria conta (medida de segurança).
- O feedback visual no canto da tela confirmará cada ação realizada.

---
*Nota: A segurança será garantida através do uso de Service Role no backend para operações que o usuário comum (mesmo Master) não pode fazer diretamente via API pública do Supabase.*
