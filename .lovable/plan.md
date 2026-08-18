# Plano de Auditoria e Implementação: Assinaturas Institucionais (Padrão ICP-Brasil / Lei 14.063/2020)

Este plano detalha a transição do sistema de assinaturas eletrônicas para um modelo de conformidade legal avançada, conforme a Lei 14.063/2020, integrando metadados criptográficos e validação de integridade.

## 1. Auditoria Técnica Atual

O sistema HSM Gestão implementa atualmente **Assinaturas Eletrônicas Avançadas**:
- **Autenticação**: Baseada em sessão segura (Supabase Auth).
- **Integridade**: Utiliza hashes SHA-256 e snapshots de metadados (`documentos_assinados`).
- **Rastreabilidade**: Armazena `user_id`, `timestamp`, `ip_address` (via auditoria de rede) e o caminho do artefato visual.
- **Limitação**: O PDF gerado via `jspdf` contém o selo visual e um link de validação, mas não incorpora uma assinatura PAdES (PDF Advanced Electronic Signatures) binária reconhecida automaticamente por leitores como Adobe/ITI sem integração com HSM ou certificados A1/A3.

## 2. Implementação de Melhorias de Conformidade

### Fase A: Reforço de Metadados e Evidências
- **Ações**: Atualizar a tabela `documentos_assinados` para incluir campos de `user_agent`, `fingerprint_browser` e `geolocalizacao` (opcional).
- **Validação**: O portal de validação (`/api/public/validar-documento`) exibirá o status de integridade comparando o hash do documento gerado com o registrado.

### Fase B: Integração com Carimbo de Tempo e Hash de Integridade
- **Ações**: Ao emitir um PDF, o sistema calculará o hash SHA-256 do conteúdo e o registrará no banco antes da exibição.
- **Selo de Autenticidade**: O QR Code no rodapé levará ao portal que confirma: "Este documento (Hash X) é autêntico e foi assinado por Y em Z".

### Fase C: Roteiro para Assinatura Qualificada (ICP-Brasil)
- Para documentos que exigem nível **Qualificado** (ex: atos normativos, prontuários críticos):
  - Integração via API com provedores de Certificado em Nuvem (**BirdID/VIDaaS**).
  - Fluxo de assinatura: O usuário autoriza via celular (push), e a API do provedor devolve o byte-range assinado para o PDF.

## 3. Detalhes Técnicos para o Usuário

- **Localização dos Ajustes**:
  - `src/lib/pdf-assinaturas.ts`: Centralização da lógica de renderização e injeção de metadados.
  - `src/routes/api/public/validar-documento.tsx`: Interface pública de verificação.
  - `supabase/migrations`: Estrutura de dados para persistência de evidências.

**O sistema passará a emitir um "Termo de Autenticidade" anexo ou selo de rodapé com validação criptográfica direta, garantindo validade jurídica para a maioria dos atos administrativos da Secretaria de Saúde.**
