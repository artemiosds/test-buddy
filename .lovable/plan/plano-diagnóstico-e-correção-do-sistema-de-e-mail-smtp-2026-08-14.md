# Plano: Diagnóstico e Correção do Sistema de E-mail (SMTP)

O sistema de e-mail (SMTP) não está funcionando porque as variáveis de ambiente necessárias (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`) não foram configuradas no ambiente de execução. Como agente, não posso acessar ou definir segredos diretamente.

## Ações Recomendadas

### 1. Configuração de Segredos (Ação do Usuário)
O usuário deve configurar as seguintes variáveis no painel de segredos do Lovable (Settings > Secrets) para o Gmail:
- `SMTP_HOST`: `smtp.gmail.com`
- `SMTP_PORT`: `587`
- `SMTP_USER`: Seu e-mail do Gmail (ex: `artemiosouza99@gmail.com`)
- `SMTP_PASSWORD`: **Senha de App** do Google (não a senha comum).
- `SMTP_FROM`: `artemiosouza99@gmail.com`

### 2. Interface de Depuração Temporária
Para ajudar o usuário a validar a configuração sem depender de redirecionamentos automáticos ou logs cegos, manteremos a rota de teste.

- **Arquivo:** `src/routes/index.tsx`
- **Mudança:** Desativar o redirecionamento automático temporariamente para exibir o painel de diagnóstico SMTP que mostra quais variáveis estão faltando.

### 3. Melhoria na Resiliência do Código
- Refatorar `src/lib/email.server.ts` para fornecer erros mais descritivos quando as variáveis estiverem ausentes.

## Detalhes Técnicos
- O Gmail exige o uso de **App Passwords** se o 2FA estiver ativado.
- A porta `587` com `secure: false` (startTLS) é o padrão recomendado para o Gmail no Nodemailer.
