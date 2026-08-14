# Plano de Reforço: Proteção de Arquivos de Assinatura (Soft-Delete)

Implementar uma camada de proteção para evitar que arquivos físicos de assinaturas (no Storage) sejam excluídos se já estiverem referenciados em documentos aprovados ou snapshots históricos, fechando a brecha de "arquivo não encontrado".

## Mudanças

### Backend (Banco de Dados / SQL)

- Criar a função SQL `public.assinatura_em_uso(storage_path text)` para verificar referências em `frequencia_assinaturas_snapshot` e `documentos_assinados`.
- Implementar política de RLS no Storage para o bucket `assinaturas`, bloqueando a operação `DELETE` caso a função `assinatura_em_uso` retorne verdadeiro.
- Adicionar trigger de proteção na tabela `assinaturas_institucionais` para impedir que o registro seja marcado como deletado sem os devidos cuidados com o arquivo físico, se necessário.

### Frontend / API Functions

- **`src/lib/assinatura-storage.ts`**:
  - Atualizar `removeSignatureFile` para realizar uma checagem prévia (via RPC ou consulta direta segura) antes de tentar o comando de remoção no Storage.
  - Se o arquivo estiver vinculado a um documento histórico, abortar a exclusão física e manter apenas o soft-delete no banco de dados.
- **`src/routes/_authenticated/assinaturas.tsx`**:
  - Melhorar o feedback visual na exclusão: se o arquivo for mantido por integridade histórica, informar ao usuário que o carimbo foi desativado mas o arquivo permanece preservado para validade jurídica.

## Detalhes Técnicos

- **RLS do Storage**: A barreira definitiva será no banco de dados (via `storage.objects`), garantindo que nem mesmo chamadas diretas via SDK apaguem assinaturas históricas.
- **Fluxo de Segurança**:
  1. Solicitação de exclusão.
  2. Verificação de uso em `documentos_assinados` (metadados/snapshots).
  3. Se em uso: `storage.remove()` é bloqueado pela RLS.
  4. Resultado: O sistema mantém a "prova" visual necessária para auditoria.

---

✅ Garantia de integridade dos documentos históricos.
🔒 Camada de segurança RLS no Storage (Proteção de nível de infraestrutura).
⚠️ Bloqueio de deleção física de carimbos referenciados.
