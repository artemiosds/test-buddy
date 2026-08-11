# Plano de Consolidação e Implementação do Módulo de Assinaturas

Este plano visa corrigir definitivamente os erros de UUID nos formulários de assinatura, remover logs de depuração e implementar a opção de "Assinatura Eletrônica Institucional" no fluxo de perfil do usuário.

## 1. Correção Estrutural de Submit
Garantir que os campos UUID recebam apenas valores válidos ou null, isolando nomes de arquivos e caminhos de storage em suas colunas específicas.

- **Arquivos:** `src/routes/_authenticated/meu-perfil.assinatura.tsx` e `src/routes/_authenticated/assinaturas.tsx`.
- **Ação:** Refatorar a lógica de `salvar()` para remover logs de debug e aplicar `validateId` de forma rigorosa em todos os campos UUID (`usuario_id`, `perfil_id`, `unidade_id`, `secretaria_id`).

## 2. Implementação de Assinatura Eletrônica Institucional
Adicionar a opção de gerar uma assinatura baseada em metadados para usuários que não desejam fazer upload de imagem.

- **Interface:** Adicionar "Opção B" nos formulários (Upload vs Institucional).
- **Backend:** Utilizar `saveInstitutionalSignature` em `src/lib/assinaturas-institucionais.functions.ts` para persistir o hash e metadados (Nome, Cargo, Unidade, CPF mascarado, Timestamp).

## 3. Estabilização e Limpeza
- Remover o "Dashboard de Auditoria Forense" e redirecionamentos de debug em `src/routes/index.tsx`.
- Limpar `console.log` e `console.error` de depuração forense.

## Detalhes Técnicos
- O campo `storage_path` na tabela `assinaturas_institucionais` será preenchido com `institutional_<hash>` para assinaturas eletrônicas e o UUID do arquivo para uploads.
- O `mime_type` será `application/json` para assinaturas institucionais e `image/png` para uploads.
- A validação de UUID bloqueará qualquer string que contenha extensões ou barras antes de atingir o banco.
