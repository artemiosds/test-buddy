import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: () => <Navigate to="/analitico" replace />,
});

/**
VALIDAÇÃO FINAL DE PRODUÇÃO — NÃO ALTERAR CÓDIGO

A correção forense foi declarada como concluída.

AGORA NÃO FAÇA NENHUMA ALTERAÇÃO.

Não criar migration.
Não alterar RLS.
Não alterar RPC.
Não alterar JWT.
Não alterar permissões.
Não alterar frontend.
Não corrigir nada.

Apenas VALIDAR o estado atual do sistema após as correções.

==================================================
1. BANCO DE DADOS
==================================================

Consultar e apresentar o estado REAL de:

public.status_frequencia

Confirmar se:

"devolvida"

existe no ENUM e é aceito pelo banco.

Confirmar também se "com_pendencias" ainda existe e onde é utilizado.

NÃO assumir que a sincronização está correta apenas porque a migration executou.

==================================================
2. RLS
==================================================

Verificar as policies das tabelas envolvidas:

frequencias
frequencia_profissional
frequencias_contratados
competencia_unidades
profissionais
unidades
usuarios
usuario_unidades

Confirmar:

- quais policies existem;
- quais colunas elas utilizam;
- se existe referência a deleted_at;
- se todas as colunas utilizadas realmente existem;
- se MASTER continua com acesso global;
- se Diretor continua isolado por unidade.

NÃO alterar nenhuma policy.

==================================================
3. DIRETOR DE UNIDADE
==================================================

Testar o fluxo completo:

LOGIN
↓
UNIDADE PRINCIPAL
↓
PROFISSIONAIS
↓
FREQUÊNCIA
↓
CRIAR RASCUNHO
↓
SALVAR
↓
ENVIAR PARA ANÁLISE

Confirmar:

✓ unidade aparece automaticamente;
✓ profissionais aparecem;
✓ frequência aparece;
✓ competência aparece;
✓ Diretor consegue salvar;
✓ Diretor consegue enviar;
✓ status muda corretamente.

Depois tentar acessar outra unidade.

Confirmar:

✗ não consegue visualizar;
✗ não consegue alterar;
✗ não consegue enviar frequência de outra unidade.

==================================================
4. GESTOR
==================================================

Testar:

✓ recebe frequência enviada;
✓ consegue abrir;
✓ consegue analisar;
✓ consegue devolver para correção;
✓ consegue aprovar quando permitido.

Após devolver:

status deve ser exatamente:

devolvida

ou o status oficial único definido pelo banco.

Não pode existir divergência entre frontend e banco.

==================================================
5. DIRETOR APÓS DEVOLUÇÃO
==================================================

Entrar novamente como Diretor.

Confirmar:

✓ frequência devolvida aparece;
✓ motivo/observação aparece, se existir;
✓ Diretor consegue editar;
✓ consegue salvar correção;
✓ consegue reenviar.

Confirmar mudança:

DEVOLVIDA
→
REENVIADA/EM ANÁLISE

conforme o workflow oficial existente.

==================================================
6. NOVA ANÁLISE
==================================================

Gestor/Master:

✓ recebe novamente;
✓ visualiza os dados corrigidos;
✓ consegue analisar;
✓ consegue aprovar.

==================================================
7. MASTER
==================================================

Testar com usuário MASTER:

✓ todas as unidades aparecem;
✓ profissionais de todas as unidades aparecem;
✓ frequências de todas as unidades aparecem;
✓ consegue analisar;
✓ consegue aprovar;
✓ consegue homologar;
✓ não perdeu nenhum acesso global.

IMPORTANTE:

Não aplicar filtro de unidade ao MASTER.

==================================================
8. ISOLAMENTO
==================================================

Criar/usar duas unidades:

UNIDADE A
UNIDADE B

Diretor A:

✓ pode acessar A
✗ não pode acessar B

Diretor B:

✓ pode acessar B
✗ não pode acessar A

MASTER:

✓ A
✓ B

GESTOR:

✓ somente o escopo permitido pela regra atual.

==================================================
9. INTEGRIDADE DA FOLHA
==================================================

Comparar:

frequencias
×
frequencia_profissional
×
frequencias_contratados

Verificar:

- quantidade de profissionais;
- quantidade de linhas;
- totais;
- competência;
- unidade;
- status.

Não pode haver divergência.

==================================================
10. AUDITORIA
==================================================

Verificar audit_log.

Confirmar registro das transições:

CRIADA
SALVA
ENVIADA
EM_ANALISE
DEVOLVIDA
REENVIADA
APROVADA
HOMOLOGADA

Quando aplicável.

==================================================
11. REGRESSÃO DOS PERFIS
==================================================

Verificar obrigatoriamente:

MASTER
GESTOR
DIRETOR DE UNIDADE
ADMINISTRATIVO
RECEPÇÃO
OUTROS PERFIS EXISTENTES

Objetivo:

Garantir que a correção da folha não alterou permissões de outros módulos.

Verificar especialmente:

- Usuários;
- Unidades;
- Profissionais;
- Setores;
- Frequência;
- Folha Contratados;
- Folha Efetivos;
- Dashboard;
- Mural;
- Permissões.

==================================================
12. BUILD E TESTES
==================================================

Executar:

npm run build

Executar os testes existentes.

Fazer busca final por:

"devolvida"
"com_pendencias"
"deleted_at"
"has_permission"
"is_master"
"get_my_user_context"
"get_my_permissions"

Apenas reportar.

NÃO modificar nada.

==================================================
13. REGRA MAIS IMPORTANTE
==================================================

NÃO RESPONDER:

"Está tudo funcionando"

sem apresentar evidências.

Para cada teste informar:

PASSOU
FALHOU
NÃO VALIDADO EM RUNTIME

Se não houver sessão autenticada para algum perfil:

marcar:

⚠️ NÃO VALIDADO EM RUNTIME

Não inventar resultados.

==================================================
RELATÓRIO FINAL
==================================================

Entregar uma tabela:

| Teste | Resultado | Evidência |
|---|---|---|
| ENUM devolvida | | |
| RLS | | |
| Diretor vê unidade | | |
| Diretor lança frequência | | |
| Diretor envia | | |
| Gestor recebe | | |
| Gestor devolve | | |
| Diretor corrige | | |
| Diretor reenvia | | |
| Gestor aprova | | |
| Master homologa | | |
| Isolamento por unidade | | |
| Totais | | |
| Audit Log | | |
| MASTER | | |
| GESTOR | | |
| DIRETOR | | |
| OUTROS PERFIS | | |
| Build | | |

NO FINAL:

Classificar o sistema como apenas uma das opções:

🟢 APROVADO PARA PRODUÇÃO
🟡 APROVADO COM PENDÊNCIAS
🔴 REPROVADO

Critério:

Só usar 🟢 APROVADO PARA PRODUÇÃO se todos os testes críticos tiverem evidência real.

Não alterar absolutamente nada durante esta validação.
*/
