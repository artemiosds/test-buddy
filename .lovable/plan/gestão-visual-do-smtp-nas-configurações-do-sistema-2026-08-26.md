# Gestão visual do SMTP nas Configurações do Sistema

Módulo para o Administrador Master ver, editar, testar e ativar/desativar as credenciais de e-mail direto pela tela, com os campos já preenchidos pelo que estiver salvo (ou pelas variáveis de ambiente, quando ainda não houver registro).

## 1. Banco de dados

Nova tabela `public.configuracoes_sistema`:

- `chave` (único, padrão `smtp_principal`), `smtp_host`, `smtp_port` (587), `smtp_user`,
  `smtp_password`, `smtp_from_email`, `smtp_from_name`, `smtp_secure`, `smtp_ativo`,
  `updated_at`, `updated_by`.
- RLS ativa. Nenhum acesso pelo navegador: nem `anon` nem `authenticated` recebem permissão de leitura — a senha nunca pode trafegar para o cliente. Somente o servidor (papel de serviço) lê e grava, através das funções abaixo, que exigem perfil MASTER.

Observação: a tabela existente `sistema_config` é usada apenas pelo modo manutenção e permanece intocada.

## 2. Funções de servidor (`src/lib/configuracoes-smtp.functions.ts`)

Todas com `requireSupabaseAuth` + `ensureMaster` (mesmo padrão já usado no projeto):

- `obterConfiguracaoSMTP` — devolve o registro salvo com a senha mascarada (`••••••••`) e `tem_senha_salva: true`. Sem registro, pré-preenche a partir de `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_FROM` com `tem_senha_salva` refletindo a existência de `SMTP_PASSWORD`.
- `salvarConfiguracaoSMTP` — upsert por `chave`; senha vazia ou igual à máscara preserva a senha atual; grava `updated_at`/`updated_by`.
- `testarConexaoSMTP` — usa os valores do formulário (senha mascarada → busca a salva), executa `transporter.verify()` e envia um e-mail real de teste para o e-mail do Master logado. Retorna `{ sucesso, mensagem }` ou `{ sucesso: false, erro, codigo }`, sem persistir nada.

## 3. Prioridade no disparo de e-mails

`src/lib/email.server.ts` (usado por competências, mural, testes e demais avisos) passa a resolver as credenciais nesta ordem:

1. registro ativo em `configuracoes_sistema` (`smtp_ativo = true`);
2. variáveis de ambiente atuais, como hoje.

Se o registro existir com `smtp_ativo = false`, o envio é pulado e registrado como hoje já ocorre quando faltam credenciais (sem quebrar os fluxos que chamam o envio). Como todos os disparos passam por esse helper, nenhum outro serviço precisa mudar.

## 4. Interface (`src/routes/_authenticated/configuracao.index.tsx`)

Novo card **"Servidor de E-mail (SMTP)"**, visível apenas para Master, carregado por `useQuery` no load da tela:

- Switch "Serviço de E-mail Ativo"
- Servidor SMTP e Porta
- Protocolo de segurança (STARTTLS/587 ou SSL/465) — ajusta a porta sugerida ao alternar
- Usuário de autenticação
- Senha com botão de mostrar/ocultar e texto "Deixe em branco para manter a senha atual"
- E-mail e nome de exibição do remetente
- Rodapé com data da última alteração
- Botões: **Testar Conexão / Enviar E-mail Teste** (não exige salvar antes; mostra sucesso ou o erro exato do servidor no toast) e **Salvar Alterações** (invalida a query e recarrega os dados salvos)

A rota de diagnóstico `/smtp-test` existente continua funcionando.

## Verificação

1. Abrir Configurações como Master: campos preenchidos com o SMTP em uso.
2. Testar conexão com a senha mascarada → e-mail de teste chega ao Master.
3. Alterar o nome do remetente, salvar, recarregar: valor mantido e senha preservada.
4. Abrir uma competência de teste e confirmar que o e-mail usa as credenciais do banco.
5. Informar senha errada no teste → toast com a mensagem/código de erro do servidor.
