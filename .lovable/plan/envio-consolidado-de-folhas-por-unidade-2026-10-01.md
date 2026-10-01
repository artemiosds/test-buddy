# Envio consolidado de folhas por unidade

## Objetivo
Garantir que, ao enviar uma folha sem setor selecionado, todos os lançamentos da unidade daquela competência e tipo cheguem juntos para aprovação, sem mover, excluir ou duplicar dados.

## Implementação
1. **Envio seguro no servidor**
   - Efetivos: localizar a folha geral e todas as folhas setoriais irmãs, validar todas as linhas e alterar o status do conjunto.
   - Contratados: aplicar o envio a todos os profissionais da unidade; com setor selecionado, manter o comportamento atual.
   - Registrar histórico por folha existente e retornar a contagem distinta de profissionais e setores.

2. **Aprovações consolidadas**
   - Agrupar folhas da mesma competência, unidade e tipo quando fizerem parte do envio integral.
   - Exibir uma única submissão com total de profissionais distintos, quantidade de setores e o rótulo “Envio consolidado da unidade”.
   - Reunir as linhas de todas as folhas irmãs no modal, preservando o setor de cada profissional.
   - Aplicar analisar, aprovar, devolver ou rejeitar a todas as folhas do grupo, mantendo anexos e trilhas ligados aos registros originais.

3. **Correção de Outubro/2026**
   - Identificar exatamente a unidade Vigilância Sanitária, a competência 10/2026 e suas folhas de efetivos.
   - Antes de alterar, conferir IDs, status e totais; então alinhar apenas as folhas setoriais que pertencem à submissão já enviada.
   - Não alterar linhas, valores, profissionais, anexos ou IDs.

4. **Validação**
   - Testar envio geral e envio de setor isolado.
   - Conferir total distinto, abertura das linhas e ações conjuntas.
   - Verificar que o sistema compila sem erros e que nenhum dado foi removido.

## Detalhes técnicos
- A solução reutilizará as tabelas atuais e não mudará RLS, permissões ou estrutura do banco.
- Operações em lote validarão primeiro todos os registros; qualquer falha interromperá a mudança antes de concluir o fluxo.
- Duplicidades visuais serão eliminadas por `profissional_id`, escolhendo o lançamento válido mais recente sem apagar registros históricos.
