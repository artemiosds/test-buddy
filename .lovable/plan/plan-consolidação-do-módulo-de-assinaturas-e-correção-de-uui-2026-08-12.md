# Plan: Consolidação do Módulo de Assinaturas e Correção de UUIDs Malformados

O objetivo deste plano é unificar a lógica de persistência de assinaturas, eliminando a redundância de código e corrigindo o erro de sintaxe UUID causado pelo hash institucional ("3A05-D1CC-38E7-BE11") que estava sendo enviado para o campo `perfil_id`.

## User Review Required

> [!IMPORTANT]
> O valor `"3A05-D1CC-38E7-BE11"` que apareceu no seu log como `perfil_id` é na verdade o **Hash Institucional** (gerado para segurança da assinatura). Ele foi parar no campo errado devido a um erro de mapeamento no componente. A correção centralizará essa lógica para evitar que isso ocorra novamente.

## Proposed Changes

### 1. Centralização da Lógica de Persistência
- Criar/Refatorar `saveInstitutionalSignature` em `src/lib/assinaturas-institucionais.functions.ts` para ser o **único** ponto de entrada de `insert` na tabela `assinaturas_institucionais`.
- Adicionar suporte a `is_pessoal` e metadados completos nesta função.

### 2. Correção do Mapeamento de UUIDs
- **Problema Detectado**: O hash gerado pelo servidor estava sendo atribuído ao campo `perfil_id` ou `storage_path` de forma inconsistente.
- **Solução**: Garantir que o `perfil_id` venha estritamente de `me.perfil_id` (UUID válido) e o hash vá apenas para `metadata.institutional_hash` e, opcionalmente, componha o `storage_path` (que é TEXT).

### 3. Refatoração da UI (Minha Assinatura & Admin)
- Atualizar `src/routes/_authenticated/meu-perfil.assinatura.tsx` para usar o `saveInstitutionalSignature` centralizado.
- Atualizar `src/routes/_authenticated/assinaturas.tsx` para remover a lógica de `supabase.from(...).insert(...)` local e usar a função servidora.

### 4. Validação Rigorosa (Barreira de Segurança)
- Implementar em `sanitizeUUID` um bloqueio explícito para o formato de hash institucional (`XXXX-XXXX-XXXX-XXXX`), impedindo que ele chegue ao banco de dados em campos do tipo UUID.

## Technical Details

- **Tabela**: `public.assinaturas_institucionais`
- **Campos afetados**: `perfil_id` (UUID), `usuario_id` (UUID), `storage_path` (TEXT).
- **Novo Fluxo**: 
  1. Frontend coleta dados.
  2. Frontend chama `generateInstitutionalHash` (se necessário).
  3. Frontend chama `saveInstitutionalSignature`.
  4. Backend valida com Zod (estrito) e executa o `insert` via `supabaseAdmin` para garantir consistência.

## Verification Plan

### Automated Tests
- Executar `tsgo` para garantir que os tipos Zod e as chamadas de função estão corretas.
- Simular o payload com `perfil_id` malformado para validar o bloqueio do Zod.

### Manual Verification
1. Fazer upload de nova assinatura em "/meu-perfil/assinatura".
2. Verificar console para confirmar o "PAYLOAD FINAL" com `perfil_id` UUID válido.
3. Confirmar sucesso da requisição (HTTP 200).
4. Verificar na página de administração ("/assinaturas") se o registro aparece corretamente.
