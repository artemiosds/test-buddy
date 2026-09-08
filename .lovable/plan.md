# Visão "Todas as Unidades" nas Folhas (Contratados e Efetivos)

Hoje a opção "Todas as Unidades" aparece no seletor para quem tem acesso global, mas a tela fica vazia: as buscas da folha só rodam com uma unidade escolhida e o serviço exige um identificador de unidade válido. Também não existe folha "de todas as unidades" — cada folha pertence a uma unidade (e, nos efetivos, também a um setor), com status e aprovação próprios.

A proposta é transformar essa opção em uma **visão de conferência somente leitura** para Administrador Master e Gestor, sem tocar em salvamento, envio, aprovação, prazos ou permissões.

## O que muda

### 1. Nova busca consolidada (somente leitura)
- Criar uma consulta específica de consolidação por competência que traz os profissionais e os lançamentos de todas as unidades visíveis ao usuário, sem exigir uma unidade.
- Só disponível para quem tem acesso global (Master/Gestor). Para os demais, a opção continua indisponível e nada muda.
- A visibilidade continua sendo definida pelas regras de acesso já existentes no banco — nenhuma política é alterada.

### 2. Bloqueio de escrita na visão global
- Com "Todas as Unidades" ativa: edição das células desativada, autossalvamento desligado, e os botões Salvar rascunho, Enviar para análise e ações de aprovação ficam desabilitados com aviso do motivo.
- Aviso no topo da tela: conferência consolidada, escolha uma unidade para editar ou enviar.
- Exportações (Excel e PDF) permanecem ativas.

### 3. Coluna Lotação
- Na visão consolidada, a coluna Lotação passa a mostrar a unidade (sigla quando houver, senão o nome) de cada profissional, além do setor, para identificar a origem de cada servidor.

### 4. Seletor de unidade
- Manter "Todas as Unidades" apenas para acesso global; o valor passa a ser tratado corretamente pelas telas de folha (hoje ele é repassado como se fosse uma unidade).

## Limites de escopo
- Nenhuma alteração em banco de dados, políticas de acesso, perfis, regras de prazo, fluxo de aprovação/rejeição, anexos ou trilha.
- Nenhuma alteração no comportamento das folhas quando uma unidade específica está selecionada.
- Aprovações e Relatórios seguem exatamente como estão.

## Detalhes técnicos
- Novas funções de leitura: `carregarConsolidadoContratados` e `carregarConsolidadoEfetivos` em `src/lib/frequencias-contratados.functions.ts` e `src/lib/frequencias-efetivos.functions.ts`, validando apenas `competencia_id` e exigindo acesso global (`is_master`/perfil gestor) antes de consultar; sem `.eq("unidade_id", ...)`, com join de `unidades (nome, sigla)` e `setores (nome)`.
- Sentinela única `ALL_UNITS = "all"` compartilhada; `src/components/piso/UnidadeFilter.tsx` continua emitindo esse valor.
- Em `frequencias-contratados-page.tsx` e `frequencias-efetivos-page.tsx`: derivar `isGlobalView = unidadeId === ALL_UNITS && isGlobal`; trocar a query ativa por `queryKey` própria; forçar `canEdit = false`, desligar `autosaveRun`, desabilitar mutations de salvar/enviar e o filtro de setores; adicionar banner informativo.
- Exportações reaproveitam os geradores atuais; no consolidado o nome da unidade por linha vem do join, e o cabeçalho identifica "TODAS AS UNIDADES".

## Verificação
- Como Master: escolher "Todas as Unidades" e conferir que a tabela lista profissionais de várias unidades, com Lotação correta, células não editáveis e botões de salvar/enviar desabilitados.
- Trocar para uma unidade específica e confirmar que edição, autossalvamento e envio voltam a funcionar normalmente.
- Como Diretor de Unidade: nada muda; a opção global não aparece.
