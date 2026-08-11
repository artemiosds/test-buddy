import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: () => <Navigate to="/analitico" replace />,
});

/**
 * ════════════════════════════════════════════════════════════
 * TESTE DEFINITIVO — DIRETOR DE UNIDADE VÊ SUA PRÓPRIA UNIDADE?
 * (Pós-correção da recursão infinita em `usuarios`)
 * 
 * CONTEXTO:
 * Acabamos de corrigir a recursão infinita (42P17) na tabela
 * `usuarios`. Antes dessa correção, Diretores de Unidade (testado
 * com Marcos Tavares Rocha) não conseguiam ver sua própria unidade
 * em nenhuma tela, mesmo com vínculo confirmado no banco. Preciso
 * saber se essa correção TAMBÉM resolveu esse problema, ou se ainda
 * existe um bug separado.
 * 
 * ════════════════════════════════════════════════════════════
 * 
 * TESTE 1 — LOGIN REAL COMO DIRETOR
 * 
 * Fazer login de verdade (logout completo antes) como Marcos
 * Tavares Rocha (enfmarcostavares1@gmail.com) — mesmo usuário que
 * já testamos antes.
 * 
 * [ ] Nome e perfil aparecem corretamente no header?
 * [ ] Ir em Cadastro de Profissionais: a unidade dele (Hospital
 *     Maternidade São Domingos Sávio) aparece? Quantos profissionais
 *     aparecem (esperado: 85, conforme confirmado antes)?
 * [ ] Ir em Frequência (Contratados ou Efetivos): o campo "Unidade"
 *     mostra o nome da unidade, ou ainda aparece "Nenhuma unidade
 *     vinculada"?
 * 
 * Print de cada tela testada.
 * 
 * ════════════════════════════════════════════════════════════
 * 
 * TESTE 2 — SE AINDA FALHAR, USAR A MESMA TÉCNICA DE DEBUG QUE
 * FUNCIONOU
 * 
 * Se qualquer uma das telas do Teste 1 ainda não mostrar a unidade
 * corretamente, adicione TEMPORARIAMENTE o mesmo tipo de bloco
 * vermelho de debug usado antes (igual fizemos em usuarios.tsx),
 * desta vez na tela que estiver falhando, mostrando:
 *   - unidade_id detectado no contexto do usuário logado
 *   - erro da query que busca a unidade (se houver)
 *   - resultado bruto da query
 * 
 * NÃO escreva conclusão nenhuma até esse bloco aparecer numa tela
 * real e eu confirmar com print.
 * 
 * ════════════════════════════════════════════════════════════
 * 
 * TESTE 3 — CONFIRMAR MAIS 2 DIRETORES REAIS (não só o Marcos)
 * 
 * Repetir o Teste 1 (login real) com pelo menos mais 2 Diretores
 * diferentes, escolhidos por você entre os 13 já mapeados (ex:
 * Ana Carina Diniz Calderaro e Fabiano Deoclecio):
 * 
 * [ ] Cada um vê a própria unidade corretamente?
 * [ ] Print de cada um
 * 
 * ════════════════════════════════════════════════════════════
 * 
 * ENTREGA
 * 1. Prints reais do Teste 1 (Marcos)
 * 2. Se precisou do Teste 2 (bloco de debug), print dele também
 * 3. Prints do Teste 3 (mais 2 Diretores)
 * 4. Se tudo funcionar: remova qualquer bloco de debug adicionado
 * 5. Se algo AINDA falhar: não tente corrigir sozinho — reporte
 *    com a evidência do bloco de debug e aguarde instrução
 */
