# Reset Visual e Consolidação de Assinaturas Institucionais

Este plano descreve a implementação de uma solução centralizada para assinaturas institucionais em todos os geradores de PDF do sistema (Oficiais, Modelos Gestão SMS e Relatórios), garantindo consistência visual e segurança RBAC.

## Ações Realizadas

### 1. Centralização da Lógica de Assinatura
- Consolidação do uso de `resolverAssinaturasDocumento` e `drawAssinaturasBlock` (em `src/lib/pdf-assinaturas.ts`) em todos os geradores.
- A lógica respeita a prioridade: **Unidade > Secretaria > Global**.
- Suporte a dois tipos de assinatura: **Imagem** (Storage) e **Institucional** (Bloco de texto com Hash SHA-256).

### 2. Integração nos Geradores de PDF
- **Folha de Efetivos Oficial**: Integrado em `src/lib/pdf-folha-efetivos-oficial.ts`.
- **Folha de Contratados Oficial**: Integrado em `src/lib/pdf-folha-contratados-oficial.ts`.
- **Modelo Gestão-SMS (CER)**: Integrado em `src/lib/pdf-folha-contratados-modelo-cer.ts`.
- **Relatórios Gerenciais/ABNT**: Integrado em `src/lib/relatorios-gerenciais-export.ts` e `src/lib/relatorio-inteligente/export-multi.ts`.
- **Auditoria Forense**: Integrado em `src/lib/pdf-auditoria-folha.ts`.

### 3. Segurança e Integridade
- **RBAC**: A assinatura é resolvida com base no usuário autenticado e contexto da unidade.
- **UUID Fix**: Garantia de que nomes de arquivos (ex: `.png`) não contaminam colunas UUID.
- **Fallback Seguro**: Documentos continuam sendo gerados normalmente mesmo sem assinatura cadastrada.

## Detalhes Técnicos

- **Função Central**: `resolverAssinaturasDocumento` realiza o SELECT filtrado por escopo e carrega as imagens via Signed URLs convertidas para DataURL (evitando erros de CORS no jsPDF).
- **Posicionamento**: `drawAssinaturasBlock` respeita os campos `posicao_x`, `posicao_y` e `tamanho_percentual` configurados no cadastro.
- **Auditoria**: Persistência do Hash SHA-256 e metadados no `documentos_assinados` via `registrarDocumentoAssinado`.

## Testes de Verificação
- [x] Download do PDF Oficial (Efetivos/Contratados) com assinatura ativa.
- [x] Download do Modelo Gestão SMS com assinatura ativa.
- [x] Exportação de Relatórios Gerenciais com assinatura institucional.
- [x] Verificação de fallback (geração sem assinatura).
- [x] Verificação de expiração e escopo de unidade.
