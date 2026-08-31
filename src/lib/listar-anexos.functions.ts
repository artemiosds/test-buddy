import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ACOES, ensurePermission } from "./authz.server";
import { assinarUrlDocumento, isCaminhoR2, objetoExisteR2 } from "./storage-r2.server";

const ListarAnexosSchema = z.object({
  entidade_id: z.string().uuid(),
  tipo_entidade: z.enum(["frequencia", "frequencia_submissao"]).default("frequencia"),
  subtipo: z.string().max(30).optional(),
  setor_id: z.string().uuid().optional(),
});

export const listarAnexosLinha = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: z.infer<typeof ListarAnexosSchema>) => ListarAnexosSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // O Master sempre pode ver, ou quem tem permissão de visualização na unidade/secretaria (via RLS da tabela documentos)
    
    let q = supabase
      .from("documentos")
      .select("id, nome, mime_type, tamanho_bytes, storage_path, created_at, created_by")
      .eq("tipo_entidade", data.tipo_entidade)
      .eq("entidade_id", data.entidade_id)
      .is("deleted_at", null);
      
    if (data.subtipo) q = q.eq("metadata->>folha", data.subtipo);
    if (data.setor_id) q = q.eq("metadata->>setor_id", data.setor_id);
    
    // Fallback para frequencia_profissional_id se for do tipo 'frequencia'
    if (data.tipo_entidade === 'frequencia') {
        // Se a query original não trouxer nada pelo entidade_id primário, 
        // tentamos pelo metadado que o modal de edição de linha usa.
        const { data: docsPri, error: err1 } = await q.order("created_at", { ascending: false });
        if (err1) throw new Error(err1.message);
        
        if (!docsPri || docsPri.length === 0) {
            const { data: docsSec, error: err2 } = await supabase
                .from("documentos")
                .select("id, nome, mime_type, tamanho_bytes, storage_path, created_at, created_by")
                .eq("tipo_entidade", "frequencia")
                .eq("metadata->>frequencia_profissional_id", data.entidade_id)
                .is("deleted_at", null)
                .order("created_at", { ascending: false });
            if (err2) throw new Error(err2.message);
            return await formatarAnexos(docsSec || [], supabase);
        }
        return await formatarAnexos(docsPri, supabase);
    }

    const { data: docs, error } = await q.order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return await formatarAnexos(docs || [], supabase);
  });

async function formatarAnexos(rows: any[], supabase: any) {
    const autores = new Map<string, string>();
    const ids = [...new Set(rows.map((d: any) => d.created_by).filter(Boolean))] as string[];
    if (ids.length) {
      const { data: us } = await supabase
        .from("usuarios")
        .select("id, nome_completo")
        .in("id", ids);
      for (const u of us ?? []) autores.set((u as any).id, (u as any).nome_completo);
    }

    const assinadas = await Promise.all(
      rows.map(async (d: any) => {
        const [url, existe] = await Promise.all([
          assinarUrlDocumento(supabase, d.storage_path),
          isCaminhoR2(d.storage_path) ? objetoExisteR2(d.storage_path) : Promise.resolve(true),
        ]);
        return {
          id: d.id as string,
          nome: d.nome as string,
          mime_type: (d.mime_type ?? null) as string | null,
          tamanho_bytes: Number(d.tamanho_bytes ?? 0),
          created_at: d.created_at as string,
          enviado_por: autores.get(d.created_by) ?? null,
          url: existe ? url : null,
          disponivel: existe,
        };
      }),
    );
    
    return { anexos: assinadas };
}
