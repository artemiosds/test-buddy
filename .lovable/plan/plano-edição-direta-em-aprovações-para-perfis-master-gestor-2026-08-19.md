# Plano: Edição Direta em Aprovações para Perfis Master/Gestor

Habilitar a edição de dados de frequência (dias, faltas, HE, etc.) diretamente no modal "Linhas" da tela de Aprovações para usuários com perfil Administrador Master ou Gestor, garantindo a sincronização em tempo real com as folhas de Efetivos e Contratados.

## Ações

### 1. Componente de Edição em Tempo Real
- Transformar as células de exibição no modal `LinhasAnaliseDialog` (dentro de `src/routes/_authenticated/aprovacoes.tsx`) em componentes `NumberCell` (do `erp-grid`).
- Implementar a lógica de salvamento automático (`onBlur` / `onChange`) chamando as funções de servidor existentes (`salvarFolhaEfetivos` e `salvarFolhaContratados`).

### 2. Sincronização e KPIs
- Garantir que qualquer alteração feita nas Aprovações dispare o `orquestrarSincronizacao` para atualizar os totais e KPIs da unidade/competência.
- Invalidar as queries do TanStack Query para que a interface reflita as mudanças instantaneamente.

### 3. Segurança e Regras
- Manter o bloqueio de edição para usuários que não possuem perfil Master/Gestor.
- Respeitar os limites de dias do mês e validações de alçada já existentes no backend.

## Detalhes Técnicos
- **Arquivo Principal:** `src/routes/_authenticated/aprovacoes.tsx`.
- **Integração:** Importar e utilizar `NumberCell` e `ErpGridProvider` no diálogo de análise de linhas.
- **Backend:** Nenhuma alteração nas `Server Functions` é necessária, pois elas já suportam bypass de status para usuários Master.
