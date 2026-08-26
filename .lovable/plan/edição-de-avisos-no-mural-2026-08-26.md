# Edição de Avisos no Mural

Permitir que MASTER/GESTOR (ou o autor do aviso) edite um comunicado já publicado, direto pelo card do mural.

## Ajuste aos campos reais do sistema

A tabela de avisos usa nomes próprios; a edição vai usar os campos existentes em vez de criar novos:

- "Data de validade / expiração" = campo `data_fim` já existente (data final de exibição).
- "Categoria" = campo `tipo` já existente, com as opções atuais: Informativo, Urgente, Manutenção.
- "Prioridade" = campo `prioridade` já existente: Baixa, Normal, Alta, Crítica.
- O carimbo de atualização já é gravado automaticamente pelo banco (`atualizado_em`), não precisa de mudança de banco.

Nenhuma migração de banco é necessária.

## O que será feito

### 1. Função de servidor `editarAviso`
Em `src/lib/mural-avisos.functions.ts`, protegida por autenticação, seguindo o mesmo padrão das funções existentes (`desativarAviso`, `reativarAviso`):

- Aceita: `id` (obrigatório), `titulo`, `subtitulo`, `mensagem`, `tipo`, `prioridade`, `data_fim` (opcional/nulo), `fixado`, `ativo`.
- Validação Zod: título mínimo 3 caracteres, mensagem mínima 5 caracteres.
- Autorização: perfil `MASTER`/`GESTOR` **ou** autor do aviso (`criado_por = userId`); caso contrário retorna "Não autorizado".
- Faz o UPDATE e retorna o registro atualizado.
- Se o aviso for do tipo manutenção e o campo de modo manutenção mudar, reaplica o fluxo oficial já existente (`aplicarModoManutencao`) para não deixar o sistema travado ou liberado indevidamente.

### 2. Modal `EditarAvisoDialog.tsx`
Novo componente em `src/components/mural/`:

- Formulário pré-preenchido com os dados do aviso selecionado: Título, Subtítulo, Mensagem (editor de texto já usado no cadastro), Tipo, Prioridade, Data de validade (`data_fim`), switch "Fixado" e switch "Aviso ativo".
- Validação com Zod (título e mensagem obrigatórios), mensagens de erro no próprio campo.
- Botões "Cancelar" e "Salvar alterações" com estado de carregamento.
- Renderizado dentro de `ClientOnly` + `Suspense` (mesmo padrão do formulário de criação, por causa do editor de texto).

### 3. Integração na interface
- Novo item "Editar Aviso" no menu de três pontos do card em `MuralAvisosList.tsx` (visível para gestão ou autor).
- Mesmo botão "Editar" dentro do modal "Ver Detalhes" (`AvisoModal.tsx`), abrindo o mesmo diálogo.
- Ao salvar: fecha o modal, toast "Aviso atualizado com sucesso!" e invalidação das queries `mural-avisos`, `mural-avisos-popup` e do arquivo histórico para refletir na hora.

## Detalhes técnicos

- Server function via `createServerFn` + `requireSupabaseAuth`, update com `supabaseAdmin` carregado dentro do handler (padrão já em uso no arquivo).
- Mutation no cliente com `useServerFn` + `useMutation`, erro exibido com a mensagem real do backend.
- Verificação final com `bunx tsgo --noEmit`.
