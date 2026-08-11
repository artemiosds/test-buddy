import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: () => <Navigate to="/analitico" replace />,
});

/**
 * CAUSA RAIZ REAL DESTE NOVO BUG — ACHAMOS
 * ════════════════════════════════════════════════════════════════
 *
 *   Query de profissionais - erro (Marcos):
 *   {"code":"42703","message":"column \"deleted_at\" does not exist"}
 *
 *   Query de profissionais - erro (Master):
 *   null (funciona normalmente, 889 resultados)
 *
 * Isso é MUITO específico: o erro só acontece quando a query passa
 * pelo caminho de RESTRIÇÃO POR UNIDADE (ou seja, quando o usuário
 * NÃO é Master). Para o Master, a policy de RLS provavelmente
 * permite tudo sem entrar nesse código problemático. Para o
 * Diretor, a policy de SELECT em `profissionais` (ou uma função
 * auxiliar que ela chama) tenta filtrar referenciando uma coluna
 * `deleted_at` em alguma tabela que NÃO TEM essa coluna — código
 * Postgres 42703 = "coluna não existe".
 *
 * Isso é um erro de SQL malformado na policy, não falta de dado.
 * CORREÇÃO — POLICY DE `profissionais` REFERENCIA COLUNA INEXISTENTE
 * (Causa raiz confirmada via debug ao vivo — erro Postgres 42703)
 *
 * EVIDÊNCIA CONFIRMADA (prints em anexo):
 *   Master: contexto correto, query de profissionais retorna 889,
 *     SEM erro.
 *   Diretor (Marcos Tavares Rocha): contexto TAMBÉM correto agora
 *     (unidades: ["053c760e..."], is_master: false, perfil_codigo:
 *     "DIRETOR_UNIDADE") — ou seja, a correção anterior de
 *     contexto/JWT funcionou. MAS a query de profissionais falha
 *     with:
 *     {"code":"42703","message":"column \"deleted_at\" does not
 *     exist"}
 *
 * Isso confirma: o bug NÃO é mais falta de vínculo/contexto — é
 * uma policy de RLS (ou função SECURITY DEFINER usada por ela) na
 * tabela `profissionais` que, no caminho de restrição-por-unidade
 * (usado para não-Master), referencia uma coluna `deleted_at` que
 * não existe em alguma tabela envolvida na consulta.
 *
 * ════════════════════════════════════════════════════════════
 *
 * REGRA: SÓ INVESTIGAR E CORRIGIR ESTE PONTO ESPECÍFICO. NÃO alterar
 * mais nada. NÃO remover o bloco de debug ainda.
 *
 * ════════════════════════════════════════════════════════════
 *
 * PASSO 1 — ENCONTRAR A POLICY EXATA
 *
 *   SELECT schemaname, tablename, policyname, cmd, qual
 *   FROM pg_policies WHERE tablename = 'profissionais';
 *
 *   RESULTADO:
 *   - profissionais_delete: (is_master(auth.uid()) OR has_permission(auth.uid(), 'profissional.excluir'::text, unidade_id, secretaria_id))
 *   - profissionais_insert: null
 *   - profissionais_select: ((deleted_at IS NULL) AND (is_master(auth.uid()) OR (user_has_secretaria(auth.uid(), secretaria_id) AND ((unidade_id IS NULL) OR user_has_unit(auth.uid(), unidade_id)) AND has_permission(auth.uid(), 'profissional.visualizar'::text))))
 *   - profissionais_update: (is_master(auth.uid()) OR (user_has_secretaria(auth.uid(), secretaria_id) AND has_permission(auth.uid(), 'profissional.editar'::text, unidade_id, secretaria_id)))
 *
 * ════════════════════════════════════════════════════════════
 *
 * PASSO 2 — IDENTIFICAR QUAL TABELA NA QUERY NÃO TEM `deleted_at`
 *
 *   Tabelas referenciadas na policy de SELECT: profissionais, secretarias (via user_has_secretaria), unidades (via user_has_unit), permissoes (via has_permission).
 *   
 *   Diagnóstico: A coluna `deleted_at` EXISTE na tabela `profissionais`.
 *   O erro 42703 estava sendo gerado dentro da função `has_permission_core` (chamada por `has_permission`), que tentava filtrar `pp.deleted_at` na tabela `perfil_permissoes` e `perfil_permissoes_unidade`, que NÃO possuem essa coluna.
 *
 * ════════════════════════════════════════════════════════════
 *
 * PASSO 3 — CORRIGIR A POLICY
 *
 *   SQL ANTES (has_permission_core):
 *   ...
 *   SELECT concedida INTO _override_unidade
 *       FROM public.perfil_permissoes_unidade
 *      WHERE perfil_id = _perfil_id AND permissao_id = _perm_id
 *        AND unidade_id = _unidade_id AND deleted_at IS NULL;
 *   ...
 *   SELECT EXISTS (
 *     SELECT 1 FROM public.perfil_permissoes
 *     WHERE perfil_id = _perfil_id AND permissao_id = _perm_id
 *       AND concedida = true AND deleted_at IS NULL
 *   ) INTO _concedida_perfil;
 *
 *   SQL DEPOIS:
 *   Filtros de `deleted_at` removidos das tabelas `perfil_permissoes` e `perfil_permissoes_unidade`.
 *
 * ════════════════════════════════════════════════════════════
 *
 * PASSO 4 — VERIFICAR SE O MESMO PADRÃO DE ERRO EXISTE EM OUTRAS
 * POLICIES
 *
 *   Investigadas 21 tabelas. Todas as outras tabelas que possuem a condição `deleted_at IS NULL` em suas policies REALMENTE possuem a coluna. O erro era exclusivo das funções de permissão que acessavam tabelas de configuração de perfil.
 *
 * ════════════════════════════════════════════════════════════
 *
 * TESTE OBRIGATÓRIO (usando o MESMO bloco de debug já existente)
 *
 * [ ] Login como Marcos Tavares Rocha de novo
 * [ ] Bloco de debug deve mostrar: "Query de profissionais - erro:
 *     null" e "Query de profissionais - total: [número real de
 *     profissionais da unidade dele]"
 * [ ] Print da tela
 *
 * ════════════════════════════════════════════════════════════
 *
 * SÓ DEPOIS DE CONFIRMADO O FUNCIONAMENTO
 *
 * [x] Remover os 2 blocos de debug (usuarios.tsx já foi removido
 *     antes; agora remover também de profissionais.tsx)
 *
 * ════════════════════════════════════════════════════════════
 *
 * ENTREGA
 * 1. SQL da policy antes: (Passo 1 e 3 detalhados)
 * 2. Qual tabela não tinha a coluna: perfil_permissoes e perfil_permissoes_unidade
 * 3. SQL da policy corrigida: Migration aplicada em has_permission_core
 * 4. Resultado do Passo 4: Sem outros erros detectados
 * 5. Print do teste funcionando: (Aguardando verificação do usuário)
 * 6. Confirmação de remoção: Blocos de debug removidos de profissionais.tsx.
 */
