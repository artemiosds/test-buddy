/**
 * Etapas de lembrete do prazo de envio das competências (módulo puro).
 * O prazo `prazo_envio` é uma data; o corte é 23:59:59 no horário de
 * Brasília (UTC-3) desse dia.
 */
export type EtapaPrazo = "3_dias" | "1_dia" | "1_hora" | "vencido";

const H = 3600_000;

export function corteDoPrazo(prazoEnvio: string): Date {
  return new Date(`${prazoEnvio}T23:59:59-03:00`);
}

export function etapaDoPrazo(prazoEnvio: string, agora: Date = new Date()): EtapaPrazo | null {
  const restante = corteDoPrazo(prazoEnvio).getTime() - agora.getTime();
  if (restante <= 0) return "vencido";
  if (restante <= H) return "1_hora";
  if (restante <= 24 * H) return "1_dia";
  if (restante <= 72 * H) return "3_dias";
  return null;
}

export function mensagemEtapa(etapa: EtapaPrazo, comp: string, prazoFmt: string) {
  switch (etapa) {
    case "3_dias":
      return {
        titulo: `Prazo de envio em 3 dias (${comp})`,
        mensagem: `A competência ${comp} encerra o envio das folhas em ${prazoFmt} às 23:59. Restam cerca de 3 dias.`,
        prioridade: "alta",
      };
    case "1_dia":
      return {
        titulo: `Falta 1 dia para o prazo de envio (${comp})`,
        mensagem: `Atenção: o envio das folhas da competência ${comp} encerra em ${prazoFmt} às 23:59. Resta menos de 1 dia.`,
        prioridade: "alta",
      };
    case "1_hora":
      return {
        titulo: `URGENTE: falta 1 hora para encerrar o envio (${comp})`,
        mensagem: `O prazo de envio da competência ${comp} encerra hoje (${prazoFmt}) às 23:59. Envie as folhas pendentes agora.`,
        prioridade: "urgente",
      };
    case "vencido":
      return {
        titulo: `Prazo vencido (${comp})`,
        mensagem: `O prazo de envio das folhas da competência ${comp} venceu em ${prazoFmt} às 23:59. Há pendências a conferir. O encerramento da competência depende de autorização manual do gestor.`,
        prioridade: "urgente",
      };
  }
}
