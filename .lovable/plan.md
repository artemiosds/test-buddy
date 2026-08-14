# Plano de Reforço: Proteção de Arquivos de Assinatura (Soft-Delete)

Implementar uma camada de proteção para evitar que arquivos físicos de assinaturas (no Storage) sejam excluídos se já estiverem referenciados em documentos aprovados ou snapshots históricos, fechando a brecha de "arquivo não encontrado".

## Mudanças

### Backend (Banco de Dados / SQL)

- Criar uma função SQL `check_assinatura_em_uso(assinatura_id UUID)` que verifica se a assinatura está vinculada a algum snapshot em `frequencia_assinaturas_snapshot` ou a documentos em `documentos_assinados`.
- Implementar um trigger na tabela `assinaturas_institucionais` para impedir a exclusão física (ou forçar soft-delete) se o arquivo estiver em uso.
- Adicionar uma regra de integridade ou política no Storage (se possível via RLS do Storage) para impedir a remoção do objeto se ele for referenciado em snapshots.

### Frontend / API Functions

- **`src/lib/assinatura-storage.ts`**:
  - Modificar `removeSignatureFile` para validar se a assinatura está "em uso" antes de proceder com o `supabase.storage.from(...).remove()`.
  - Se estiver em uso, o sistema deve apenas marcar o registro no banco como deletado (`deleted_at`), mantendo o arquivo no bucket para integridade histórica.
- **`src/routes/_authenticated/assinaturas.tsx`**:
  - Ajustar a mutation de exclusão para exibir um aviso amigável caso a assinatura esteja protegida por uso histórico, explicando que o arquivo será mantido para validade jurídica dos documentos já assinados.

## Detalhes Técnicos

- **Soft-delete vs Hard-delete**: A exclusão no banco já é soft-delete (`deleted_at`). O problema é a chamada subsequente ao Storage.
- **Fluxo de Proteção**:
  1. `removeSignatureFile(path, userId)`
  2. Consulta `frequencia_assinaturas_snapshot` e `documentos_assinados` pelo path.
  3. Se existir referência -> Abortar remoção do arquivo físico e retornar `true` (arquivo mantido por segurança).
  4. Se não existir -> Proceder com `storage.remove()`.

---

✅ Garantia de integridade dos documentos históricos.
🔒 Prevenção contra erros de "Object not found" em PDFs antigos.
