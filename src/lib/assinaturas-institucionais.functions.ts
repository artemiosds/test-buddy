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
  .inputValidator((d: unknown) => hashSchema.parse(d))
  .handler(async ({ data }) => {
    // Gerar um hash único baseado nos dados e num salt
    const salt = process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 10) || "hsm-gestao-salt";
    const source = `${data.usuario_id}|${data.nome}|${data.timestamp}|${salt}`;
    const hash = createHash("sha256").update(source).digest("hex").toUpperCase().slice(0, 16);
    
    // Formatar como XXXX-XXXX-XXXX-XXXX
    const formattedHash = hash.match(/.{1,4}/g)?.join("-") || hash;
    
    return { hash: formattedHash };
  });

// Schema for signature saving
const saveSchema = z.object({
  usuario_id: z.string().uuid({ message: "O ID do usuário deve ser um UUID válido." }),
  perfil_id: z.string().uuid({ message: "O ID do perfil deve ser um UUID válido." }).nullable().optional(),
  unidade_id: z.string().uuid({ message: "O ID da unidade deve ser um UUID válido." }).nullable().optional(),
  secretaria_id: z.string().uuid({ message: "O ID da secretaria deve ser um UUID válido." }).nullable().optional(),
  titular_nome: z.string().min(1, "Nome do titular é obrigatório"),
  titular_cargo: z.string().nullable().optional(),
  hash: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  storage_path: z.string().min(1, "Path do arquivo é obrigatório"),
  mime_type: z.string().optional(),
  is_pessoal: z.boolean().default(false),
  tipo: z.enum(["assinatura", "carimbo", "logo"]).default("assinatura"),
  ativa: z.boolean().default(true),
  posicao_x: z.number().nullable().optional(),
  posicao_y: z.number().nullable().optional(),
  tamanho_percentual: z.number().nullable().optional(),
  alinhamento: z.string().nullable().optional(),
  mostrar_nome: z.boolean().nullable().optional(),
  mostrar_cargo: z.boolean().nullable().optional(),
  tipos_documento: z.array(z.string()).optional(),
  obrigatoria: z.boolean().optional(),
  ordem: z.number().optional(),
  vigencia_inicio: z.string().nullable().optional(),
  vigencia_fim: z.string().nullable().optional(),
});

export const saveInstitutionalSignature = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => saveSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    // Barreira de segurança contra paths em campos UUID
    const fieldsToSanitize = ['usuario_id', 'perfil_id', 'unidade_id', 'secretaria_id'] as const;
    for (const field of fieldsToSanitize) {
      const val = data[field];
      if (val && (String(val).includes('.') || String(val).includes('/') || String(val).includes('-'))) {
        // Se contém hífen mas não é um UUID válido, ou contém . ou /
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(val));
        if (!isUUID) {
          console.error(`[SERVER-BLOCK] Tentativa de salvar valor malformado no campo UUID ${field}:`, val);
          throw new Error(`O campo ${field} deve ser um UUID válido.`);
        }
      }
    }

    const payload = {
      tipo: data.tipo,
      usuario_id: data.usuario_id,
      perfil_id: data.perfil_id,
      unidade_id: data.unidade_id,
      secretaria_id: data.secretaria_id,
      titular_nome: data.titular_nome,
      titular_cargo: data.titular_cargo,
      is_pessoal: data.is_pessoal,
      ativa: data.ativa,
      metadata: {
        ...(data.metadata || {}),
        institutional_hash: data.hash || null,
        generated_at: new Date().toISOString(),
        method: data.hash ? "institutional_electronic" : "standard"
      },
      storage_path: data.storage_path,
      mime_type: data.mime_type || "image/png",
      posicao_x: data.posicao_x,
      posicao_y: data.posicao_y,
      tamanho_percentual: data.tamanho_percentual,
      alinhamento: data.alinhamento,
      mostrar_nome: data.mostrar_nome,
      mostrar_cargo: data.mostrar_cargo,
      tipos_documento: data.tipos_documento,
      obrigatoria: data.obrigatoria,
      ordem: data.ordem,
      vigencia_inicio: data.vigencia_inicio,
      vigencia_fim: data.vigencia_fim
    };

    const { error } = await supabaseAdmin
      .from("assinaturas_institucionais")
      .insert(payload as any);

    if (error) {
      console.error("[SERVER ERROR] INSERT assinaturas_institucionais:", error);
      throw error;
    }
    
    return { success: true };
  });
