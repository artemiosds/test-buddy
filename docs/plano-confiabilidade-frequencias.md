# Fase — Confiabilidade, sincronização e preservação histórica
**Repositório:** `artemiosds/test-buddy` · **Base analisada:** `f3189330f016d78d4fbf1dd46aba7263be664ff7` (main) · **Etapa atual:** preparação sem alterações de negócio.

## Regras inegociáveis
1. Banco Supabase, migrações, tabelas, dados, Storage e rotinas produtivas: **nenhuma modificação nesta etapa**.
2. Folhas já aprovadas/arquivadas e competências encerradas: **somente leitura**, salvo fluxo explícito e autorizado de reabertura.
3. Status da folha Geral e dos setores não são intercambiáveis; envio parcial legítimo não constitui erro.
4. `em_analise` reaberta não pode voltar a `rascunho` por carregamento/autosave; aprovação exige evento oficial.
5. Autosave: série única de gravações, flush antes de troca de competência/unidade/setor e antes de enviar, sem feedback "salvo" sem confirmação HTTP.
6. Nenhum ajuste automático de histórico, aprovação, quantidade de dias ou valores financeiros; qualquer reconciliação começa como relatório de diagnóstico, nunca como reparo silencioso.
7. Mudanças de código sempre localizadas, revisadas e validadas em GitHub `main`; Lovable apenas visualização.

## Mapa dos fluxos e testes necessários

| Fluxo | Arquivos principais | Cenários obrigatórios |
| --- | --- | --- |
| Fila de autosave | `src/hooks/use-autosave-folha.ts` e `.test.tsx` | Digitar durante HTTP pendente, dois flush simultâneos, erro e retry, troca de contexto, fechamento de tela |
| Contratados | `src/lib/frequencias-contratados.functions.ts`, `src/lib/frequencia-sincronizacao.functions.ts` | Rascunho → envio → em análise → devolução → retificação → aprovação, incluindo setores |
| Efetivos | `src/lib/frequencias-efetivos.functions.ts`, `src/lib/frequencias.functions.ts` | Envio por setor, Geral consolidada, ausências, folha protegida |
| Aprovações | `src/routes/_authenticated/aprovacoes.tsx`, `src/lib/frequencias.functions.ts` | Aprovação parcial legítima, repetição de clique, concorrência com salvamento, preservação de assinaturas |
| Competências | `src/lib/competencias.functions.ts`, `src/routes/api/public/hooks/deadline-check.ts` | Avisos automáticos sem encerramento, fechamento manual e justificado, reabertura auditável |
| Histórico/financeiro | `src/lib/folha-financeira.ts`, `src/lib/frequencias-retencao.ts` | Preservação de snapshots, tarifas históricas e documentos |

## Riscos identificados na leitura estática — hipóteses, não falhas comprovadas em produção

- O orquestrador ainda reconcilia o status a partir de consultas separadas e depois atualiza `frequencias`: duas ações simultâneas podem observar snapshots distintos. Antes de alterar, reproduzir com dois clientes em ambiente isolado.
- O envio de folhas e a atualização de registros especializados/gerais são operações em mais de uma chamada. É indispensável caracterizar comportamento de falha intermediária antes de avaliar atomicidade; nenhuma migração ou RPC nova está autorizada.
- A proteção de reabertura em `src/lib/frequencia-status-sincronizacao.ts` foi verificada por testes de regras puras, não por concorrência real autenticada.
- O `package-lock.json` não corresponde ao `package.json`; a CI usa instalação transitória sem atualizar o lock. Regularizar em uma alteração separada, após revisão de dependências.

## Portões de validação

**Portão A — Código:** testes unitários e de regressão, build sem erros, CI verde, releitura de arquivos e commit.

**Portão B — Ambiente isolado com credenciais autorizadas:** testar com dados fictícios e contas de perfis distintos (Master, RH, Diretor), duas sessões simultâneas, interrupção de rede e reabertura. Sem acesso autenticado a um ambiente seguro, esta etapa permanece pendente e não será simulada como concluída.

**Portão C — Publicação/homologação:** revisar logs, validar no navegador com perfil real, verificar permissões e escopo por unidade e observar efeitos de deploy. Somente então declarar uma correção pronta para produção.

## Ordem de execução
1. Ampliar cobertura automatizada de autosave, status oficial, Realtime e snapshots; nenhuma mudança de regra.
2. Produzir diagnóstico de divergência Geral × Setores **somente leitura** e testes com dados sintéticos.
3. Após reproduzir falhas, corrigir cada causa isoladamente, com teste de regressão que falha antes e passa depois.
4. Verificar integridade de envio, aprovação e encerramento em ambiente de homologação autorizado.
5. Registrar resultado com hash do commit, testes executados, riscos residuais e eventual plano de reversão.

## Plano de reversão
Cada mudança deve ser um commit pequeno na `main`, com o commit anterior preservado. Se o build ou um teste crítico falhar, não considerar a mudança homologada; reverter o commit específico de maneira controlada sem modificar dados históricos. Reversão de código não desfaz automaticamente gravações no banco.

## Critério de conclusão
A fase só termina após passar nos portões A, B e C. Testes unitários e compilação não substituem o teste funcional com acesso real.
