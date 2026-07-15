import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

// Worker de Eventos de Domínio
// -----------------------------------------------------------------------------
// Consome a fila `public.eventos_dominio` em lote.
// - claim_eventos_dominio: pega N eventos pendentes/retry (SKIP LOCKED)
// - dispatch por `tipo`: chama handlers idempotentes
// - ack_evento_dominio em sucesso; nack_evento_dominio (backoff exponencial) em falha
//
// Publica em /api/public/hooks/eventos-worker (chamado por pg_cron a cada minuto).
// Autenticação: header `apikey` deve ser a anon key (ou o SERVICE_ROLE_KEY para uso interno).

type EventoDominio = {
  id: string;
  tipo: string;
  agregado: string;
  agregado_id: string | null;
  dados: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  correlation_id: string | null;
  causation_id: string | null;
  tentativas: number | null;
};

// ---- Dispatcher --------------------------------------------------------------
// Cada handler é idempotente. Retorna void em sucesso; lança erro em falha.
// Handlers reais (notificações, e-mail, integrações) serão plugados nas etapas
// seguintes do roadmap. Por enquanto, apenas roteamos os tipos conhecidos.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supa = any;

type NotifTipo =
  | "info" | "sucesso" | "alerta" | "erro"
  | "pendencia" | "aprovacao" | "sistema";
type NotifPrioridade = "baixa" | "normal" | "alta" | "urgente";

async function notificar(
  supa: Supa,
  destinatarios: Array<string | null | undefined>,
  input: {
    titulo: string;
    mensagem: string;
    tipo: NotifTipo;
    prioridade?: NotifPrioridade;
    link?: string | null;
    entidade_tipo?: string | null;
    entidade_id?: string | null;
    metadata?: Record<string, unknown>;
    evento_id?: string;
  },
): Promise<void> {
  const ids = Array.from(
    new Set(destinatarios.filter((x): x is string => !!x)),
  );
  if (ids.length === 0) return;

  const rows = ids.map((uid) => ({
    usuario_id: uid,
    titulo: input.titulo,
    mensagem: input.mensagem,
    tipo: input.tipo,
    prioridade: input.prioridade ?? "normal",
    canal: "in_app" as const,
    link: input.link ?? null,
    entidade_tipo: input.entidade_tipo ?? null,
    entidade_id: input.entidade_id ?? null,
    metadata: {
      ...(input.metadata ?? {}),
      ...(input.evento_id ? { evento_id: input.evento_id } : {}),
    },
  }));

  // Idempotência simples: se já existe notificação para este evento+usuário, ignora.
  if (input.evento_id) {
    const { data: existentes } = await supa
      .from("notificacoes")
      .select("usuario_id")
      .in("usuario_id", ids)
      .contains("metadata", { evento_id: input.evento_id });
    const jaTem = new Set(
      ((existentes ?? []) as Array<{ usuario_id: string }>).map((r) => r.usuario_id),
    );
    const filtradas = rows.filter((r) => !jaTem.has(r.usuario_id));
    if (filtradas.length === 0) return;
    await supa.from("notificacoes").insert(filtradas);
    return;
  }
  await supa.from("notificacoes").insert(rows);
}

async function loadPendencia(supa: Supa, id: string) {
  const { data } = await supa
    .from("pendencias")
    .select("id, numero, titulo, prioridade, status, responsavel_id, created_by, unidade_id, secretaria_id, prazo")
    .eq("id", id)
    .maybeSingle();
  return data as null | {
    id: string; numero: string; titulo: string;
    prioridade: string; status: string;
    responsavel_id: string | null; created_by: string | null;
    unidade_id: string | null; secretaria_id: string | null;
    prazo: string | null;
  };
}

function prioridadeMap(p: string | null): NotifPrioridade {
  if (p === "urgente") return "urgente";
  if (p === "alta") return "alta";
  if (p === "baixa") return "baixa";
  return "normal";
}

