# Plano de Implementação: Submissão de Frequências por Setor

Este plano descreve as alterações necessárias para permitir que unidades com setores vinculados possam enviar suas frequências para análise de forma individualizada por setor.

## Alterações Propostas

### 1. Extensão do Banco de Dados
- **Tabela `frequencias`**: Adicionar a coluna `setor_id` (UUID, opcional).
- **Restrição de Unicidade**: Atualizar a restrição para incluir o `setor_id`, permitindo múltiplos registros de submissão para a mesma unidade/tipo (um por setor).

### 2. Funções de Servidor (Server Functions)
- **`enviarFolhaEfetivos` e `enviarFolhaContratados`**:
    - Adicionar suporte a um `setor_id` opcional.
    - Quando fornecido, a função processará apenas os profissionais vinculados àquele setor.
    - Criará um registro específico na tabela consolidada `frequencias` para este setor.
- **`orquestrarSincronizacao`**:
    - Ajustar a lógica para agregar dados (totais de profissionais, dias, faltas) respeitando o `setor_id`.

### 3. Interface de Usuário (UI)
- **Tela de Frequências**:
    - Adicionar um filtro de setor no topo da página.
    - O botão "Enviar para Análise" enviará apenas o setor selecionado (se houver um filtro ativo) ou a unidade toda (se "Todos" estiver selecionado).
    - Exibir o status de submissão (Rascunho, Enviada, etc.) por setor.
- **Tela de Aprovações**:
    - Atualizar a listagem para mostrar submissões individuais por setor, permitindo que o gestor aprove ou rejeite setores independentemente.

### 4. Geração de PDF
- **PDFs Oficiais**:
    - Ajustar os geradores de PDF para filtrar por setor quando a submissão for setorial.

## Detalhes Técnicos
- Migração para adicionar `setor_id` na tabela `frequencias`.
- Atualização das server functions em `src/lib/frequencias-*.functions.ts`.
- Ajuste na lógica de sincronização em `src/lib/frequencia-sincronizacao.functions.ts`.
