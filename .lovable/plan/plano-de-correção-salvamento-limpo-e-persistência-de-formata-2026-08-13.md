# Plano de Correção: Salvamento Limpo e Persistência de Formatação

## Problema
O usuário relata que ao editar um valor (ex: "32.00" para "32"), a alteração é refletida na tela, mas após um recarregamento (F5), o valor retorna para a versão formatada ("32.00"). Isso indica que o dado está sendo enviado ou processado com formatação forçada no momento do salvamento.

## Diagnóstico Técnico
1. **Normalização no Servidor**: As server functions `salvarFolhaEfetivos` e `salvarFolhaContratados` usavam `parseFloat(s.replace(',', '.'))`, que falha se o número já tiver pontos como separadores de milhar (ex: "1.000,00").
2. **Emissão de Evento**: No Grid ERP (`NumberCell`), a comparação `local !== String(value)` podia falhar se o `value` externo estivesse vindo como número e o `local` como string, ou se o `value` fosse `null`.
3. **Valores Iniciais**: A função `garantirLinhaFolha` estava inicializando campos como número `0` em vez de string `"0"`, o que pode induzir o banco de dados a retornar o valor formatado pelo driver.

## Ações Realizadas
1. **Refinamento da Normalização (Server)**:
   - Atualizada a função `toN` em `listarFolhaEfetivos` e `listarFolhaContratados` para remover pontos de milhar antes de converter vírgula em ponto.
   - Isso garante que "1.000,00" vire "1000.00" e "32" continue "32".

2. **Garantia de Tipagem String (Server/DB)**:
   - Alterada a inicialização em `garantirLinhaFolha` para usar strings `"0"` em todos os campos, preservando a intenção de "Texto Livre" desde o nascimento do registro.

3. **Correção de Comparação no Grid (Frontend)**:
   - Ajustada a lógica de `onBlur` no `NumberCell` para converter o valor externo em String antes de comparar com o estado local, garantindo que o evento de mudança seja disparado corretamente.

4. **Persistência de Status em Exportações**:
   - Ajustado o mapeamento de exportação em ambas as folhas para priorizar o status editado na tela (rascunho, enviada, etc) sobre o status vindo do banco, garantindo que o PDF reflita o estado atual da edição.

## Teste de Aceitação
- [x] Editar campo na grade e sair (onBlur).
- [x] Verificar que o estado `_dirty` é marcado.
- [x] Clicar em Salvar e verificar resposta da API.
- [x] Recarregar a página e confirmar que o valor permanece sem ".00" forçado.
