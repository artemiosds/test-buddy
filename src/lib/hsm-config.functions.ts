import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { HsmConfigPublica } from "./hsm/config";
import type { ToolCatalogItem } from "./hsm/tools.server";

export type { HsmConfigPublica } from "./hsm/config";
export type { ToolCatalogItem } from "./hsm/tools.server";

export const getHsmConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<HsmConfigPublica> => {
    const [{ data: master }, { data: permissoes }] = await Promise.all([
      context.supabase.rpc("is_master", { _user_id: context.userId }),
      context.supabase.rpc("get_my_permissions"),
    ]);
    const codigos = new Set<string>(((permissoes as string[]) ?? []).map(String));
    if (!master && !codigos.has("configuracao.editar") && !codigos.has("sistema.configurar")) {
      throw new Error("Sem permissão para visualizar a configuração do HSM Expert.");
    }

    const { carregarHsmConfig } = await import("./hsm/config.server");
    return carregarHsmConfig(context.supabase as never);
  });

export const listarCatalogoFerramentasHSM = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ToolCatalogItem[]> => {
    const [{ data: master }, { data: permissoes }] = await Promise.all([
      context.supabase.rpc("is_master", { _user_id: context.userId }),
      context.supabase.rpc("get_my_permissions"),
    ]);
    const codigos = new Set<string>(((permissoes as string[]) ?? []).map(String));
    if (!master && !codigos.has("configuracao.editar") && !codigos.has("sistema.configurar")) {
      throw new Error("Sem permissão para visualizar o catálogo do HSM Expert.");
    }

    const { catalogoPublico } = await import("./hsm/tools.server");
    return catalogoPublico();
  });

export const salvarHsmConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        ativo: z.boolean(),
        somente_leitura: z.boolean(),
        prompt_sistema: z.string().trim().min(40).max(5000),
        modo_execucao: z.enum(["assistido", "somente_leitura", "autonomo_controlado"]),
        ferramentas_habilitadas: z.array(z.string().trim().min(1).max(80)).max(100),
        agentes_habilitados: z.array(z.string().trim().min(1).max(80)).max(30),
        limites: z.object({
          mensagens_por_minuto: z.coerce.number().int().min(1).max(120),
          mensagens_por_dia: z.coerce.number().int().min(10).max(5000),
          ferramentas_por_mensagem: z.coerce.number().int().min(1).max(10),
          tempo_maximo_ms: z.coerce.number().int().min(10000).max(600000),
        }),
        cache_config: z.object({
          habilitado: z.boolean(),
          ttl_segundos: z.coerce.number().int().min(30).max(86400),
        }),
        retencao_config: z.object({
          mensagens_dias: z.coerce.number().int().min(1).max(3650),
          auditoria_dias: z.coerce.number().int().min(30).max(3650),
        }),
        observabilidade_config: z.object({
          registrar_erros: z.boolean(),
          registrar_tentativas: z.boolean(),
          registrar_ferramentas: z.boolean(),
        }),
        metadata: z.record(z.string(), z.any()).default({}),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<HsmConfigPublica> => {
    const { data: cfg, error } = await (context.supabase as never as {
      rpc: (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message: string } | null }>;
    }).rpc("hsm_config_salvar", {
      _ativo: data.ativo,
      _somente_leitura: data.somente_leitura || data.modo_execucao === "somente_leitura",
      _prompt_sistema: data.prompt_sistema,
      _modo_execucao: data.modo_execucao,
      _ferramentas_habilitadas: data.ferramentas_habilitadas,
      _agentes_habilitados: data.agentes_habilitados,
      _limites: data.limites,
      _cache_config: data.cache_config,
      _retencao_config: data.retencao_config,
      _observabilidade_config: data.observabilidade_config,
      _metadata: data.metadata,
    });
    if (error) throw new Error(error.message);

    const { normalizarHsmConfig } = await import("./hsm/config.server");
    // Invalida a memoização curta usada pelo assistente para responder mais rápido.
    const { limparMemo } = await import("./hsm/memo.server");
    limparMemo("hsm:");
    return normalizarHsmConfig(cfg);

  });

/** Fase 7 — painel de estatísticas do HSM Expert (somente Master). */
export const getHsmEstatisticas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ dias: z.coerce.number().int().min(1).max(180).default(30) }).parse(d ?? {}),
  )
  .handler(async ({ data, context }): Promise<any> => {
    const { data: stats, error } = await (context.supabase as never as {
      rpc: (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message: string } | null }>;
    }).rpc("hsm_estatisticas", { _dias: data.dias });
    if (error) throw new Error(error.message);
    return (stats ?? {}) as any;
  });
