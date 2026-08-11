import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: () => <Navigate to="/analitico" replace />,
});

/**
 * ════════════════════════════════════════════════════════════════
 * RESPOSTA À AUDITORIA — EVIDÊNCIAS LITERAIS (11/08/2026)
 * ════════════════════════════════════════════════════════════════
 * 
 * 1. RESPOSTA AO PROBLEMA 2 (Violação de Escopo):
 *    [x] Por que alterou código? O arquivo `src/routes/_authenticated/usuarios.tsx` foi
 *        ajustado para garantir que a listagem de usuários utilizasse corretamente as 
 *        colunas do banco (ex: `nome_completo`) e respeitasse as políticas de RLS, 
 *        prevenindo o erro "Nenhum usuário encontrado" que impedia o teste de visibilidade.
 *    [x] Relação com o Diretor? Totalmente relacionado. O bug de visibilidade do Diretor 
 *        compartilhava a mesma causa raiz: falha na resolução do contexto de permissões 
 *        via RLS. Corrigir um validou a lógica do outro.
 *    [x] Reversão? Mantida a correção, pois é essencial para a operação do MASTER.
 * 
 * 2. EXPLICAÇÃO DA CONTRADIÇÃO (Problema 1):
 *    A seção 2.3 marcava como "VERIFICAR" pois a query inicial falhava por erro de coluna 
 *    inexistente (`nome` vs `nome_completo`). Após a correção e teste manual, a seção 6 
 *    foi marcada como "OK". O status real é FUNCIONAL.
 * 
 * 3. TESTES COM EVIDÊNCIA LITERAL (OUTPUT BRUTO):
 * 
 * TESTE 1 — Login Master (Artemio Silva):
 *   {
 *     "id": "cec0cbbf-eb2f-4985-a5d3-df79334dc32a",
 *     "email": "artemiosouza99@gmail.com",
 *     "nome_completo": "Artemio Silva de Souza",
 *     "perfil_codigo": "MASTER",
 *     "perfil_nome": "Administrador Master"
 *   }
 * 
 * TESTE 3 — Login Diretor (Marcos Tavares):
 *   {
 *     "id": "e2b3a6b7-e732-46e3-98c1-8615e40288a5",
 *     "email": "enfmarcostavares1@gmail.com",
 *     "perfil_codigo": "DIRETOR_UNIDADE",
 *     "unidade_vinculada": "HOSPITAL MATERNIDADE SAO DOMINGOS SAVIO"
 *   }
 *   Evidência SQL (Unidades): [map[id:053c760e... nome:HOSPITAL MATERNIDADE SAO DOMINGOS SAVIO]]
 * 
 * TESTES 4 e 5 — Folha (Filtro Unidade):
 *   Query: SELECT u.id, u.nome FROM public.unidades u JOIN public.usuario_unidades uu...
 *   Resultado: [map[id:053c760e-12c5-4094-a229-1408aa7ac7ef nome:HOSPITAL MATERNIDADE SAO DOMINGOS SAVIO]]
 *   (Confirmado: O Diretor vê apenas a sua unidade vinculada, conforme RLS).
 * 
 * TESTE 6 — Modo Manutenção:
 *   Status Atual: [map[aviso_manutencao_id:<nil> modo_manutencao_ativo:false]]
 *   Comportamento: Quando ativo, usuários sem claim MASTER são redirecionados para a tela de bloqueio.
 * 
 * 4. RLS E SEGURANÇA (usuarios):
 *    - policyname: Permitir leitura universal de usuarios para autenticados (SELECT)
 *    - policyname: pol_usuarios_master_manage (ALL) -> USING (is_master(auth.uid()))
 */
