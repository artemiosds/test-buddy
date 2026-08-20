# Missão: Correção Forense de Autorização (RBAC) - EXECUÇÃO CONTROLADA

## 1. Diagnóstico de Divergência
A auditoria técnica comprovou que a função `is_master_db` (usada em RPCs de escrita) é inconsistente com a `is_master` (usada em RLS de leitura), exigindo flags duplas que o MASTER nem sempre possui. Além disso, as policies de escrita da tabela `frequencia_profissional` não possuem bypass para MASTER, causando bloqueios em cascata.

## 2. Plano de Correção (FASE 1 e 6)

### A. Unificação Conceitual
- Refatorar `is_master_db` para utilizar a regra de negócio oficial: Perfil MASTER/ADMINISTRADOR_MASTER ou flags de acesso global.
- **SEGURANÇA**: Remover o bypass hardcoded por email (`artemiosouza99@gmail.com`) de **ambas** as funções (`is_master` e `is_master_db`).

### B. Bypass Master em RLS de Frequência
- Adicionar `is_master(auth.uid())` nas policies de `INSERT`, `UPDATE` e `DELETE` da tabela `frequencia_profissional`. 
- **RESTRIÇÃO**: Não alterar SELECT nem privilégios de Diretor/Gestor para evitar escalação de privilégios.

### C. Manutenção de Privilégios (Grants)
- **ZERO** alterações em `GRANT ALL`. O acesso será mediado exclusivamente via RLS e lógica interna de RPC.

## 3. Matriz de Teste de Não-Regressão
- **MASTER**: Acesso global comprovado via unificação de funções.
- **GESTOR**: Mantido no escopo de secretaria via `user_has_secretaria`.
- **DIRETOR**: Mantido no escopo de unidade via `user_has_unit`.
- **OPERACIONAL**: Mantido via `has_permission`.

---
*Procedendo com a aplicação da Migration de Segurança.*
