/**
 * Renderizador Markdown seguro do HSM Expert.
 *
 * Não usa `dangerouslySetInnerHTML` em momento algum: todo o conteúdo vindo do
 * modelo é convertido em elementos React (texto puro), portanto não há
 * superfície para injeção de HTML/script.
 */

import { Fragment, type ReactNode } from "react";

function inline(texto: string, chave: string): ReactNode[] {
  const partes: ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let ultimo = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = regex.exec(texto))) {
    if (m.index > ultimo) partes.push(texto.slice(ultimo, m.index));
    const t = m[0];
    const k = `${chave}-${i++}`;
    if (t.startsWith("**")) partes.push(<strong key={k}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith("`"))
      partes.push(
        <code key={k} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
          {t.slice(1, -1)}
        </code>,
      );
    else if (t.startsWith("[")) {
      const rotulo = t.slice(1, t.indexOf("]"));
      const href = t.slice(t.indexOf("(") + 1, -1);
      const interno = href.startsWith("/");
      partes.push(
        interno ? (
          <a key={k} href={href} className="text-primary underline underline-offset-2">
            {rotulo}
          </a>
        ) : (
          <span key={k} className="text-muted-foreground">
            {rotulo}
          </span>
        ),
      );
    } else partes.push(<em key={k}>{t.slice(1, -1)}</em>);
    ultimo = m.index + t.length;
  }
  if (ultimo < texto.length) partes.push(texto.slice(ultimo));
  return partes;
}

function celulas(linha: string): string[] {
  return linha
    .replace(/^\s*\|/, "")
    .replace(/\|\s*$/, "")
    .split("|")
    .map((c) => c.trim());
}

export function Markdown({ texto }: { texto: string }) {
  const linhas = texto.replace(/\r/g, "").split("\n");
  const blocos: ReactNode[] = [];
  let i = 0;

  while (i < linhas.length) {
    const l = linhas[i];

    // Bloco de código
    if (l.trim().startsWith("```")) {
      const buffer: string[] = [];
      i++;
      while (i < linhas.length && !linhas[i].trim().startsWith("```")) buffer.push(linhas[i++]);
      i++;
      blocos.push(
        <pre
          key={`c${i}`}
          className="overflow-x-auto rounded-lg border bg-muted/60 p-3 text-xs leading-relaxed"
        >
          <code>{buffer.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    // Tabela
    if (l.trim().startsWith("|") && linhas[i + 1]?.includes("--")) {
      const cabecalho = celulas(l);
      i += 2;
      const corpo: string[][] = [];
      while (i < linhas.length && linhas[i].trim().startsWith("|")) corpo.push(celulas(linhas[i++]));
      blocos.push(
        <div key={`t${i}`} className="overflow-x-auto rounded-lg border">
          <table className="w-full text-xs">
            <thead className="bg-muted/60">
              <tr>
                {cabecalho.map((c, n) => (
                  <th key={n} className="px-2 py-1.5 text-left font-semibold">
                    {inline(c, `h${n}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {corpo.map((linha, n) => (
                <tr key={n} className={n % 2 ? "bg-muted/25" : undefined}>
                  {linha.map((c, j) => (
                    <td key={j} className="px-2 py-1.5 align-top">
                      {inline(c, `b${n}-${j}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    // Títulos
    const h = /^(#{1,4})\s+(.*)$/.exec(l);
    if (h) {
      const nivel = h[1].length;
      blocos.push(
        <p
          key={`h${i}`}
          className={
            nivel <= 2
              ? "text-sm font-semibold text-foreground"
              : "text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          }
        >
          {inline(h[2], `t${i}`)}
        </p>,
      );
      i++;
      continue;
    }

    // Listas
    if (/^\s*([-*]|\d+\.)\s+/.test(l)) {
      const itens: string[] = [];
      const ordenada = /^\s*\d+\./.test(l);
      while (i < linhas.length && /^\s*([-*]|\d+\.)\s+/.test(linhas[i])) {
        itens.push(linhas[i].replace(/^\s*([-*]|\d+\.)\s+/, ""));
        i++;
      }
      const Lista = ordenada ? "ol" : "ul";
      blocos.push(
        <Lista
          key={`l${i}`}
          className={`ml-4 space-y-1 ${ordenada ? "list-decimal" : "list-disc"}`}
        >
          {itens.map((it, n) => (
            <li key={n}>{inline(it, `i${i}-${n}`)}</li>
          ))}
        </Lista>,
      );
      continue;
    }

    if (!l.trim()) {
      i++;
      continue;
    }

    const paragrafo: string[] = [];
    while (i < linhas.length && linhas[i].trim() && !/^\s*([-*#>|`]|\d+\.)/.test(linhas[i])) {
      paragrafo.push(linhas[i++]);
    }
    if (paragrafo.length === 0) {
      paragrafo.push(linhas[i++]);
    }
    blocos.push(
      <p key={`p${i}`} className="leading-relaxed">
        {inline(paragrafo.join(" "), `p${i}`)}
      </p>,
    );
  }

  return <div className="space-y-2 text-sm">{blocos.map((b, n) => (
    <Fragment key={n}>{b}</Fragment>
  ))}</div>;
}
