# Plano de Migração e Limpeza de Dados

Este plano descreve as etapas para corrigir os dados já gravados com formatação indesejada nas tabelas de frequência e as alterações de código para evitar novas ocorrências.

## 1. Correção no Código (Prevenção)
- **Grid ERP (`NumberCell`)**: Refinar a função `fmtNum` para remover zeros à direita desnecessários em valores decimais (ex: "1,50" -> "1,5").
- **Server Functions**: Já ajustadas para salvar como string bruta, mas revisaremos se há algum ponto de coerção numérica residual.

## 2. Migração de Dados (Limpeza)
A migração será dividida em fases para garantir a segurança dos dados.

### Fase A: Preparação e Auditoria Inicial
- **Backup**: Criação de tabelas de backup (`frequencia_profissional_backup_20260813` e `frequencias_contratados_backup_20260813`).
- **Contagem Pré-Migração**: Identificar quantos registros possuem o padrão `.00` ou `,00`.

### Fase B: Execução do Script SQL
O script SQL utilizará uma função auxiliar `limpar_valor_texto` para:
1. Remover `.00` ou `,00` de números inteiros (ex: "32.00" -> "32").
2. Remover zeros à direita de decimais reais (ex: "1,50" -> "1,5").
3. Ignorar textos puros (ex: "Férias").
4. Manter nulos ou vazios.

### Fase C: Verificação Pós-Migração
- **Contagem Pós-Migração**: Confirmar que os registros identificados foram limpos.
- **Amostragem**: `SELECT` de 10 registros aleatórios para inspeção visual.

## Detalhes Técnicos
As colunas afetadas em `folha_efetivos`: `dias_trabalhados`, `atestado`, `he_50`, `he_100`, `ferias_terco`, `ferias_integral`, `adicional_noturno`, `sobreaviso`, `plantoes_extras`, `incentivo`, `ferias`, `licenca_premio`.

As colunas afetadas em `folha_contratados`: `dias_trabalhados`, `dias_falta`, `atestado`, `he_50`, `he_100`, `adn`, `plantoes`, `sobreaviso`, `incentivo`.

---

**Solicitação de Autorização**: O script SQL de backup e limpeza está pronto para visualização. Deseja revisar o SQL agora?
