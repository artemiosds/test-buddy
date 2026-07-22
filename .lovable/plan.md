## Escopo
Congelar as 4 primeiras colunas de identificação nas duas telas de folha, para que ao rolar horizontalmente os campos numéricos, o usuário mantenha visível quem é o profissional daquela linha.

**Arquivos que serão tocados:**
- `src/components/erp-grid/index.tsx` — reativar utilitário sticky (hoje é no-op).
- `src/styles.css` — reativar as classes `.erp-sticky` e `.erp-sticky-last` (hoje comentadas como no-op) com `position: sticky`, `left`, `z-index` e sombra à direita.
- `src/components/frequencias/frequencias-efetivos-page.tsx` — aplicar classe sticky nas 4 primeiras colunas do `<thead>`, `<tbody>` e `<tfoot>`.
- `src/components/frequencias/frequencias-contratados-page.tsx` — idem.

**Não tocar:** Piso Nacional da Enfermagem, cálculos, RLS, server functions, aprovação, ordem das colunas.

## Colunas fixas (4 primeiras de cada tela)

**Folha — Efetivos:** Matrícula, Profissional, Situação, Proj.
**Folha — Contratados:** Nº, Matrícula, Nome, CPF.

Nas duas, a 4ª coluna ganha `.erp-sticky-last` (sombra à direita indicando o limite da área rolável).

## Implementação técnica

**CSS (`src/styles.css`, bloco `.erp-grid .erp-sticky*` já existente, hoje no-op):**
```css
.erp-grid .erp-sticky {
  position: sticky;
  background: var(--card);         /* mesma cor da linha para cobrir o scroll */
  z-index: 5;
}
.erp-grid thead .erp-sticky { z-index: 25; background: oklch(0.22 0.03 250); }
.erp-grid tfoot .erp-sticky { z-index: 18; }
.erp-grid .erp-sticky-last {
  box-shadow: 4px 0 6px -4px rgba(15,23,42,0.18);
  border-right: 1px solid oklch(0.86 0.01 250);
}
/* zebra/hover/situação já pintam <td>; sticky herda porque usa a mesma cor
   via background: inherit em uma regra específica para tbody. */
.erp-grid tbody tr:nth-child(even) td.erp-sticky { background: oklch(0.98 0.005 250); }
.erp-grid tbody tr:hover td.erp-sticky           { background: oklch(0.96 0.03 240); }
```
Nas linhas coloridas por `data-situacao=…`, adicionar seletor equivalente para o `td.erp-sticky` manter o mesmo tom.

**JSX (Efetivos e Contratados):** para cada uma das 4 primeiras `<th>` / `<td>` / `<td>` de rodapé, adicionar:
```tsx
className="erp-sticky [erp-sticky-last quando for a 4ª]"
style={{ left: L[key], ...estiloAtual }}
```
`L` é o mapa já produzido por `frozenLeftMap(FROZEN)`. O array `FROZEN` de cada tela passa a listar exatamente as 4 colunas fixas com suas larguras já usadas hoje.

## Comportamento esperado
- Ao rolar horizontalmente, as 4 primeiras colunas ficam paradas no lado esquerdo.
- Sombra suave marca onde termina a área fixa e começa a área rolável.
- Nome do profissional continua clicável (só herda `position: sticky`, nada muda no handler).
- Hover, zebra e tint por situação continuam pintando corretamente as colunas fixas.
- Cabeçalho continua sticky no topo (comportamento atual) — combinado com o sticky lateral, o canto superior esquerdo trava nas duas direções.

## Validação
- Build + lint (colar saída real).
- Verificação visual: rolar horizontalmente em Efetivos e Contratados, redimensionar para largura de notebook (~1280px) e conferir que as 4 colunas ficam fixas e o restante rola.
- Confirmar que Piso Nacional (`/piso-enfermagem`) segue idêntico.
