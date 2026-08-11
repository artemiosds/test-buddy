import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHash } from "crypto";
import type { Database } from "@/integrations/supabase/types";

// Schema for hash generation
const hashSchema = z.object({
  usuario_id: z.string().uuid(),
  nome: z.string(),
  cargo: z.string().optional(),
  matricula: z.string().optional(),
  unidade: z.string().optional(),
  timestamp: z.string(),
});

export const generateInstitutionalHash = createServerFn({ method: "POST" })
  .validator((data: unknown) => hashSchema.parse(data))
  .handler(async ({ data }: any) => {
    // Usando destructuring com type cast manual para satisfazer o compilador
    const d = data as z.infer<typeof hashSchema>;
    // Gerar um hash único baseado nos dados e num salt
    const salt = process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 10) || "hsm-gestao-salt";
    const source = `${d.usuario_id}|${d.nome}|${d.timestamp}|${salt}`;
    const hash = createHash("sha256").update(source).digest("hex").toUpperCase().slice(0, 16);
    
    // Formatar como XXXX-XXXX-XXXX-XXXX
    const formattedHash = hash.match(/.{1,4}/g)?.join("-") || hash;
    
    return { hash: formattedHash };
  });

// Schema for signature saving
const saveSchema = z.object({
  usuario_id: z.string().uuid(),
  perfil_id: z.string().uuid().nullable(),
  unidade_id: z.string().uuid().nullable(),
  secretaria_id: z.string().uuid().nullable(),
  titular_nome: z.string(),
  titular_cargo: z.string().nullable(),
  hash: z.string(),
  metadata: z.record(z.any()),
});

export const saveInstitutionalSignature = createServerFn({ method: "POST" })
  .validator((data: unknown) => saveSchema.parse(data))
  .handler(async ({ data }: any) => {
    // Usando destructuring com type cast manual para satisfazer o compilador
    const d = data as z.infer<typeof saveSchema>;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    // Assegurar tipo correto para o campo 'tipo'
    const tipo: Database["public"]["Enums"]["tipo_assinatura"] = "assinatura";

    const payload = {
      tipo,
      usuario_id: d.usuario_id,
      perfil_id: d.perfil_id,
      unidade_id: d.unidade_id,
      secretaria_id: d.secretaria_id,
      titular_nome: d.titular_nome,
      titular_cargo: d.titular_cargo,
      is_pessoal: true,
      ativa: true,
      metadata: {
        ...d.metadata,
        institutional_hash: d.hash,
        generated_at: new Date().toISOString(),
        method: "institutional_electronic"
      },
      storage_path: `institutional_${d.hash}`,
      mime_type: "application/json"
    };

    const { error } = await supabaseAdmin
      .from("assinaturas_institucionais")
      .insert(payload as any);

    if (error) throw error;
    
    return { success: true };
  });
