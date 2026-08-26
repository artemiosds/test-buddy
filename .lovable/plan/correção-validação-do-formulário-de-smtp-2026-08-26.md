# Correção: validação do formulário de SMTP

Ajustar o componente `src/components/configuracoes/smtp-config-section.tsx` para que os valores retornados por `obterConfiguracaoSMTP` (banco ou variáveis de ambiente) sejam efetivamente aplicados ao estado do formulário antes de qualquer submit, eliminando o erro Zod `too_small` em `smtp_host`.

## 1. Diagnóstico

- O componente já possui um `useEffect` que sincroniza `data` → `form`, mas o erro indica que, no momento do clique em "Salvar alterações", o estado ainda contém o objeto `VAZIO`.
- Possíveis causas: submit acionado antes da query finalizar, `data` retornando `smtp_host` vazio por algum caminho, ou o `useEffect` sobrescrevendo edições do usuário de forma inconsistente.

## 2. Correções no componente

1. **Sincronização única e segura dos valores iniciais**
   - Usar uma flag `inicializado` (ref ou estado booleano) para aplicar os valores da query ao `form` apenas uma vez, quando `data` passa de `undefined` para um objeto válido.
   - Isso evita que futuras refetchs sobrescrevam campos que o usuário já editou.

2. **Bloqueio de submit enquanto os dados não carregam**
   - Desabilitar o botão "Salvar alterações" e o botão "Testar conexão" enquanto `isLoading` for `true` ou `inicializado` for `false`.
   - Garantir que não seja possível submeter o formulário com o estado `VAZIO`.

3. **Preenchimento completo das sugestões de ambiente**
   - Verificar se o retorno de `obterConfiguracaoSMTP` para origem `env` está preenchendo todos os campos (`smtp_host`, `smtp_port`, `smtp_user`, `smtp_from_email`, `smtp_from_name`, `smtp_secure`, `smtp_ativo`).
   - Se houver campo vindo como `null` ou `undefined`, aplicar fallback coerente no `useEffect` (ex.: `smtp_from_email` igual a `smtp_user`, `smtp_from_name` com o padrão do sistema).

4. **Validação visual mínima dos botões**
   - Manter a validação já existente que desabilita "Testar" quando `smtp_host` ou `smtp_user` estão vazios.
   - Aplicar a mesma validação ao botão "Salvar alterações".

## 3. Verificação

1. Acessar `/configuracao` como Master.
2. Aguardar o fim do loading e clicar em "Salvar alterações" sem editar nada.
3. Confirmar que a configuração é salva sem erro Zod.
4. Editar um campo, salvar novamente e confirmar que o valor editado persiste.
5. Recarregar a página e verificar que os valores salvos (ou as sugestões de ambiente) reaparecem corretamente.
