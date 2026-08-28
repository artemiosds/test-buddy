# Autosalvamento em segundo plano — Folhas de Efetivos e Contratados

Objetivo: gravar automaticamente as alterações da grade enquanto o usuário trabalha, sem travar o cursor, mantendo os botões manuais como estão hoje.

## Comportamento

- Qualquer alteração numa célula marca a linha como pendente (`_dirty`) e agenda um salvamento em segundo plano.
- Debounce de 900ms: enquanto o usuário digita continuamente, o relógio reinicia; ao parar (ou ao sair do campo, `onBlur`) a gravação dispara imediatamente.
- Só as linhas pendentes são enviadas, sempre com o mesmo setor usado na leitura da folha (correção já aplicada anteriormente).
- O salvamento roda em background: não fecha a linha em edição, não move o foco e não exibe toasts de sucesso (só o indicador visual).
- Falha de rede/RLS: os valores digitados permanecem na tela e a linha continua pendente para nova tentativa.
- Autosalve só ativa quando a folha está editável (mesma regra do botão "Salvar rascunho"); folhas enviadas/aprovadas não salvam sozinhas.
- Ao sair da página com alterações pendentes, dispara um último salvamento e avisa antes de descartar.

## Indicador visual

Badge discreto no cabeçalho das duas páginas, ao lado dos botões:

- Amarelo, com spinner: "Salvando alterações..."
- Verde, com check: "Todas as alterações salvas"
- Vermelho: "Erro ao salvar alterações" — clicável para tentar novamente
- Cinza/oculto quando nada foi alterado ainda

## Botões

"Salvar rascunho" e "Enviar para análise" permanecem como estão (confirmação manual e tramitação com validação de pendências). O autosalve apenas antecipa a gravação do rascunho.

## Detalhes técnicos

- Novo hook `src/hooks/use-autosave-folha.ts`: recebe a função de salvar, o payload de linhas pendentes e o estado de edição; gerencia timer de debounce, fila (evita chamadas concorrentes — se chegar alteração durante um envio, reagenda), e expõe `status: "idle" | "saving" | "saved" | "error"` mais `retry()`.
- Novo componente `src/components/frequencias/autosave-badge.tsx` usando tokens semânticos do design system.
- `frequencias-efetivos-page.tsx`: reaproveitar `payloadDirty()` e `setorUnico`; chamar o hook no `setCampo`/`onBlur` dos inputs; limpar `_dirty` apenas após confirmação do servidor (mesma lógica de `mSalvar.onSuccess`), sem toast; invalidar `folha-efetivos` e `frequencia-resumo` de forma silenciosa (sem refetch que sobrescreva linhas pendentes).
- `frequencias-contratados-page.tsx`: mesma integração, usando a lista de pendentes e o `setor_id` derivado do filtro atual.
- Servidores continuam os mesmos: `salvarFolhaEfetivos` (grava em `frequencia_profissional` vinculada a `frequencias`) e `salvarFolhaContratados` (`frequencias_contratados`). Nenhuma mudança de banco de dados é necessária.
