import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: () => <Navigate to="/analitico" replace />,
});

/**
RELATÓRIO DE INVESTIGAÇÃO E CORREÇÃO - DADOS SALARIAIS (FASE 1)

1. RESULTADO LITERAL DA QUERY (BANCO DE DADOS):
[
  {"column_name": "adicional_noturno", "data_type": "numeric"},
  {"column_name": "gratificacao_incentivo", "data_type": "numeric"},
  {"column_name": "horas_extras", "data_type": "numeric"},
  {"column_name": "salario_base", "data_type": "numeric"},
  {"column_name": "salario_bruto", "data_type": "numeric"},
  {"column_name": "salario_liquido", "data_type": "numeric"},
  {"column_name": "vencimento_liquido", "data_type": "numeric"}
]

2. DIAGNÓSTICO DO CARD INVISÍVEL:
   - Causa Raiz: O Card "Dados salariais" no componente ProfissionalFormBody 
     estava condicionado à permissão 'profissional.dados_salariais'.
   - O perfil MASTER, apesar de ter acesso global via RLS e no menu, 
     NÃO tinha essa permissão específica vinculada na tabela 
     'perfil_permissoes'.
   - Além disso, a função 'openEdit' não estava mapeando os novos campos do 
     objeto profissional para os campos do formulário (reset do react-hook-form).

3. CORREÇÕES APLICADAS:
   - BANCO: Vinculada a permissão 'profissional.dados_salariais' ao perfil 
     MASTER na tabela public.perfil_permissoes.
   - UI (Gate): Alterada a condição de exibição no ProfissionalFormBody para 
     permitir visualização se o usuário for MASTER (userCtx?.is_master) OU 
     tiver a permissão específica.
   - UI (Form): Corrigida a função 'openEdit' para preencher corretamente os 
     campos salariais ao abrir o modal de edição.

4. RESPOSTAS DIRETAS (EVIDÊNCIA 4):
   - Quem vê hoje? Perfil MASTER (por padrão agora) e GESTOR (que já tinha 
     a permissão). Diretores de Unidade NÃO vêem, a menos que a permissão 
     seja concedida ao perfil deles.
   - Nome da permissão: 'profissional.dados_salariais' (ID: 61ffcd1f-c419-4a15-8bd6-deaf6165a752).

5. STATUS DO IMPORTADOR (EVIDÊNCIA 5):
   - O 'ImportProfissionaisDialog' já foi atualizado com os novos mapeamentos. 
   - A sanitização 'numericEmptyToNull' garante que campos vazios entrem como 
     NULL no banco, evitando erro 500.

PRÓXIMO PASSO: Favor verificar o modal de edição do Abmael agora. O Card 
"Dados salariais" deve estar visível na aba "Vínculo & Lotação".
*/

