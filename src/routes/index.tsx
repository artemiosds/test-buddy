import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: () => <Navigate to="/analitico" replace />,
});

/**
 * # HSM GESTÃO — AUDITORIA FORENSE
 * # FLUXO DE ENVIO DA FOLHA PARA ANÁLISE
 * # FREQUÊNCIA → FOLHA → ANÁLISE → APROVAÇÃO/HOMOLOGAÇÃO
 *
 * OBJETIVO
 *
 * Realizar uma auditoria completa, real e rastreável do fluxo de envio
 * da folha para análise.
 *
 * NÃO alterar código inicialmente.
 *
 * NÃO alterar banco.
 *
 * NÃO alterar RLS.
 *
 * NÃO alterar permissões.
 *
 * NÃO alterar RBAC.
 *
 * NÃO alterar unidades.
 *
 * NÃO alterar JWT.
 *
 * Primeiro INVESTIGAR e apresentar as causas encontradas.
 *
 * Somente depois de identificar problemas concretos, apresentar a
 * correção necessária.
 *
 * ============================================================
 * 1. MAPEAR O FLUXO COMPLETO
 * ============================================================
 *
 * Mapear exatamente o fluxo atual:
 *
 * LANÇAMENTO DE FREQUÊNCIA
 *         ↓
 * FECHAMENTO DA FREQUÊNCIA
 *         ↓
 * GERAÇÃO/ATUALIZAÇÃO DA FOLHA
 *         ↓
 * ENVIO PARA ANÁLISE
 *         ↓
 * FOLHA EM ANÁLISE
 *         ↓
 * GESTOR/MASTER ANALISA
 *         ↓
 * APROVAÇÃO OU REPROVAÇÃO
 *         ↓
 * RETORNO PARA CORREÇÃO, SE NECESSÁRIO
 *         ↓
 * REENVIO
 *         ↓
 * HOMOLOGAÇÃO
 *         ↓
 * STATUS FINAL
 *
 * Identificar:
 *
 * - componentes React
 * - hooks
 * - Server Functions
 * - RPCs
 * - tabelas
 * - relacionamentos
 * - RLS
 * - políticas
 * - status
 * - transições de status
 * - logs/auditoria
 * - unidade responsável
 * - competência
 * - tipo da folha
 *
 * Não assumir como o fluxo funciona.
 * Descobrir pelo código e banco.
 *
 * ============================================================
 * 2. FREQUÊNCIA
 * ============================================================
 *
 * Verificar se os lançamentos de frequência utilizados na folha são
 * exatamente os lançamentos realizados pelo Diretor/usuário responsável.
 *
 * Validar:
 *
 * - profissional
 * - unidade
 * - competência
 * - mês
 * - ano
 * - carga horária
 * - dias trabalhados
 * - faltas
 * - afastamentos
 * - plantões, se aplicável
 * - horas
 * - situação
 * - usuário responsável
 * - data de lançamento
 *
 * Verificar se existe algum ponto onde a folha utiliza dados antigos,
 * cacheados ou de outra competência.
 *
 * IMPORTANTE:
 *
 * Identificar se o envio para análise cria uma fotografia/snapshot
 * dos dados ou se a folha continua lendo dados mutáveis da frequência.
 *
 * Reportar qual comportamento existe atualmente.
 *
 * ============================================================
 * 3. FOLHA DE CONTRATADOS
 * ============================================================
 *
 * Auditar separadamente a folha de CONTRATADOS.
 *
 * Verificar:
 *
 * - criação
 * - competência
 * - unidade
 * - profissionais
 * - frequência utilizada
 * - valores calculados
 * - status
 * - envio para análise
 * - usuário que enviou
 * - data do envio
 * - destinatário da análise
 *
 * Confirmar se:
 *
 * Diretor da Unidade
 *         ↓
 * envia sua folha
 *         ↓
 * folha fica disponível para análise
 *         ↓
 * Gestor/MASTER consegue visualizar
 *
 * ============================================================
 * 4. FOLHA DE EFETIVOS
 * ============================================================
 *
 * Auditar separadamente a folha de EFETIVOS.
 *
 * Não assumir que utiliza o mesmo fluxo de contratados.
 *
 * Verificar:
 *
 * - criação
 * - competência
 * - unidade
 * - profissionais
 * - frequência
 * - cálculos
 * - status
 * - envio
 * - análise
 * - aprovação
 * - homologação
 *
 * Confirmar que os dois fluxos são independentes.
 *
 * ============================================================
 * 5. ENVIO PARA ANÁLISE
 * ============================================================
 *
 * Encontrar exatamente a função responsável pelo botão:
 *
 * "Enviar para análise"
 *
 * Identificar:
 *
 * - componente
 * - handler
 * - hook
 * - Server Function
 * - RPC
 * - UPDATE/INSERT executado
 * - mudança de status
 * - usuário responsável
 * - timestamp
 * - unidade
 * - competência
 *
 * Verificar se o botão realmente persiste o envio no banco.
 *
 * NÃO considerar apenas a mudança visual da interface.
 *
 * Confirmar através do fluxo de dados real.
 *
 * ============================================================
 * 6. STATUS
 * ============================================================
 *
 * Mapear TODOS os status existentes da folha.
 *
 * Exemplo:
 *
 * RASCUNHO
 * ↓
 * ENVIADA_ANALISE
 * ↓
 * EM_ANALISE
 * ↓
 * APROVADA
 * ↓
 * HOMOLOGADA
 *
 * ou qualquer nomenclatura REAL encontrada.
 *
 * Não inventar status.
 *
 * Criar uma matriz:
 *
 * STATUS ATUAL → AÇÃO → PRÓXIMO STATUS → PERFIL AUTORIZADO
 *
 * Verificar se existem transições impossíveis.
 *
 * Exemplo:
 *
 * Diretor NÃO deve conseguir:
 *
 * ENVIADA → HOMOLOGADA
 *
 * se essa etapa pertence ao MASTER/Gestor.
 *
 * ============================================================
 * 7. PERFIL DIRETOR DE UNIDADE
 * ============================================================
 *
 * Testar especificamente:
 *
 * Diretor de Unidade
 *
 * O Diretor deve:
 *
 * - visualizar sua unidade
 * - visualizar sua competência
 * - visualizar suas folhas
 * - lançar/consultar frequência conforme regra existente
 * - enviar folha para análise
 * - acompanhar status
 * - receber retorno de reprovação
 * - corrigir
 * - reenviar para análise
 *
 * O Diretor NÃO deve:
 *
 * - visualizar folhas de outras unidades
 * - aprovar sua própria folha
 * - homologar sua própria folha
 * - acessar dados globais de outras unidades
 *
 * NÃO alterar essas regras.
 *
 * Apenas verificar se estão funcionando.
 *
 * ============================================================
 * 8. PERFIL GESTOR
 * ============================================================
 *
 * Verificar exatamente o que o Gestor pode fazer.
 *
 * Confirmar:
 *
 * - recebe folhas enviadas
 * - consegue visualizar os dados
 * - consegue analisar
 * - consegue aprovar/reprovar conforme regra atual
 * - consegue devolver para correção
 * - consegue acompanhar pendências
 *
 * Verificar escopo:
 *
 * Secretaria
 * Unidade
 * Global
 *
 * Não assumir.
 *
 * Descobrir no código.
 *
 * ============================================================
 * 9. PERFIL MASTER
 * ============================================================
 *
 * Confirmar acesso global.
 *
 * MASTER deve conseguir:
 *
 * - visualizar folhas
 * - visualizar todas as unidades
 * - visualizar todas as competências autorizadas
 * - analisar
 * - aprovar
 * - homologar
 * - acompanhar histórico
 *
 * Verificar se alguma RLS ou filtro de frontend está impedindo isso.
 *
 * ============================================================
 * 10. PERFIL OPERACIONAL
 * ============================================================
 *
 * Auditar o perfil operacional existente.
 *
 * Descobrir exatamente:
 *
 * - o que ele pode visualizar
 * - o que pode lançar
 * - se pode editar frequência
 * - se pode enviar folha
 * - se pode apenas preparar dados
 * - se pode analisar
 *
 * Não modificar permissões.
 *
 * Apenas documentar o comportamento REAL.
 *
 * ============================================================
 * 11. RLS
 * ============================================================
 *
 * Auditar as tabelas diretamente envolvidas no fluxo.
 *
 * Especialmente:
 *
 * - folhas
 * - frequencias
 * - profissionais
 * - unidades
 * - usuarios
 * - tabelas de análise
 * - tabelas de homologação
 * - tabelas de histórico
 *
 * Para cada tabela informar:
 *
 * RLS ativo?
 *
 * Policies existentes?
 *
 * SELECT?
 *
 * INSERT?
 *
 * UPDATE?
 *
 * DELETE?
 *
 * Quem pode executar?
 *
 * Qual condição de unidade?
 *
 * Qual condição de competência?
 *
 * Qual condição de perfil?
 *
 * Verificar se a RLS está bloqueando dados que deveriam aparecer.
 *
 * ============================================================
 * 12. SERVER FUNCTIONS / RPC
 * ============================================================
 *
 * Localizar todas as funções relacionadas:
 *
 * - criar folha
 * - atualizar folha
 * - enviar análise
 * - aprovar
 * - reprovar
 * - homologar
 * - devolver
 * - reenviar
 *
 * Verificar:
 *
 * - validação de perfil
 * - validação de unidade
 * - validação de competência
 * - validação de status
 * - transação
 * - tratamento de erro
 * - retorno da função
 *
 * Procurar especialmente por:
 *
 * supabase.rpc(...)
 * createServerFn(...)
 * UPDATE folhas
 * INSERT INTO folhas
 *
 * ============================================================
 * 13. DUPLICIDADE E INCONSISTÊNCIA
 * ============================================================
 *
 * Verificar se existem múltiplas funções fazendo a mesma coisa.
 *
 * Exemplo:
 *
 * enviarFolhaParaAnalise()
 * enviarParaAnalise()
 * submitFolha()
 * aprovarFolha()
 * homologarFolha()
 *
 * Se existirem implementações duplicadas, NÃO corrigir ainda.
 *
 * Listar.
 *
 * ============================================================
 * 14. PROBLEMA CRÍTICO — DADOS ENVIADOS
 * ============================================================
 *
 * Verificar se ao enviar para análise a folha realmente contém os
 * mesmos dados visualizados pelo Diretor.
 *
 * Comparar:
 *
 * ANTES DO ENVIO
 *
 * vs.
 *
 * DEPOIS DO ENVIO
 *
 * Verificar:
 *
 * profissionais
 * frequência
 * valores
 * unidade
 * competência
 * status
 *
 * Identificar qualquer divergência.
 *
 * ============================================================
 * 15. REPROVAÇÃO
 * ============================================================
 *
 * Auditar o fluxo:
 *
 * MASTER/GESTOR reprova
 *         ↓
 * Diretor recebe retorno
 *         ↓
 * folha volta para correção
 *         ↓
 * Diretor altera
 *         ↓
 * reenviar para análise
 *
 * Verificar se:
 *
 * - status muda corretamente
 * - motivo da reprovação é salvo
 * - usuário que reprovou é registrado
 * - data/hora é registrada
 * - Diretor consegue identificar o motivo
 * - Diretor consegue corrigir
 * - reenvio funciona
 *
 * ============================================================
 * 16. APROVAÇÃO
 * ============================================================
 *
 * Auditar:
 *
 * Gestor/MASTER aprova
 *         ↓
 * status atualizado
 *         ↓
 * folha deixa de aparecer como pendente
 *         ↓
 * próxima etapa fica disponível
 *
 * Verificar se existe possibilidade de:
 *
 * - aprovar duas vezes
 * - aprovar folha errada
 * - aprovar folha de outra unidade
 * - aprovar competência diferente
 * - aprovar folha ainda incompleta
 *
 * ============================================================
 * 17. HOMOLOGAÇÃO
 * ============================================================
 *
 * Mapear exatamente quem pode homologar.
 *
 * Verificar:
 *
 * - regra de perfil
 * - unidade
 * - secretaria
 * - competência
 * - status anterior
 * - bloqueio após homologação
 * - histórico
 *
 * Confirmar se homologação é realmente uma etapa separada
 * da aprovação ou se atualmente são a mesma operação.
 *
 * ============================================================
 * 18. AUDITORIA E HISTÓRICO
 * ============================================================
 *
 * Verificar se o sistema registra:
 *
 * - quem enviou
 * - quando enviou
 * - quem analisou
 * - quando analisou
 * - quem aprovou
 * - quando aprovou
 * - quem reprovou
 * - motivo
 * - quem homologou
 * - quando homologou
 * - alterações realizadas
 *
 * Não criar histórico novo sem necessidade.
 *
 * Primeiro identificar o que já existe.
 *
 * ============================================================
 * 19. CACHE / REACT QUERY
 * ============================================================
 *
 * Verificar se depois de:
 *
 * Enviar
 * Aprovar
 * Reprovar
 * Homologar
 *
 * a interface atualiza corretamente.
 *
 * Procurar:
 *
 * invalidateQueries
 * refetch
 * queryClient
 * cache
 *
 * Verificar se existe situação onde:
 *
 * BANCO = ENVIADA
 *
 * mas
 *
 * TELA = RASCUNHO
 *
 * ou:
 *
 * BANCO = APROVADA
 *
 * mas:
 *
 * TELA = EM ANÁLISE
 *
 * ============================================================
 * 20. TESTE DE REGRESSÃO
 * ============================================================
 *
 * Executar testes disponíveis.
 *
 * No mínimo:
 *
 * MASTER
 * GESTOR
 * DIRETOR
 * OPERACIONAL
 *
 * E testar:
 *
 * Folha Contratados
 * Folha Efetivos
 *
 * Para cada combinação registrar:
 *
 * VISUALIZA
 * ENVIA
 * ANALISA
 * APROVA
 * REPROVA
 * REENVIA
 * HOMOLOGA
 *
 * ============================================================
 * 21. RESULTADO FINAL
 * ============================================================
 *
 * NÃO alterar nada durante a auditoria.
 *
 * Entregar relatório:
 *
 * ### FLUXO REAL ENCONTRADO
 *
 * Mostrar o fluxo real do sistema.
 *
 * ### TABELA DE PERFIS
 *
 * | Perfil | Visualiza | Envia | Analisa | Aprova | Reprova | Reenvia | Homologa |
 * |---|---|---|---|---|---|---|---|
 *
 * ### CONTRATADOS
 *
 * Informar se o fluxo está correto.
 *
 * ### EFETIVOS
 *
 * Informar se o fluxo está correto.
 *
 * ### FREQUÊNCIA
 *
 * Informar se os dados chegam corretamente.
 *
 * ### RLS
 *
 * Listar problemas encontrados.
 *
 * ### RPC/SERVER FUNCTIONS
 *
 * Listar problemas encontrados.
 *
 * ### STATUS
 *
 * Listar a máquina de estados encontrada.
 *
 * ### CACHE
 *
 * Listar problemas encontrados.
 *
 * ### CRITICAL FINDINGS
 *
 * Classificar:
 *
 * 🔴 CRÍTICO
 * 🟠 ALTO
 * 🟡 MÉDIO
 * 🟢 NORMAL
 *
 * ### CORREÇÕES RECOMENDADAS
 *
 * Para cada problema:
 *
 * Arquivo:
 * Função:
 * Causa:
 * Impacto:
 * Correção recomendada:
 *
 * NÃO aplicar essas correções automaticamente.
 *
 * ============================================================
 * REGRA ABSOLUTA
 * ============================================================
 *
 * ESTA É UMA AUDITORIA.
 *
 * NÃO MODIFICAR CÓDIGO.
 *
 * NÃO CRIAR MIGRATION.
 *
 * NÃO ALTERAR RLS.
 *
 * NÃO ALTERAR RPC.
 *
 * NÃO ALTERAR PERMISSÕES.
 *
 * NÃO ALTERAR DADOS.
 *
 * NÃO ALTERAR STATUS EXISTENTES.
 *
 * Somente depois que o relatório estiver concluído iremos criar
 * um segundo prompt exclusivamente para corrigir os problemas
 * confirmados.
 */
