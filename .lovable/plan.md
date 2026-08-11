# Plano de Correção: Erro de Tipo e Bypass Master

O sistema está apresentando um erro de `RUNTIME_ERROR` ao tentar salvar profissionais, especificamente `column "proj" is of type numeric but expression is of type text`. Além disso, usuários MASTER e GESTOR estão relatando bloqueios de permissão.

## Problemas Identificados
1.  **Erro de Tipo SQL:** A função RPC `save_profissional_complete` está inserindo valores da coluna `proj` (e possivelmente `h_p`, `c_h`, `jorn`) sem o cast explícito para `NUMERIC`, resultando em erro quando o JSON envia strings (ex: "").
2.  **Bypass MASTER:** Verificação da hierarquia de permissões para garantir que MASTER/GESTOR ignorem as travas territoriais de Unidade/Secretaria se configurado.

## Ações Técnicas

### 1. Migração de Banco de Dados
- Atualizar a função `public.save_profissional_complete` para incluir casts explícitos `::NUMERIC` nos campos: `proj`, `h_p`, `c_h`, `jorn`.
- Garantir que `situacao_funcional` use o cast correto para `public.situacao_funcional`.
- Reforçar o bypass MASTER utilizando a função `is_master_db` consolidada.

### 2. Ajuste de Interface (Documentação de Auditoria)
- Atualizar o arquivo `src/routes/index.tsx` para refletir o status de correção e o novo relatório de conformidade, removendo as mensagens de erro estáticas.

## Detalhes Técnicos
```sql
-- Exemplo do ajuste no INSERT/VALUES:
(NULLIF(p_payload->>'proj',''))::NUMERIC,
(NULLIF(p_payload->>'h_p',''))::NUMERIC,
...
```

Este ajuste resolve o conflito entre o tipo de dados esperado pelo Postgres e o formato enviado pelo JSON via TanStack Start.
