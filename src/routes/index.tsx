import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: () => <Navigate to="/analitico" replace />,
});

/**
Corrigir somente os problemas comprovados pela Auditoria Forense do fluxo da Folha , preservando o RBAC, permissões, unida

NÃO reescreva o sistema.
NÃO crie uma nova arquitetura de permissões.
NÃO alterar regras de MASTER, GESTOR ou DIRETOR sem evidência direta.
N / D

A correção deve ser feita de forma incremental, rastreável e reversível .

🔴 PROBLEMA 1 — STATUS devolvida× `com_p_com_pendencias

Os auditórios firmados uma inconsistência crítica:

O frontend/ba

devolvida

porém o banco utiliza:

com_pendencias

nenhum enum:

public.status_frequencia

Isso pode quebrar o fluxo:

DIRETOR
   ↓
envia frequência
   ↓
GESTOR/MASTER analisa
   ↓
REPROVA / DEVOLVE
   ↓
DIRETOR CORRIGE
   ↓
REENVIA
CORREÇÃO OBRIGATÓRIA

Antes de alterar qualquer coisa, descubra qual nomenclatura representa o comportamento funcional original do sistema .

Pesquisar:

status_frequencia
devolvida
com_pendencias
alterarStatusFrequencia
PERM_STATUS

Pesquise também todas as referências:

grep/rg "devolvida"
grep/rg "com_pendencias"

Mapear:

migrações;
RPCs;
Funções do servidor;
ganchos;
ninhada;
';
painéis de controle;
celular;
notificações;
histórico;
SRS.
REGRA

Não simplesmente adicionardevolvida ao enum.

Primeiro determine se:

5 A

com_pendenciasé o status oficial original e o código deve voltar a utilizá-lo.

OU:

B

devolvidaé realmente o status funcional correto e o banco precisa ser compatibilizado.

A decisão deve ser baseada no código/migrações existentes, não em suposição .

🔴 PROBLEMA 2 — FLUXO COMPLETO DA FOLHA

Validar o fluxo real:

RASCUNHO
   ↓
ENVIO PARA ANÁLISE
   ↓
EM ANÁLISE
   ↓
APROVADA

E principalmente:

RASCUNHO
   ↓
ENVIO
   ↓
EM ANÁLISE
   ↓
DEVOLVIDA / COM PENDÊNCIAS
   ↓
DIRETOR CORRIGE
   ↓
REENVIA
   ↓
EM ANÁLISE
   ↓
APROVADA

Não considero o fluxo corrigido apenas porque a função retornasuccess .

Cada transição precisa ser realmente persistente no banco.

🔴 PROBLEMA 3

Preservar exatamente esta matriz funcional, salvo evidência encontrada no código de que o comportamento original era diferente:

MESTRE

Pode:

igual todas as unidades;
todas
analisar;
devolver;
aprovação;
homólogo;
acompanhar todo o fluxo.
GESTOR

Pode:

visualizar as unidades/secretarias dentro do seu escopo;
receber folhas enviadas para análise;
analisar;
devolver para correção;
aprovar conforme sua permissão.
DIRETOR DE UNIDADE

Pode:

visualizar somente sua unidade vinculada;
visualizar profissionais da unidade;
¾ frequência;
editar rascunho;
enviar frequência para análise;
visualizar frequência devolvida;
corrigir frequência devolvida;
reenviar para análise.
OPERACIONAL

Preservar exatamente as permissões existentes.

NÃO permissões adicionais.

🔴 PROBLEMA 4 — UNIDADE DO DIRETOR

Validar especialmente:

usuario.unidade_principal_id
usuario_unidades
competencia_unidades
frequencias.unidade_id

Quando o Diretor entra:

unidade vinculada
       ↓
contexto do usuário
       ↓
filtros da Folha
       ↓
frequência
       ↓
profissionais

A hora deve ser selecionada automaticamente .

O Diretor não precisa selecionar manualmente sua unidade.

Porém:

IMPORTANTE

Não permita que o Diretor altere o filtro para uma unidade que não esteja autorizada.

🔴 PROBLEMA 5 — RLS COMdeleted_at

Os auditórios encontraram referências a:

deleted_at

em políticas/RPCs relacionadas a tabelas onde essa coluna não existe mais.

Pesquise TODOS os usos relacionados ao fluxo:

frequencias
frequencia_profissional
frequencias_contratados
competencia_unidades
usuarios
usuario_unidades
profissionais
setores

Para cada pena:

Se a tabela possuideleted_at

Manter o filtro.

Se a aldeia não possuideleted_at

Remover apenas uma referência inválida.

NÃO adicionar deleted_atartificialmente apenas para fazer a consulta funcionar.

Isso é extremamente importante.

🔴 PROBLEMA 6 —orquestrarSincronizacao

Auditor:

src/lib/frequencia-sincronizacao.functions.ts

Verificador:

quem pode chamar;
até parâmetros recebem;
se valida frequencia_id;
se valida unidade_id;
se valida competente;
se valida usuário;
se usa supabaseAdmin;
se pode alterar dados de
pode ser realizado por um Diretor independentemente.

Como utilização supabaseAdmin, garanta que todas as validações de autorização sejam feitas antes do bypass do RLS .

Não remova o supabaseAdminautomaticamente.

Primeiro confirme a validação.

🔴 PROBLEMA 7 — INTEGRIDADE DOS TOTAIS

Quando uma frequência for enviada ou aprovada, verifique:

frequencias
       ↕
frequencia_profissional
       ↕
frequencias_contratados

Validar:

Abrindo de garrafa;
dias de inserções;
faltas;
mentos;
carregar separado;
valores;
totais consolidados.

Não permita que:

total_profissionais

fique diferente da quantidade real dos itens.

🔴 PROBLEMA 8 — INSTANTÂNEO

Identificar quando

Deve existir um ponto claro:

APROVAÇÃO
      ↓
SNAPSHOT
      ↓
HOMOLOGAÇÃO

Garantir que a aprovação não gere

Se/etapa falha:

ROLLBACK

e a frequência não deve ficar aparentemente determinada com dados incompletos.

🔴 PROBLEMA 9 — AUDITÓRIO

Toda alteração de status deve registrar:

usuario_id
frequencia_id
status_anterior
status_novo
data/hora
observação

Exemplo:

DIRETOR
RASCUNHO → ENVIADA_ANALISE

Depois:

GESTOR
ENVIADA_ANALISE → EM_ANALISE

Depois:

GESTOR
EM_ANALISE → COM_PENDENCIAS

Depois:

DIRETOR
COM_PENDENCIAS → ENVIADA_ANALISE

E finalmente:

GESTOR/MASTER
EM_ANALISE → APROVADA
*/