async function handlePendencia(supa: Supa, ev: EventoDominio): Promise<void> {
  if (!ev.agregado_id) return;
  const p = await loadPendencia(supa, ev.agregado_id);
  if (!p) return;
  const link = `/pendencias?id=${p.id}`;
  const base = {
    tipo: "pendencia" as NotifTipo,
    prioridade: prioridadeMap(p.prioridade),
    link,
    entidade_tipo: "pendencia",
    entidade_id: p.id,
    metadata: { numero: p.numero },
    evento_id: ev.id,
  };
  const dados = (ev.dados ?? {}) as Record<string, unknown>;

  switch (ev.tipo) {
    case "pendencia.criada":
      await notificar(supa, [p.responsavel_id, p.created_by], {
        ...base,
        titulo: `Nova pendência ${p.numero}`,
        mensagem: p.titulo,
      });
      return;
    case "pendencia.atribuida":
      await notificar(supa, [(dados.responsavel_id as string) ?? p.responsavel_id], {
        ...base,
        titulo: `Pendência ${p.numero} atribuída a você`,
        mensagem: p.titulo,
      });
      return;
    case "pendencia.respondida":
      await notificar(supa, [p.created_by], {
        ...base,
        tipo: "info",
        titulo: `Resposta em ${p.numero}`,
        mensagem: p.titulo,
      });
      return;
    case "pendencia.resolvida":
      await notificar(supa, [p.created_by, p.responsavel_id], {
        ...base,
        tipo: "sucesso",
        titulo: `Pendência ${p.numero} resolvida`,
        mensagem: p.titulo,
      });
      return;
    case "pendencia.reaberta":
      await notificar(supa, [p.responsavel_id, p.created_by], {
        ...base,
        tipo: "alerta",
        titulo: `Pendência ${p.numero} reaberta`,
        mensagem: p.titulo,
      });
      return;
    case "pendencia.cancelada":
      await notificar(supa, [p.responsavel_id, p.created_by], {
        ...base,
        tipo: "info",
        titulo: `Pendência ${p.numero} cancelada`,
        mensagem: p.titulo,
      });
      return;
    case "pendencia.prioridade_alterada":
      await notificar(supa, [p.responsavel_id, p.created_by], {
        ...base,
        tipo: "alerta",
        titulo: `Prioridade alterada — ${p.numero}`,
        mensagem: `Nova prioridade: ${p.prioridade}`,
      });
      return;
    case "pendencia.prazo_alterado":
      await notificar(supa, [p.responsavel_id, p.created_by], {
        ...base,
        tipo: "info",
        titulo: `Prazo alterado — ${p.numero}`,
        mensagem: p.prazo ? `Novo prazo: ${p.prazo}` : p.titulo,
      });
      return;
    case "pendencia.prazo_vencido":
      await notificar(supa, [p.responsavel_id, p.created_by], {
        ...base,
        tipo: "erro",
        prioridade: "urgente",
        titulo: `Prazo vencido — ${p.numero}`,
        mensagem: p.titulo,
      });
      return;
    case "pendencia.prazo_proximo":
      await notificar(supa, [p.responsavel_id, p.created_by], {
        ...base,
        tipo: "alerta",
        prioridade: "alta",
        titulo: `Prazo próximo (24h) — ${p.numero}`,
        mensagem: p.titulo,
      });
      return;
    case "pendencia.escalonada": {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = (ev.dados ?? {}) as any;
      await notificar(supa, [p.responsavel_id, p.created_by], {
        ...base,
        tipo: "alerta",
        prioridade: "urgente",
        titulo: `Pendência escalonada — ${p.numero}`,
        mensagem: `Prioridade elevada de ${d.de ?? "?"} para ${d.para ?? "?"} por SLA vencido.`,
      });
      return;
    }
  }
}

