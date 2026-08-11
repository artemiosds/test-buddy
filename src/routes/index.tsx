import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: () => <Navigate to="/analitico" replace />,
});

/**
Preciso das evidências específicas antes de considerar a Fase 1
concluída, exatamente como pedido:

1. Rode e cole o resultado literal:
   SELECT column_name, data_type FROM information_schema.columns
   WHERE table_name = 'profissionais' 
   AND column_name IN ('salario_base', 'salario_liquido', 
   'salario_bruto', 'horas_extras', 'adicional_noturno', 
   'gratificacao_incentivo', 'vencimento_liquido');

2. Print do formulário "Editar profissional" mostrando o novo
   Card "Dados salariais" com os 7 campos visíveis

3. Print do Relatório Gerencial de Profissionais mostrando os
   novos campos

4. Responda diretamente: qual perfil pode ver esses campos hoje?
   Só Master/Gestor, ou também Diretor de Unidade vê os
   profissionais da própria unidade? Qual permissão exata foi
   criada (nome)?

5. Confirme: o importador de planilha (ImportProfissionaisDialog)
   já aceita as 7 novas colunas? Teste real: importe uma planilha
   de teste com 2-3 profissionais preenchendo esses campos, e
   cole o resultado da query confirmando que os valores entraram
   certos no banco.

6. Teste também o caso vazio: editar um profissional deixando os
   7 campos em branco, salvar — confirmar que NÃO dá erro 500
   (esse é o mesmo tipo de bug que já corrigimos antes com
   sanitização numeric).

Sem essas 6 evidências, não considero a Fase 1 pronta para
avançarmos para a Fase 2 (importação por PDF com IA).
*/
