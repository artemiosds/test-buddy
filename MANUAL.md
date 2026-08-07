# Manual do Usuário e do Administrador - HSM Gestão

## 1. Visão Geral do Sistema

O **HSM Gestão** é uma plataforma integrada de gestão de saúde e recursos humanos, projetada para otimizar processos operacionais, garantir a conformidade com a LGPD e oferecer uma experiência fluida tanto em ambientes online quanto offline (PWA).

### Objetivos:
- Centralizar a gestão de frequências e competências de profissionais de saúde.
- Garantir a integridade dos dados através de auditoria constante.
- Facilitar a comunicação entre níveis operacionais e administrativos.
- Prover resiliência técnica através de tecnologias de Progressive Web App (PWA).

### Fluxo Geral de Operação:
1.  **Acesso:** Autenticação segura com múltiplos fatores (MFA).
2.  **Operação:** Lançamento de dados (frequências, documentos, ocorrências).
3.  **Auditoria/Conferência:** Verificação dos dados por níveis de supervisão.
4.  **Aprovação:** Homologação final pela administração para processamento de folha/pagamentos.

---

## 2. Controle de Acesso e Perfis (RBAC)

O sistema utiliza controle de acesso baseado em funções (Role-Based Access Control) para garantir que cada usuário visualize apenas o que é pertinente ao seu cargo.

### Perfis de Acesso:

-   **Master (Super Admin):**
    -   Acesso total a todas as unidades e configurações do sistema.
    -   Gestão de usuários, perfis e permissões críticas.
    -   Visualização de logs de auditoria técnica.
-   **Admin SMS (Administrador de Unidade):**
    -   Gestão administrativa de uma ou mais unidades específicas.
    -   Aprovação final de folhas de pagamento e fechamento de competências.
    -   Gestão de profissionais vinculados à sua jurisdição.
-   **Gestor (Coordenador/Supervisor):**
    -   Conferência e validação de frequências lançadas pelo operacional.
    -   Emissão de relatórios de desempenho e escalas.
    -   Pode retornar lançamentos para correção.
-   **Operacional (Lançador/RH Local):**
    -   Inserção de dados diários de frequência e anexos.
    -   Visualização do mural de avisos da unidade.
    -   Não possui permissão para aprovação final de documentos.

---

## 3. Guia Passo a Passo dos Módulos

### Acesso e Segurança
-   **Login:** Insira suas credenciais (E-mail/CPF e Senha). Caso seja seu primeiro acesso, siga as instruções de definição de senha enviadas por e-mail.
-   **2FA/MFA (Autenticação de Dois Fatores):** Após a senha, o sistema solicitará um código enviado via aplicativo autenticador ou e-mail. Esta camada é obrigatória para perfis administrativos.
-   **Logout e LGPD:** Ao clicar em "Sair", o sistema realiza o expurgo automático de dados sensíveis em cache local, garantindo a conformidade com a Lei Geral de Proteção de Dados (LGPD).

### Gestão de Frequências
-   **Lançamentos:** Acesse o módulo de Frequência, selecione o profissional e o período. Informe as entradas, saídas e justificativas de faltas/atrasos.
-   **Conferência:** O sistema destaca em vermelho inconsistências (ex: horas excedentes ou batidas incompletas).
-   **Ajustes e Retornos:** Se um gestor rejeitar uma frequência, o operacional receberá uma notificação com o motivo da rejeição para realizar o ajuste.
-   **Aprovação:** Somente após a validação de todas as linhas a frequência poderá ser submetida para aprovação final.

### Gestão de Competências
-   **Escalas:** Visualização mensal ou semanal das escalas de trabalho planejadas vs. realizadas.
-   **Relatórios:** Extração de dados consolidados para integração com sistemas de folha de pagamento.
-   **Homologação:** Processo de fechamento do mês, onde a unidade atesta que todos os dados de produção estão corretos.

### Notificações e Status de Conexão
-   **Sincronização em Tempo Real:** O sistema utiliza WebSockets para entregar notificações instantâneas sobre aprovações ou mensagens no mural.
-   **Indicador Online/Offline:** Localizado no topo da tela. 
    -   **Verde:** Conexão estável, dados sincronizados.
    -   **Amarelo/Vermelho:** Conexão instável ou ausente. O sistema entra em modo Read-Only para ações críticas, permitindo apenas a visualização de dados já carregados.

---

## 4. Solução de Problemas (FAQ)

### "Acesso Negado" ou Permissão Desatualizada
Se você recebeu uma nova permissão mas ainda não consegue acessar o módulo, sua sessão pode estar com o token antigo. 
-   **Solução:** Clique no seu perfil e selecione "Sair". Faça login novamente para renovar os Custom Claims (permissões) do seu token de acesso.

### O que acontece se a internet cair?
O HSM Gestão possui tecnologia PWA. 
-   Você poderá continuar navegando pelas páginas que já abriu.
-   Botões de "Salvar" ou "Aprovar" serão desabilitados automaticamente para evitar perda de dados.
-   Assim que a conexão retornar, o sistema exibirá um banner verde e restaurará as funcionalidades de escrita.

### Alteração de Senha e Suporte
-   Para alterar a senha, acesse "Configurações do Perfil" -> "Segurança".
-   Em caso de bloqueio de conta, entre em contato com o suporte técnico da sua unidade informando seu CPF e o erro exibido na tela.
