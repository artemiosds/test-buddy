import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: () => <Navigate to="/analitico" replace />,
});

/**
 * # HSM GESTÃO — AUDITORIA FORENSE DO FLUXO DE ENVIO DA FOLHA PARA ANÁLISE
 *
 * ## OBJETIVO
 *
 * Realizar uma AUDITORIA TÉCNICA E FUNCIONAL COMPLETA do fluxo de envio da folha para análise.
 *
 * ATENÇÃO:
 *
 * ESTA ETAPA É SOMENTE AUDITORIA.
 *
 * NÃO ALTERAR CÓDIGO.
 * NÃO ALTERAR BANCO.
 * NÃO CRIAR MIGRATIONS.
 * NÃO ALTERAR RLS.
 * NÃO ALTERAR RPC.
 * NÃO ALTERAR JWT.
 * NÃO ALTERAR PERFIS.
 * NÃO ALTERAR PERMISSÕES.
 * NÃO ALTERAR OUTROS MÓDULOS.
 *
 * Primeiro identificar exatamente onde o fluxo está funcionando, onde está quebrado e qual é a causa raiz.
 *
 * Somente depois da apresentação do relatório será autorizada uma correção.
 *
 * ============================================================
 * 1. FLUXO FUNCIONAL QUE DEVE SER AUDITADO
 * ============================================================
 *
 * Auditar o fluxo completo:
 *
 * DIRETOR DE UNIDADE
 *         ↓
 * Lança frequência
 *         ↓
 * Fecha competência
 *         ↓
 * Gera/consolida folha
 *         ↓
 * Envia para análise
 *         ↓
 * GESTOR / MASTER
 *         ↓
 * Analisa
 *         ↓
 * Aprova ou reprova
 *         ↓
 * Se reprovada
 *         ↓
 * DIRETOR corrige
 *         ↓
 * Reenvia para análise
 *         ↓
 * GESTOR / MASTER analisa novamente
 *         ↓
 * Aprovação/Homologação
 *         ↓
 * Folha final
 *
 * Não assumir que esse fluxo está correct.
 *
 * PROVAR cada etapa através do código, banco, RPCs, Server Functions e componentes envolvidos.
 *
 * ============================================================
 * 2. PERFIS OBRIGATÓRIOS
 * ============================================================
 *
 * Auditar individualmente:
 *
 * MASTER
 *
 * GESTOR
 *
 * DIRETOR DE UNIDADE
 *
 * ADMINISTRATIVO/OPERACIONAL
 *
 * Para cada perfil informar:
 *
 * - O que pode visualizar
 * - O que pode criar
 * - O que pode editar
 * - O que pode enviar para análise
 * - O que pode analisar
 * - O que pode reprovar
 * - O que pode aprovar
 * - O que pode homologar
 * - O que pode reenviar
 * - Qual unidade/secretaria consegue enxergar
 * - Qual RLS controla o acesso
 * - Qual RPC controla a permissão
 * - Qual Server Function executa a ação
 * - Qual componente frontend executa a ação
 *
 * ============================================================
 * 3. AUDITAR LANÇAMENTO DA FREQUÊNCIA
 * ============================================================
 *
 * Localizar:
 *
 * - tabelas de frequência
 * - tabela de competência
 * - registros diários/mensais
 * - Server Functions
 * - RPCs
 * - hooks
 * - componentes responsáveis pelo lançamento
 *
 * Verificar:
 *
 * 1. O Diretor consegue lançar frequência somente da unidade dele?
 * 2. O Master consegue lançar/visualizar globalmente?
 * 3. O Gestor possui o escopo correto?
 * 4. A frequência realmente fica vinculada à unidade correta?
 * 5. Existe risco de frequência de uma unidade aparecer em outra?
 * 6. Existe filtro por deleted_at?
 * 7. Existe validação de competência?
 * 8. Existe validação de usuário responsável pelo lançamento?
 *
 * NÃO modificar nada.
 *
 * ============================================================
 * 4. AUDITAR FECHAMENTO DA COMPETÊNCIA
 * ============================================================
 *
 * Identificar exatamente:
 *
 * - quem pode fechar
 * - quem pode reabrir
 * - qual tabela armazena o status
 * - quais estados existem
 * - qual função muda o status
 *
 * Mapear todos os estados encontrados.
 *
 * Exemplo:
 *
 * RASCUNHO
 * ABERTA
 * FECHADA
 * ENVIADA_ANALISE
 * EM_ANALISE
 * REPROVADA
 * APROVADA
 * HOMOLOGADA
 *
 * NÃO assumir que esses são os estados reais.
 *
 * Utilizar os estados encontrados no código/banco.
 *
 * Verificar se existe inconsistência entre frontend e banco.
 *
 * ============================================================
 * 5. AUDITAR ENVIO PARA ANÁLISE
 * ============================================================
 *
 * Localizar a função EXATA responsável pelo botão:
 *
 * "Enviar para análise"
 *
 * Identificar:
 *
 * Arquivo:
 * Função:
 * Server Function:
 * RPC:
 * Tabela:
 * Status anterior:
 * Status posterior:
 *
 * Verificar:
 *
 * - Quem pode executar?
 * - Existe validação no backend?
 * - Existe validação somente no frontend?
 * - O Diretor consegue enviar?
 * - O Gestor consegue enviar?
 * - O Master consegue?
 * - O envio altera realmente o status no banco?
 * - A competência correta é enviada?
 * - A unidade correta é enviada?
 * - Os profissionais corretos são enviados?
 * - Os valores da folha permanecem íntegros?
 *
 * IMPORTANTE:
 *
 * Não aceitar como prova apenas o botão aparecer na tela.
 *
 * A permissão deve ser validada no backend.
 *
 * ============================================================
 * 6. AUDITAR DADOS ENVIADOS
 * ============================================================
 *
 * Depois do envio para análise, verificar se os dados permanecem vinculados corretamente.
 *
 * Auditar:
 *
 * - competência
 * - unidade
 * - secretaria
 * - profissional
 * - tipo de folha
 * - frequência
 * - salário
 * - adicionais
 * - descontos
 * - valor final
 * - status
 *
 * Verificar se existe algum processo que:
 *
 * - recria os dados
 * - duplica registros
 * - perde registros
 * - altera valores
 * - troca unidade
 * - remove frequência
 * - sobrescreve a folha
 *
 * Identificar se existe SNAPSHOT da folha no momento do envio.
 *
 * Se não existir, informar explicitamente.
 *
 * NÃO criar snapshot durante a auditoria.
 *
 * ============================================================
 * 7. AUDITAR FOLHA DE CONTRATADOS
 * ============================================================
 *
 * Auditar separadamente.
 *
 * Verificar:
 *
 * DIRETOR:
 *
 * - consegue visualizar sua unidade?
 * - consegue lançar frequência?
 * - consegue gerar folha?
 * - consegue enviar para análise?
 * - consegue visualizar folha reprovada?
 * - consegue corrigir?
 * - consegue reenviar?
 *
 * GESTOR:
 *
 * - consegue visualizar as folhas corretas?
 * - consegue analisar?
 * - consegue reprovar?
 * - consegue aprovar?
 *
 * MASTER:
 *
 * - consegue visualizar todas as unidades?
 * - consegue homologar?
 *
 * ============================================================
 * 8. AUDITAR FOLHA DE EFETIVOS
 * ============================================================
 *
 * Repetir exatamente a auditoria anterior para:
 *
 * FOLHA DOS EFETIVOS.
 *
 * IMPORTANTE:
 *
 * Contratados e Efetivos possuem fluxos independentes.
 *
 * Não assumir que uma implementação serve para os dois.
 *
 * Comparar as duas implementações e identificar divergências.
 *
 * ============================================================
 * 9. AUDITAR REPROVAÇÃO
 * ============================================================
 *
 * Localizar exatamente a função de:
 *
 * "Reprovar"
 *
 * Verificar:
 *
 * - quem pode reprovar
 * - motivo obrigatório ou não
 * - onde o motivo é salvo
 * - qual status é aplicado
 * - se o Diretor recebe a informação
 * - se a folha volta para edição
 * - se a frequência pode ser corrigida
 * - se o Diretor consegue reenviar
 *
 * Mapear:
 *
 * STATUS ANTERIOR
 * ↓
 * AÇÃO
 * ↓
 * STATUS POSTERIOR
 *
 * ============================================================
 * 10. AUDITAR REENVIO
 * ============================================================
 *
 * Verificar o fluxo:
 *
 * REPROVADA
 * ↓
 * DIRETOR CORRIGE
 * ↓
 * REENVIA
 * ↓
 * EM ANÁLISE
 *
 * Confirmar se:
 *
 * - os dados antigos permanecem íntegros
 * - a nova versão substitui corretamente a anterior
 * - existe histórico
 * - existe auditoria
 * - o motivo da reprovação permanece
 * - o usuário que corrigiu é registrado
 * - data/hora são registradas
 *
 * ============================================================
 * 11. AUDITAR APROVAÇÃO
 * ============================================================
 *
 * Localizar a implementação real da aprovação.
 *
 * Verificar:
 *
 * - quem pode aprovar
 * - qual status é aplicado
 * - quais validações existem
 * - se existe Server Function
 * - se existe RPC
 * - se a aprovação é apenas frontend
 * - se existe auditoria
 * - se o usuário aprovador é registrado
 *
 * ============================================================
 * 12. AUDITAR HOMOLOGAÇÃO
 * ============================================================
 *
 * Identificar se existe uma etapa distinta de:
 *
 * APROVAÇÃO
 *
 * e
 *
 * HOMOLOGAÇÃO.
 *
 * Não assumir que são a mesma coisa.
 *
 * Informar:
 *
 * - quem homologa
 * - qual status representa homologação
 * - qual função executa
 * - quais permissões são exigidas
 * - se o Master possui bypass
 * - se a homologação bloqueia alterações posteriores
 *
 * ============================================================
 * 13. AUDITAR RLS
 * ============================================================
 *
 * Somente AUDITAR.
 *
 * NÃO modificar policies.
 *
 * Mapear as policies das tabelas envolvidas em:
 *
 * - frequência
 * - competências
 * - folhas
 * - profissionais
 * - unidades
 * - usuários
 * - vínculos
 *
 * Para cada policy informar:
 *
 * Tabela:
 * Nome da policy:
 * Operação:
 * SELECT/INSERT/UPDATE/DELETE:
 * Condição USING:
 * Condição WITH CHECK:
 * Perfil/role:
 * Escopo:
 *
 * Identificar qualquer policy conflitante.
 *
 * ============================================================
 * 14. AUDITAR RPCs
 * ============================================================
 *
 * Localizar todas as RPCs utilizadas no fluxo.
 *
 * Especialmente:
 *
 * - permissões
 * - unidade
 * - frequência
 * - folha
 * - envio
 * - análise
 * - aprovação
 * - reprovação
 * - homologação
 *
 * Para cada uma:
 *
 * Nome:
 * RETURNS:
 * SECURITY DEFINER/INVOKER:
 * search_path:
 * Parâmetros:
 * Quem pode executar:
 * Tabelas acessadas:
 * Validação de permissão:
 *
 * Identificar RPCs duplicadas ou com regras conflitantes.
 *
 * ============================================================
 * 15. AUDITAR SERVER FUNCTIONS
 * ============================================================
 *
 * Localizar todas as Server Functions envolvidas.
 *
 * Verificar se a segurança está realmente no backend.
 *
 * IMPORTANTE:
 *
 * Não considerar seguro simplesmente porque o botão está escondido.
 *
 * Testar logicamente se uma chamada direta à Server Function poderia:
 *
 * - acessar outra unidade
 * - alterar folha
 * - aprovar indevidamente
 * - reprovar indevidamente
 * - enviar folha de outra unidade
 *
 * ============================================================
 * 16. AUDITAR JWT E PERMISSÕES
 * ============================================================
 *
 * Como o sistema sofreu regressões recentes, verificar cuidadosamente:
 *
 * - app_metadata
 * - permissions
 * - is_master
 * - perfil_codigo
 * - unidade_principal_id
 * - authorized_units
 * - acesso_todas_unidades
 * - acesso_todas_secretarias
 *
 * Identificar se frontend e backend usam a mesma fonte de verdade.
 *
 * NÃO ALTERAR JWT.
 *
 * Somente informar divergências.
 *
 * ============================================================
 * 17. AUDITAR FRONTEND
 * ============================================================
 *
 * Localizar:
 *
 * - páginas de folha
 * - componentes de frequência
 * - botões de envio
 * - botões de aprovação
 * - botões de reprovação
 * - filtros de unidade
 * - seleção de competência
 *
 * Verificar se o frontend:
 *
 * - usa contexto correto
 * - usa unidade correta
 * - respeita perfil
 * - possui filtros artificiais
 * - depende exclusivamente de permissões frontend
 * - possui estados inconsistentes
 *
 * ============================================================
 * 18. AUDITORIA DE DUPLICIDADE
 * ============================================================
 *
 * Pesquisar por:
 *
 * - funções duplicadas
 * - RPCs duplicadas
 * - Server Functions duplicadas
 * - regras de permissão duplicadas
 * - múltiplas definições de is_master
 * - múltiplas definições de unidade autorizada
 * - múltiplos fluxos de envio
 * - múltiplos status para a mesma finalidade
 *
 * Especial atenção para migrations recentes.
 *
 * ============================================================
 * 19. AUDITORIA DE MIGRATIONS
 * ============================================================
 *
 * Mapear as migrations relacionadas ao módulo de folha.
 *
 * Identificar:
 *
 * - alterações recentes
 * - RPCs substituídas
 * - policies alteradas
 * - colunas removidas
 * - colunas adicionadas
 * - funções recriadas
 * - mudanças de enum/status
 *
 * Não aplicar nenhuma migration.
 *
 * Apenas informar o histórico encontrado.
 *
 * ============================================================
 * 20. MATRIZ FINAL
 * ============================================================
 *
 * Gerar uma tabela real:
 *
 * | Funcionalidade | MASTER | GESTOR | DIRETOR | OPERACIONAL |
 * |---|---|---|---|---|
 * | Visualizar folha | | | | |
 * | Lançar frequência | | | | |
 * | Editar frequência | | | | |
 * | Fechar competência | | | | |
 * | Gerar folha | | | | |
 * | Enviar análise | | | | |
 * | Analisar | | | | |
 * | Reprovar | | | | |
 * | Corrigir reprovação | | | | |
 * | Reenviar | | | | |
 * | Aprovar | | | | |
 * | Homologar | | | | |
 *
 * Preencher SOMENTE com comportamento comprovado no código/banco.
 *
 * Não inventar.
 *
 * ============================================================
 * 21. CLASSIFICAÇÃO DOS ACHADOS
 * ============================================================
 *
 * Classificar cada problema:
 *
 * 🔴 CRÍTICO
 * Impede funcionamento ou permite acesso indevido.
 *
 * 🟠 ALTO
 * Pode causar perda, inconsistência ou bloqueio de dados.
 *
 * 🟡 MÉDIO
 * Problema funcional ou de arquitetura sem impacto imediato.
 *
 * 🔵 BAIXO
 * Melhoria técnica.
 *
 * ============================================================
 * 22. REGRA ABSOLUTA
 * ============================================================
 *
 * NÃO CORRIGIR NADA NESTA ETAPA.
 *
 * NÃO criar arquivos.
 *
 * NÃO editar arquivos.
 *
 * NÃO criar migration.
 *
 * NÃO alterar banco.
 *
 * NÃO alterar RLS.
 *
 * NÃO alterar RPC.
 *
 * NÃO alterar permissões.
 *
 * NÃO alterar JWT.
 *
 * NÃO alterar fluxo.
 *
 * Somente AUDITAR.
 *
 * ============================================================
 * 23. RELATÓRIO FINAL OBRIGATÓRIO
 * ============================================================
 *
 * Entregar:
 *
 * 1. Fluxo real encontrado
 * 2. Fluxo esperado
 * 3. Diferenças
 * 4. Arquivos envolvidos
 * 5. RPCs envolvidas
 * 6. Server Functions envolvidas
 * 7. Tabelas envolvidas
 * 8. RLS envolvidas
 * 9. Estados da folha encontrados
 * 10. Matriz de permissões
 * 11. Problemas por perfil
 * 12. Problemas Contratados
 * 13. Problemas Efetivos
 * 14. Problemas de Frequência
 * 15. Problemas de Envio
 * 16. Problemas de Aprovação
 * 17. Problemas de Homologação
 * 18. Problemas de Reprovação
 * 19. Problemas de RLS
 * 20. Problemas de JWT/RBAC
 * 21. Problemas de frontend
 * 22. Problemas de backend
 * 23. Migrations suspeitas
 * 24. Causa raiz de cada problema
 * 25. Classificação de severidade
 * 26. Plano de correção recomendado
 *
 * IMPORTANTE:
 *
 * Não dizer "funciona" apenas porque o código aparenta correto.
 *
 * Diferenciar:
 *
 * ✅ Comprovado no código
 * ⚠️ Inferido
 * ❌ Comprovadamente quebrado
 * ❓ Não foi possível validar
 *
 * Ao final, NÃO fazer nenhuma alteração.
 *
 * Apenas apresentar o relatório técnico completo.
 *
 * ============================================================
 * 24. PDF DA AUDITORIA
 * ============================================================
 *
 * Depois de concluir a auditoria, gerar o PDF institucional:
 *
 * AUDITORIA FORENSE — FLUXO DE ENVIO DA FOLHA
 *
 * O PDF deve conter:
 *
 * - objetivo
 * - fluxo real
 * - fluxo esperado
 * - matriz de perfis
 * - achados
 * - evidências
 * - riscos
 * - causa raiz
 * - plano de correção
 * - data/hora da auditoria
 *
 * Não colocar como "aprovado" se houver problemas.
 *
 * O PDF deve refletir EXATAMENTE os resultados encontrados.
 */
