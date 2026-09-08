# Botão "Abrir" dos Efetivos em Aprovações

Hoje, em Aprovações, o botão do olho ("Abrir") só leva para a tela "Folha — Contratados" quando o tipo é contratados. Para o tipo efetivos ele abre a página genérica da frequência, e não a tela "Folha — Efetivos".

## O que muda

1. Na lista de Aprovações, o botão "Abrir" das linhas do tipo **efetivos** passa a direcionar para a página **Folha — Efetivos**, já com a competência, a unidade e (quando houver) o setor da linha aplicados.
2. A página Folha — Efetivos passa a aceitar esses parâmetros no endereço, exatamente como a de Contratados já faz, iniciando os seletores com os valores recebidos.

## Detalhes técnicos

- `src/routes/_authenticated/frequencia.efetivos.tsx`: adicionar `validateSearch` com Zod (`competenciaId`, `unidadeId`, `setorId`, todos opcionais/uuid), espelhando o que já existe em `frequencia.contratados.tsx`.
- `src/components/frequencias/frequencias-efetivos-page.tsx`: ler `useSearch({ from: "/_authenticated/frequencia/efetivos" })` e usar como valor inicial de `competenciaId`, `unidadeId` e, se vier `setorId`, de `setorFilter`. Nenhuma alteração na lógica de carregamento, salvamento ou envio.
- `src/components/aprovacoes/AcoesFrequencia.tsx`: trocar o ramo do "Abrir" para efetivos por `<Link to="/frequencia/efetivos" search={{ competenciaId, unidadeId, setorId }} />` usando `r.competencia_unidades` e `r.setor_id`.

## Fora do escopo

Sem mudanças em banco, permissões, fluxos de aprovação/rejeição, anexos, trilha ou modal de linhas.
