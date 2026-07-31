// =============================================================================
// APRENDIZADO POR MODELO DE REFERÊNCIA — server functions.
// Arquivo fino: só declarações de createServerFn (helpers em *.server.ts).
// =============================================================================

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensurePermission } from "./authz.server";
import {
  gerarCodigo,
  mapearComIA,
  mapearPorCatalogo,
  montarCampos,
  montarHints,
  persistirLayoutGerado,
} from "./layout-modelo.server";

const formulaSchema = z.object({
  coluna: z.string().trim().min(1).max(200),
  expressao: z.string().trim().max(400).default(""),
  constante: z.number().default(0),
  termos: z
    .array(z.object({ coluna: z.string().trim().min(1).max(200), fator: z.number() }))
    .max(40)
    .default([]),
});

export const gerarLayoutDeModelo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        nome: z.string().trim().min(2).max(120),
        descricao: z.string().trim().max(500).nullable().optional(),
        modulo: z.string().trim().max(40).default("piso"),
        tipo: z.string().trim().max(40).default("planilha"),
        nome_arquivo: z.string().trim().max(200).default(""),
        headers: z.array(z.string().max(200)).min(1).max(120),
        amostra: z.array(z.array(z.string().max(200)).max(120)).max(5).default([]),
        formulas: z.array(formulaSchema).max(60).default([]),
        usar_ia: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    await ensurePermission(supabase, context.userId, "configuracao.editar");

    const headers = data.headers.filter((h) => String(h).trim());
    const mapa = mapearPorCatalogo(headers);

    let erroIa: string | null = null;
    if (data.usar_ia) {
      const pendentes = headers.filter((h) => !mapa[h]);
      if (pendentes.length > 0) {
        const usados = new Set(Object.values(mapa).filter(Boolean) as string[]);
        const r = await mapearComIA(pendentes, data.amostra);
        erroIa = r.erro;
        for (const [h, campo] of Object.entries(r.mapa)) {
          if (usados.has(campo) || !(h in mapa) || mapa[h]) continue;
          mapa[h] = campo;
          usados.add(campo);
        }
      }
    }

    const campos = montarCampos(headers, mapa);
    if (campos.length === 0) throw new Error("Nenhum campo pôde ser identificado nesta planilha.");

    const hints = montarHints(data.nome_arquivo, headers);
    const salvo = await persistirLayoutGerado(supabase, context.userId, {
      codigo: gerarCodigo(data.nome),
      nome: data.nome,
      descricao: data.descricao ?? `Gerado automaticamente a partir de ${data.nome_arquivo || "planilha modelo"}.`,
      tipo: data.tipo,
      modulo: data.modulo,
      arquivo_hints: hints.arquivo_hints,
      header_hints: hints.header_hints,
      campos,
      formulasColuna: data.formulas,
      mapa,
      notas: "Layout aprendido de planilha modelo (IA).",
    });

    return {
      layout_id: salvo.layout_id,
      versao_id: salvo.versao_id,
      campos: campos.length,
      nao_mapeados: headers.filter((h) => !mapa[h]),
      regras: salvo.regras,
      erro_ia: erroIa,
    };
  });
