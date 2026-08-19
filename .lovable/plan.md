# Missão: Correção Forense de Autorização (RBAC) - DIAGNÓSTICO E PROVA

## 1. FASE 1 & 2 — PROVA DA CAUSA E COMPARAÇÃO
Realizei a auditoria das funções `is_master` (SQL) e `is_master_db` (PL/pgSQL).

### Comparação de Determinação de MASTER

| REGRA | is_master (SQL/RLS) | is_master_db (PL/pgSQL) |
| :--- | :--- | :--- |
| Perfil 'MASTER' | SIM | SIM |
| Perfil 'ADMINISTRADOR_MASTER' | SIM | **NÃO** |
| acesso_todas_unidades = TRUE | SIM | **CONDICIONAL** (precisa de todas_secretarias) |
| acesso_todas_secretarias = TRUE | **NÃO** | **CONDICIONAL** (precisa de todas_unidades) |
| Fallback E-mail | SIM ('artemiosouza99...') | **NÃO** |
| Segurança | SECURITY DEFINER | SECURITY DEFINER |

**CAUSA RAIZ EXATA 1**: A função `is_master_db` (usada em RPCs de escrita como `save_profissional_complete`) é muito mais restritiva que a `is_master` (usada no RLS de leitura). Um usuário Master com perfil 'ADMINISTRADOR_MASTER' ou que não tenha ambas as flags ativas é barrado na escrita, mas vê os dados na leitura.

## 2. FASE 5 — AUDITORIA DE RLS (CRÍTICO)

Identifiquei bloqueios silenciosos no RLS de escrita:

- **Tabela `frequencia_profissional`**: As policies `freq_prof_insert`, `freq_prof_update` e `freq_prof_delete` **NÃO possuem bypass para MASTER**. Elas dependem exclusivamente de `has_permission(..., 'frequencia.editar', ...)`. Se o Master não tiver o vínculo explícito na tabela `usuario_unidades` para a unidade da frequência, ele é bloqueado pelo RLS mesmo que a RPC permita a execução.

**CAUSA RAIZ EXATA 2**: O RLS de escrita de frequências não reconhece a autoridade global do MASTER.

## 3. FASE 3 — CACHE
O cache utiliza `set_config(..., true)`, o que significa que ele é resetado ao fim da transação. No entanto, se múltiplas operações ocorrerem na mesma transação com contextos de unidade diferentes, o cache `hp` (has_permission) pode retornar um valor incorreto se a chave não for suficientemente única. A chave atual inclui `unidade_id`, o que é bom, mas a invalidação manual não existe.

## 4. PLANO DE AÇÃO (MIGRATION CONTROLADA)

1.  **Unificar `is_master_db`**: Torná-la semanticamente idêntica à `is_master`, removendo a exigência de "ambas as flags" e incluindo 'ADMINISTRADOR_MASTER'.
2.  **Corrigir RLS de Frequência**: Adicionar `is_master(auth.uid())` em `freq_prof_insert`, `freq_prof_update` e `freq_prof_delete`.
3.  **Reforçar `save_profissional_complete`**: Garantir que ela use a versão unificada da checagem Master.

---
*Procedendo com a aplicação da Migration Forense baseada em evidências.*