async function handleCompetencia(supa: Supa, ev: EventoDominio): Promise<void> {
  if (!ev.agregado_id) return;
  const { data: cu } = await supa
    .from("competencia_unidades")
    .select("id, responsavel_id, unidade_id, competencia_id, unidades(nome), competencias(mes, ano)")
    .eq("id", ev.agregado_id)
    .maybeSingle();
  if (!cu) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const unidade = (cu as any).unidades?.nome ?? "Unidade";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = (cu as any).competencias ?? {};
  const label = c.mes && c.ano ? `${String(c.mes).padStart(2, "0")}/${c.ano}` : "";
  const link = `/competencias/${cu.competencia_id}`;
  const meta = {
    link,
    entidade_tipo: "competencia_unidade",
    entidade_id: cu.id,
    evento_id: ev.id,
  };

  switch (ev.tipo) {
    case "competencia.aprovada":
      await notificar(supa, [cu.responsavel_id], {
        titulo: `Competência ${label} aprovada`,
        mensagem: `${unidade}: folha aprovada.`,
        tipo: "sucesso", prioridade: "normal", ...meta,
      });
      return;
    case "competencia.rejeitada":
      await notificar(supa, [cu.responsavel_id], {
        titulo: `Competência ${label} rejeitada`,
        mensagem: `${unidade}: folha rejeitada.`,
        tipo: "erro", prioridade: "alta", ...meta,
      });
      return;
    default:
      return;
  }
}

async function handleEvent(supa: Supa, ev: EventoDominio): Promise<void> {
  if (ev.tipo.startsWith("pendencia.")) {
    await handlePendencia(supa, ev);
    return;
  }
  if (ev.tipo.startsWith("competencia.") || ev.tipo.startsWith("frequencia.")) {
    await handleCompetencia(supa, ev);
    return;
  }
  // documento.*, sistema.*, e outros: apenas ack por ora.
  return;
}

// ---- Route -------------------------------------------------------------------

export const Route = createFileRoute("/api/public/hooks/eventos-worker")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const url = process.env.SUPABASE_URL;
        const key =
          process.env.SUPABASE_SERVICE_ROLE_KEY ||
          process.env.SERVICE_ROLE_KEY;
        const anon = process.env.SUPABASE_PUBLISHABLE_KEY;

        // Autenticação mínima: apikey deve ser anon ou service_role
        const provided = request.headers.get("apikey");
        if (!provided || (provided !== anon && provided !== key)) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        if (!url || !key) {
          return new Response(
            JSON.stringify({ error: "missing supabase env" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }

        let batchSize = 25;
        try {
          const body = (await request.json().catch(() => null)) as
            | { batch?: number }
            | null;
          if (body?.batch && Number.isFinite(body.batch)) {
            batchSize = Math.max(1, Math.min(100, Math.floor(body.batch)));
          }
        } catch {
          // ignore malformed body
        }

        const supa = createClient(url, key, {
          auth: { autoRefreshToken: false, persistSession: false },
        });

        const workerId = `edge-${Math.random().toString(36).slice(2, 10)}`;

        // 1) Claim
        const { data: claimed, error: claimErr } = await supa.rpc(
          "claim_eventos_dominio",
          { _qtd: batchSize, _worker: workerId },
        );

        if (claimErr) {
          return new Response(
            JSON.stringify({ error: "claim_failed", detail: claimErr.message }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }

        const eventos = (claimed ?? []) as EventoDominio[];
        let ok = 0;
        let fail = 0;
        const erros: Array<{ id: string; erro: string }> = [];

        for (const ev of eventos) {
          try {
            await handleEvent(supa, ev);
            await supa.rpc("ack_evento_dominio", { _id: ev.id });
            ok++;
          } catch (err) {
            const msg =
              err instanceof Error ? err.message : "erro desconhecido";
            await supa.rpc("nack_evento_dominio", {
              _id: ev.id,
              _erro: msg.slice(0, 500),
            });
            fail++;
            erros.push({ id: ev.id, erro: msg });
          }
        }

        return new Response(
          JSON.stringify({
            ok: true,
            worker_id: workerId,
            processados: ok,
            falhas: fail,
            total: eventos.length,
            erros: erros.slice(0, 5),
            timestamp: new Date().toISOString(),
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
} as any);
