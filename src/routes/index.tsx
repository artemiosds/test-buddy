import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: () => <Navigate to="/analitico" replace />,
});

/**
AUDITORIA FORENSE COMPLETA — FLUXO DE ENVIO DA FOLHA PARA ANÁLISE

IMPORTANTE:
ESTA ETAPA É SOMENTE AUDITORIA.

NÃO ALTERE CÓDIGO.
NÃO CRIE MIGRATION.
NÃO ALTERE RLS.
NÃO ALTERE RPC.
NÃO ALTERE PERMISSÕES.
NÃO ALTERE STATUS.
NÃO CORRIJA NADA AUTOMATICAMENTE.

Primeiro investigue profundamente o fluxo REAL existente no projeto e no banco.

O objetivo é descobrir exatamente onde o fluxo de envio da folha para análise está funcionando, onde está quebrado e qual é a causa raiz.

============================================================
1. FLUXO FUNCIONAL OBRIGATÓRIO
============================================================

Mapeie o fluxo real:

DIRETOR DE UNIDADE
↓
Lançamento da frequência
↓
Fechamento da frequência
↓
Geração/consolidação da folha
↓
Envio para análise
↓
Status ENVIADA_ANALISE
↓
GESTOR / MASTER
↓
Análise
↓
APROVAÇÃO OU REPROVAÇÃO
↓
Se REPROVADA:
GESTOR/MASTER → devolve
↓
DIRETOR
↓
visualiza motivo
↓
corrige
↓
reenvia
↓
nova análise
↓
aprovação
↓
MASTER
↓
homologação final

NÃO PRESUMA que esse fluxo existe.
CONFIRME no código e no banco.

============================================================
2. IDENTIFICAR TODOS OS ARQUIVOS ENVOLVIDOS
============================================================

Localize e liste:

- páginas de frequência
- folha de contratados
- folha de efetivos
- componentes de envio
- componentes de análise
- componentes de aprovação
- componentes de reprovação
- componentes de homologação
- Server Functions
- RPCs
- hooks
- services
- queries
- mutations
- tabelas
- migrations
- RLS policies
- triggers
- audit logs

Para cada item encontrado, informe:

ARQUIVO
FUNÇÃO
RESPONSABILIDADE
PERFIL QUE UTILIZA
TABELA/RPC ENVOLVIDA

Não altere nada.

============================================================
3. AUDITORIA DOS STATUS
============================================================

Descubra quais são os status REAIS utilizados no banco e frontend.

Exemplo:

RASCUNHO
ENVIADA_ANALISE
EM_ANALISE
REPROVADA
APROVADA
HOMOLOGADA
etc.

NÃO PRESUMA esses nomes.

Pesquise:

- enums
- tipos TypeScript
- migrations
- CHECK constraints
- RPCs
- Server Functions
- queries
- filtros

Depois monte:

STATUS | QUEM PODE DEFINIR | QUEM PODE VISUALIZAR | PRÓXIMO STATUS

Identifique qualquer status que exista no frontend mas não no banco ou vice-versa.

============================================================
4. AUDITORIA DO DIRETOR DE UNIDADE
============================================================

Investigue exatamente o que o perfil DIRETOR pode fazer.

Confirmar:

1. visualizar sua unidade
2. visualizar profissionais da unidade
3. visualizar frequência da unidade
4. lançar frequência
5. editar frequência
6. fechar frequência
7. gerar folha
8. enviar folha para análise
9. visualizar status do envio
10. visualizar reprovação
11. visualizar motivo da reprovação
12. corrigir
13. reenviar para análise

CONFIRMAR também:

- unidade_principal_id
- usuario_unidades
- unidade_id
- authorized_units
- JWT
- RPC get_my_user_context
- RLS

Verifique se todas essas camadas apontam para a MESMA unidade.

============================================================
5. AUDITORIA DO GESTOR
============================================================

Confirmar exatamente:

- quais unidades pode visualizar
- qual secretaria pode visualizar
- quais folhas pode analisar
- se recebe folhas enviadas pelo Diretor
- se consegue abrir a folha
- se consegue aprovar
- se consegue reprovar
- se consegue informar motivo
- se consegue devolver corretamente para o Diretor

Verifique se o Gestor está sendo bloqueado por:

- JWT
- RLS
- PermissionGate
- RPC
- Server Function
- filtro frontend

============================================================
6. AUDITORIA DO MASTER
============================================================

Confirmar:

MASTER deve possuir visão GLOBAL.

Testar conceitualmente:

- todas unidades
- todos profissionais
- todas folhas
- todas frequências
- todas secretarias
- análise
- aprovação
- homologação
- auditoria

Verifique se existe alguma regra recente que esteja restringindo MASTER por:

usuario_unidades
unidade_principal_id
authorized_units
JWT
RLS
is_master
acesso_todas_unidades
acesso_todas_secretarias

IMPORTANTE:

Não assumir que possuir unidade vinculada transforma MASTER em usuário restrito.

============================================================
7. AUDITORIA DE RLS
============================================================

Localize as policies das tabelas envolvidas.

Principalmente:

- frequencias
- folhas
- folha_contratados
- folha_efetivos
- profissionais
- usuarios
- usuario_unidades
- unidades
- setores

Para cada policy informe:

TABELA
POLICY
SELECT
INSERT
UPDATE
DELETE
USING
WITH CHECK
PERFIL ENVOLVIDO
FUNÇÃO/RPC UTILIZADA

Procure conflitos como:

- uma policy permitindo
- outra policy bloqueando
- MASTER sendo tratado como usuário comum
- Diretor sem unidade
- Gestor usando unidade quando deveria usar secretaria
- deleted_at bloqueando registros
- unidade_id NULL
- UUID comparado incorretamente

NÃO ALTERAR.

============================================================
8. AUDITORIA DAS RPCs
============================================================

Localize as definições ATUAIS de:

get_my_user_context
get_my_permissions
is_master
is_master_core
has_permission
has_permission_core
user_has_unit
qualquer RPC utilizada pelo fluxo de folha

Para cada RPC informe:

RETORNO
PARÂMETROS
SECURITY DEFINER?
SEARCH_PATH?
REGRA DE MASTER
REGRA DE DIRETOR
REGRA DE GESTOR
REGRA DE UNIDADE
REGRA DE SECRETARIA

Procure versões conflitantes da mesma RPC nas migrations.

============================================================
9. AUDITORIA DAS SERVER FUNCTIONS
============================================================

Localize funções responsáveis por:

- criar folha
- atualizar folha
- lançar frequência
- fechar frequência
- enviar para análise
- aprovar
- reprovar
- homologar
- corrigir
- reenviar

Para cada uma:

- quem pode executar
- qual RPC usa
- qual tabela altera
- qual status altera
- validação de unidade
- validação de secretaria
- validação de MASTER
- criação de auditoria
- tratamento de erro

Verifique se existe diferença entre:

frontend diz PERMITIDO
backend diz NEGADO

ou:

frontend diz NEGADO
backend permite.

============================================================
10. AUDITORIA DO ENVIO PARA ANÁLISE
============================================================

Esta é a parte MAIS IMPORTANTE.

Localize exatamente o botão/ação:

"Enviar para análise"

Descubra:

QUAL FUNÇÃO É CHAMADA?

Exemplo:

enviarFolhaParaAnalise()

ou RPC equivalente.

Depois acompanhe:

BOTÃO
↓
HOOK
↓
MUTATION
↓
SERVER FUNCTION
↓
RPC
↓
UPDATE
↓
STATUS
↓
AUDIT LOG

Informe exatamente onde o fluxo pode quebrar.

Verifique:

- status anterior
- status novo
- competência
- unidade
- usuário
- folha
- profissionais
- frequência

============================================================
11. INTEGRIDADE DOS DADOS
============================================================

Verifique se os dados lançados na frequência são os mesmos utilizados na folha.

Investigar:

- snapshot
- vínculo profissional
- competência
- unidade
- carga horária
- dias trabalhados
- faltas
- adicionais
- valores calculados

Identificar se a folha:

A) lê diretamente a frequência atual

ou

B) cria snapshot no momento do envio.

Se não existir snapshot, registrar como PONTO DE RISCO.

============================================================
12. AUDITORIA DE REPROVAÇÃO
============================================================

Descobrir:

Quando Gestor/MASTER reprova:

- qual status é gravado?
- motivo é gravado?
- usuário que reprovou é gravado?
- data é gravada?
- Diretor consegue visualizar?
- Diretor consegue editar?
- Diretor consegue reenviar?

Verificar se existe perda do histórico anterior.

============================================================
13. AUDITORIA DE APROVAÇÃO/HOMOLOGAÇÃO
============================================================

Descobrir exatamente:

GESTOR APROVA
↓
qual status?

MASTER HOMOLOGA
↓
qual status?

Confirmar se:

- Gestor pode homologar indevidamente
- Diretor pode aprovar indevidamente
- MASTER está sendo bloqueado
- uma folha homologada pode voltar para RASCUNHO
- uma folha aprovada pode ser editada

============================================================
14. AUDITORIA DO HISTÓRICO
============================================================

Verificar audit_log e/ou tabela específica da folha.

Cada mudança deveria permitir identificar:

- usuário
- perfil
- unidade
- ação
- status anterior
- status novo
- data/hora
- registro
- motivo

Identificar transições sem auditoria.

============================================================
15. AUDITORIA JWT × RPC × RLS
============================================================

Esta é OBRIGATÓRIA.

Monte uma tabela:

CAMADA | MASTER | GESTOR | DIRETOR | OPERACIONAL

JWT
RPC
RLS
FRONTEND
SERVER FUNCTION

Verifique se todas possuem a mesma definição de escopo.

Principalmente:

is_master
acesso_todas_unidades
acesso_todas_secretarias
authorized_units
unidade_principal_id
usuario_unidades

Se houver divergência, NÃO CORRIJA.

Apenas informe.

============================================================
16. AUDITORIA DE REGRESSÃO
============================================================

Procure migrations recentes que alteraram:

- RBAC
- permissões
- get_my_user_context
- get_my_permissions
- is_master
- unidades
- usuario_unidades
- RLS
- folha
- frequência

Identifique:

MIGRATION
DATA
ALTERAÇÃO
IMPACTO POTENCIAL

Tente descobrir qual alteração coincide com o início dos problemas relatados.

============================================================
17. TESTES FUNCIONAIS
============================================================

NÃO inventar testes.

Se o ambiente permitir execução autenticada, testar:

MASTER
GESTOR
DIRETOR
OPERACIONAL

Se NÃO houver sessão autenticada disponível:

marcar:

⚠️ NÃO VALIDADO EM RUNTIME

Não afirmar que está funcionando.

============================================================
18. MATRIZ FINAL ESPERADA
============================================================

Entregar:

| Ação | MASTER | GESTOR | DIRETOR | OPERACIONAL |
|---|---|---|---|---|
| Ver folha | | | | |
| Criar | | | | |
| Editar | | | | |
| Fechar | | | | |
| Enviar análise | | | | |
| Analisar | | | | |
| Reprovar | | | | |
| Corrigir | | | | |
| Reenviar | | | | |
| Aprovar | | | | |
| Homologar | | | | |

Não preencher por suposição.

Usar somente evidências encontradas.

============================================================
19. CLASSIFICAÇÃO DOS ACHADOS
============================================================

Classifique cada problema:

🔴 CRÍTICO
Impede fluxo ou permite acesso indevido.

🟠 ALTO
Pode quebrar fluxo em determinadas condições.

🟡 MÉDIO
Problema funcional sem risco direto de segurança.

🔵 BAIXO
Melhoria técnica.

============================================================
20. REGRA ABSOLUTA
============================================================

NÃO CORRIGIR NADA NESTA ETAPA.

NÃO ALTERAR:

- código
- SQL
- migrations
- RLS
- RPC
- permissões
- JWT
- componentes

Apenas investigar.

============================================================
21. RELATÓRIO FINAL OBRIGATÓRIO
============================================================

Entregar um relatório com:

1. STATUS GERAL:
   APROVADO / REPROVADO / PARCIAL

2. FLUXO REAL ENCONTRADO

3. FLUXO ESPERADO

4. DIFERENÇAS

5. CAUSAS RAIZ

6. TODOS OS ACHADOS

7. ARQUIVOS ENVOLVIDOS

8. RPCs ENVOLVIDAS

9. RLS ENVOLVIDAS

10. SERVER FUNCTIONS ENVOLVIDAS

11. MIGRATIONS SUSPEITAS

12. MATRIZ DE PERMISSÕES

13. MATRIZ JWT × RPC × RLS

14. TESTES EXECUTADOS

15. TESTES NÃO EXECUTADOS

16. CORREÇÕES RECOMENDADAS

17. ORDEM SEGURA PARA CORREÇÃO

18. RISCO DE CADA CORREÇÃO

19. O QUE NÃO DEVE SER ALTERADO

IMPORTANTE:

NÃO dizer "corrigido".

NÃO dizer "funcionando".

NÃO dizer "100%".

Somente após evidência real.

A auditoria deve terminar com:

"PRÓXIMA ETAPA RECOMENDADA"

e indicar exatamente quais problemas devem ser corrigidos primeiro.

============================================================
22. PDF DA AUDITORIA
============================================================

Depois de concluir a auditoria, gerar o PDF institucional:

AUDITORIA FORENSE — FLUXO DE ENVIO DA FOLHA

O PDF deve conter:

- objetivo
- fluxo real
- fluxo esperado
- matriz de perfis
- achados
- evidências
- riscos
- causa raiz
- plano de correção
- data/hora da auditoria

Não colocar como "aprovado" se houver problemas.

O PDF deve refletir EXATAMENTE os resultados encontrados.
*/
