# Correção crítica do autosalvamento das folhas

## Diagnóstico confirmado

- Nas folhas de Efetivos e Contratados, a célula chama `updateCampo`, que agenda a atualização de estado com `_dirty = true` e imediatamente chama `flush()`.
- Como a atualização do React ainda não foi aplicada nesse mesmo evento, `autosaveRun` lê o snapshot anterior, encontra zero linhas pendentes e retorna sem chamar a função de persistência.
- O hook interpreta esse retorno vazio como sucesso e muda o badge para “Todas as alterações salvas”, mesmo sem resposta de rede.
- Comissionados fazem parte da folha de Efetivos; Gestão-SMS é um formato de exportação da folha de Contratados. Portanto, não existem mutations separadas para essas duas nomenclaturas.
- Há ainda uma tela genérica de edição de frequência (`/frequencias/$id`) com outra mutation real, que será incluída na correção para cobrir todos os pontos editáveis.
- As políticas atuais do Supabase já permitem gravação autenticada conforme permissão/unidade; não há indicação de que esta correção exija migração de banco.

## Implementação

1. **Tornar o autosave orientado por payload real**
   - Alterar o hook para receber a versão/snapshot pendente no momento da alteração, sem depender de um `setState` ainda não concluído.
   - Fazer `flush`/debounce executar somente quando houver trabalho pendente confirmado.
   - Considerar sucesso apenas quando a função de persistência retornar confirmação válida do servidor (`ok` e quantidade processada compatível).

2. **Efetivos e Comissionados**
   - Enviar as linhas `_dirty` pela mesma `salvarFolhaEfetivos` usada pelo botão manual.
   - Manter no payload todos os campos editáveis, `competencia_id`, `unidade_id` e o `setor_id` único usado na leitura da folha; o `frequencia_id` continuará sendo resolvido com segurança pelo servidor antes do upsert em `frequencia_profissional`.
   - Cobrir edição unitária, observações com debounce e colagem em lote.

3. **Contratados e formato Gestão-SMS**
   - Enviar as linhas `_dirty` pela mesma `salvarFolhaContratados` usada pelo botão manual.
   - Preservar todos os campos editáveis, competência, unidade e setor corrente para o upsert em `frequencias_contratados`.
   - Cobrir edição unitária, observações com debounce e colagem em lote.

4. **Tela genérica de frequência**
   - Integrar o autosave com `salvarLinhasFrequencia`, respeitando a folha aberta, os campos editáveis e o status que permite edição.
   - Reutilizar o mesmo ciclo de status e preservar o botão manual existente.

5. **Estado, concorrência e erros**
   - Exibir “Salvando alterações...” somente quando a chamada de rede começar.
   - Exibir “Todas as alterações salvas” somente depois da resposta confirmada do servidor.
   - Em erro, manter `_dirty = true`, preservar os valores locais e oferecer nova tentativa pelo badge.
   - Limpar `_dirty` apenas para o snapshot efetivamente persistido; alterações feitas durante uma requisição permanecem pendentes e entram na próxima execução da fila.
   - Evitar que invalidação/realtime sobrescreva alterações locais ainda pendentes.

## Validação obrigatória

- Adicionar testes do hook para: estado sem payload, debounce, flush após alteração, erro, retentativa e alteração concorrente durante envio.
- Verificar no navegador autenticado Efetivos/Comissionados e Contratados/Gestão-SMS: editar célula, sair do campo e confirmar uma chamada de server function que conclui o upsert no Supabase.
- Consultar a linha correspondente no banco após cada teste e recarregar a página para confirmar persistência sem clicar em “Salvar rascunho”.
- Validar observações, campo numérico e colagem em lote, além do badge nos estados salvando, salvo e erro.
- Manter os botões “Salvar rascunho” e “Enviar para análise” com o comportamento atual.