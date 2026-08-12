# Plano de Correção: Visibilidade da Grade de Frequências com Filtro de Setor

O usuário relatou que, ao filtrar por **Setor** nos perfis **Administrador Master** e **Gestor**, a grade de profissionais desaparece, mesmo com uma unidade selecionada.

## Diagnóstico Técnico
O problema ocorre porque as funções de carregamento (`listarFolhaEfetivos` e `listarFolhaContratados`) aplicam um filtro estrito de `setor_id` no banco de dados. Quando um setor é selecionado na UI, o backend tenta buscar o registro de "frequência consolidada" (`frequencias`) específico para aquele setor. Se essa entrada de setor ainda não existir na tabela `frequencias` (o que é comum no primeiro acesso por setor), o sistema pode estar retornando um estado vazio ou falhando em resolver os profissionais corretamente.

Além disso, a lógica de `ensureFolhaEfetivos` cria a entrada na tabela `frequencias` se ela não existir, mas o filtro de profissionais na consulta subsequente usa `setor_id`, o que pode estar filtrando demais se houver divergências de cadastro.

## Alterações Propostas

### 1. Backend: Refinamento das Funções de Listagem
- **Arquivos**: `src/lib/frequencias-efetivos.functions.ts` e `src/lib/frequencias-contratados.functions.ts`.
- **Mudança**: Garantir que o filtro de profissionais por setor seja consistente com a unidade selecionada. Ajustar o `ensureFolhaEfetivos` para lidar corretamente com a criação de sub-folhas por setor.
- **Correção Específica**: No `listarFolhaContratados`, o filtro de setor estava sendo aplicado na busca de profissionais, mas a lógica de busca da "frequência consolidada" precisa ser robusta para não retornar nulo quando o setor é filtrado mas a folha global existe.

### 2. Backend: Sincronização (Orquestrador)
- **Arquivo**: `src/lib/frequencia-sincronizacao.functions.ts`.
- **Mudança**: Ajustar o `onConflict` e a lógica de busca para garantir que registros com `setor_id` nulo (folha da unidade) e `setor_id` preenchido (folha do setor) coexistam corretamente sem "sumir" com os dados um do outro.

### 3. Frontend: Ajuste na Reação ao Filtro
- **Arquivos**: `src/components/frequencias/frequencias-efetivos-page.tsx` e `src/components/frequencias/frequencias-contratados-page.tsx`.
- **Mudança**: Garantir que a `queryKey` do TanStack Query mude corretamente quando o filtro de setor for alterado, forçando um novo fetch que passe o `setor_id` para o servidor. Atualmente, o `setorFilter` é um array, mas as funções de listagem esperam um `string` (UUID). Vou ajustar para passar o primeiro item se houver apenas um selecionado.

## Verificação
1. Simular via preview o filtro de um setor específico.
2. Confirmar se a grade carrega os profissionais pertencentes àquele setor.
3. Verificar se o botão "Salvar" e "Enviar" operam sobre o contexto do setor.
