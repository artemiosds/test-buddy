# Sprint Final de Qualidade — Plano em Ondas

**Restrições fixas** (todas as ondas): não altero regras de negócio, schema/RLS, permissões, rotas, autenticação. Identidade visual (paleta Hospital Clean v14, sidebar navy, botões Blue Royal) fica intacta. Só padronizo tokens globais em `src/styles.css` (espaçamento, sombra, radius, tipografia, alturas de controle, hover/focus).

Cada onda é **um turno seu** para eu executar. No fim de cada onda entrego: o que mudou, evidências (build/lint/screenshots), e o que fica pendente para a próxima.

---

## Onda 1 — Baseline & Higiene de Código
Sem mudança visual. Estabelece o ponto de partida.

- Rodar `tsgo`, ESLint, `vite build`, `vitest` — capturar contagens.
- Varredura de código morto: imports não usados, arquivos órfãos, `console.log`, `TODO`, dependências não usadas (`depcheck`).
- Detectar duplicações óbvias (hooks, utils, estilos repetidos).
- Remover só o que for seguro (dead code puro). Duplicações viram lista para Onda 4.

Entrega: relatório de baseline + PR de limpeza mínima.

## Onda 2 — Performance
Foco: reduzir JS enviado e re-renders.

- Analisar bundle (`vite build` com stats), identificar chunks pesados.
- Converter rotas/páginas grandes em `React.lazy` / `.lazy.tsx` quando fizer sentido.
- Verificar `React.memo`, `useMemo`, `useCallback` onde há re-render em cascata mensurável (dev-tools profiler nas telas críticas: Folhas, Dossiê, Sala de Situação).
- Consultas repetidas → consolidar em `queryKey` compartilhado; garantir `staleTime` sensato.
- Imagens em `src/assets/` → verificar tamanhos e formato.
- CSS duplicado → consolidar.

Corrijo só quando houver ganho mensurável (Δ bundle ou Δ render).

## Onda 3 — Acessibilidade (WCAG AA)
- Contraste: rodar checagem nos tokens contra fundo (`text-muted-foreground` sobre `card`, badges pastel, etc.).
- Touch targets ≥ 44×44 em todos os controles interativos.
- `aria-label` em botões-ícone; `label` associado a todo input; ordem de tab; foco visível consistente.
- `<main>` único por página; landmarks corretos.
- `role`/`aria` onde há widget custom.

## Onda 4 — Consistência Visual & Tokens
Padroniza tokens globais mantendo a identidade v14.

- Escala de espaçamento (4/8/12/16/24/32) — auditar `p-*`/`m-*` fora da escala.
- Radius: um valor para cards, outro para inputs/buttons, outro para badges. Consolidar.
- Sombras: 3 níveis (sm/md/lg) só.
- Tipografia: escala de tamanhos e pesos consolidada.
- Alturas de controle: input 40px, button md 40px, sm 32px, icon 40px.
- Hover/focus: um único padrão em `@utility`.
- Componentes fora do padrão (cards artesanais, tabelas hand-rolled) migram para `DataTable`/`KpiCard`/`PageHeader` já existentes.

## Onda 5 — Responsividade & Auditoria Final
Playwright headless nas viewports pedidas: **320, 360, 375, 390, 412, 430, 768, 820, 912, 1024, 1366, 1440, 1600, 1920, 2560**.

**Rotas críticas (screenshots em todas as viewports):** Painel Executivo, Sala de Situação, Competências, Frequências, Folha Contratados, Folha Efetivos, Cadastro Profissional, Dossiê, Quadro de Lotação, Unidades, Setores, Aprovações, Relatórios, Piso Enfermagem, Configurações, Login, Recuperar Senha.

**Rotas secundárias:** só gero evidência quando há overflow, quebra, botão inacessível, tabela quebrada, modal quebrado, erro. Caso contrário: ✅ Aprovada.

Desktop wide (1600/1920/2560): garantir uso de 95–97% da largura útil sem esticar demais tipografia.

**Relatório final** com notas 0–100 para Performance / UX / Responsividade / Acessibilidade / Consistência Visual / Qualidade de Código, e a resposta **✅ Sim** ou **❌ Não** para pronto-produção (se ❌, lista dos bloqueadores).

---

## Como quero prosseguir

Este plano fica salvo. **Responda "executar onda 1"** (ou 2/3/4/5) para eu rodar a onda correspondente. Se preferir que eu emende as ondas 1→2→3→4→5 automaticamente sem confirmar entre elas, diga "executar todas as ondas" — nesse caso vou parar só se aparecer regressão ou algo que exija sua decisão.
