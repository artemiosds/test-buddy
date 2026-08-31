import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { enviarEmailsAviso } from "./mural-avisos.server";
import { logger } from "./logger";

export type ResultadoLembretes = {
  avisos_elegiveis: number;
  avisos_processados: number;
  emails_enviados: number;
  emails_falhos: number;
  detalhes: Array<{ aviso_id: string; titulo: string; enviados: number; falhas: number; motivo: string | null }>;
};

/**
 * Lembrete diário do mural: reenvia por e-mail os avisos urgentes ou fixados
 * que continuam ativos e dentro do prazo (data_inicio <= hoje <= data_fim).
 *
 * Idempotente por dia: destinatários que já receberam o mesmo assunto com
 * status "enviado" desde a meia-noite (UTC) são ignorados, então rodar a
 * rotina mais de uma vez no mesmo dia não duplica e-mails.
 */
export async function enviarLembretesDiariosMural(): Promise<ResultadoLembretes> {
  const hoje = new Date().toISOString().slice(0, 10);
  const inicioDoDia = `${hoje}T00:00:00.000Z`;

  const { data: avisos, error } = await supabaseAdmin
    .from("avisos_mural")
    .select("id, titulo, tipo, prioridade, fixado, data_inicio, data_fim, ativo")
    .eq("ativo", true)
    .lte("data_inicio", hoje)
    .or(`data_fim.is.null,data_fim.gte.${hoje}`);

  if (error) {
    logger.error("mural.lembretes.erro_busca", { error: error.message });
    return { avisos_elegiveis: 0, avisos_processados: 0, emails_enviados: 0, emails_falhos: 0, detalhes: [] };
  }

  const elegiveis = (avisos ?? []).filter(
    (a) => a.fixado === true || a.tipo === "urgente" || a.prioridade === "urgente" || a.prioridade === "alta",
  );

  const detalhes: ResultadoLembretes["detalhes"] = [];
  let enviados = 0;
  let falhos = 0;

  for (const aviso of elegiveis) {
    const res = await enviarEmailsAviso(aviso.id as string, { pularEnviadosDesde: inicioDoDia });
    enviados += res.enviados;
    falhos += res.falhas;
    detalhes.push({
      aviso_id: aviso.id as string,
      titulo: aviso.titulo as string,
      enviados: res.enviados,
      falhas: res.falhas,
      motivo: res.motivo,
    });
  }

  logger.info("mural.lembretes.diario", {
    avisos: elegiveis.length,
    enviados,
    falhos,
  });

  return {
    avisos_elegiveis: elegiveis.length,
    avisos_processados: detalhes.length,
    emails_enviados: enviados,
    emails_falhos: falhos,
    detalhes,
  };
}
