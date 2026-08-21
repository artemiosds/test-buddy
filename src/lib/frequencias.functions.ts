import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ACOES, EVENTOS, ensurePermission, emitEvento } from "./authz.server";
import { orquestrarSincronizacao } from "./frequencia-sincronizacao.functions";
import { ANEXO_MIMES_ACEITOS, ANEXO_TAMANHO_MAX } from "./anexos-linha";
import { logger } from "./logger";
import { sendEmail, generateEmailTemplate } from "./email.server";
import { obterAssinaturaInstitucionalAtual } from "./pdf-pipeline";




const NUM = z.union([z.number(), z.string()]).default(0);

const LinhaSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  _new: z.boolean().optional(),
  _dirty: z.boolean().optional(),
  profissional_id: z.string().uuid(),
  dias_trabalhados: NUM,
  faltas_justificadas: NUM,
  faltas_injustificadas: NUM,
  ferias: NUM,
  licencas: NUM,
  afastamentos: NUM,
  horas_extras: NUM,
  plantoes_extras: NUM,
  adicional_noturno: NUM,
  atestado: NUM,
  he_50: NUM,
  he_100: NUM,
  sobreaviso: NUM,
  incentivo: NUM,
  licenca_premio: NUM,
  ferias_terco: NUM,
  ferias_integral: NUM,
  sal_sub_h: NUM,
  aulas_suplementares: NUM,
  observacoes: z.string().nullable().optional(),
});

const SalvarSchema = z.object({
  frequencia_id: z.string().uuid(),
  observacoes: z.string().nullable().optional(),
  linhas: z.array(LinhaSchema),
  ids_manter: z.array(z.string().uuid()),
});

const PAYLOAD_FIELDS = [
  "dias_trabalhados",
  "faltas_justificadas",
  "faltas_injustificadas",
  "ferias",
  "licencas",
  "afastamentos",
  "horas_extras",
  "plantoes_extras",
  "adicional_noturno",
  "atestado",
  "he_50",
  "he_100",
  "sobreaviso",
  "incentivo",
  "licenca_premio",
  "ferias_terco",
  "ferias_integral",
  "sal_sub_h",
  "aulas_suplementares",
  "observacoes",
] as const;

export const salvarLinhasFrequencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: z.infer<typeof SalvarSchema>) => SalvarSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensurePermission(supabase, userId, ACOES.FREQUENCIA_EDITAR);

    const dirty = data.linhas.filter((l) => l._dirty);
    
    // Validação de segurança: total de dias
    const { data: freqInfo } = await supabase
      .from("frequencias")
      .select("competencia_unidade_id, competencia_unidades(competencia_id, competencias(ano, mes))")
      .eq("id", data.frequencia_id)
      .single();
    
    const comp = (freqInfo?.competencia_unidades as any)?.competencias;
    if (comp) {
      const diasNoMes = new Date(Number(comp.ano), Number(comp.mes), 0).getDate();
      for (const l of dirty) {
        const total = Number(l.dias_trabalhados ?? 0) + Number(l.faltas_injustificadas ?? 0) + 
                     Number(l.faltas_justificadas ?? 0) + Number(l.atestado ?? 0) + 
                     Number(l.ferias ?? 0) + Number(l.licencas ?? 0) + Number(l.licenca_premio ?? 0);
        if (total > diasNoMes) {
          throw new Error(`O total de dias (${total}) para o profissional excede os ${diasNoMes} dias do mês.`);
        }
      }
    }

    const toInsert = dirty
      .filter((l) => l._new)
      .map((l) => {
        const row: Record<string, unknown> = {
          frequencia_id: data.frequencia_id,
          profissional_id: l.profissional_id,
          created_by: userId,
        };
        for (const f of PAYLOAD_FIELDS) row[f] = (l as any)[f];
        return row;
      });
    const toUpdate = dirty.filter((l) => !l._new && l.id);

    // Delete rows that existed but are no longer in the sheet
    const { data: existentes, error: exErr } = await supabase
      .from("frequencia_profissional")
      .select("id")
      .eq("frequencia_id", data.frequencia_id)
      .is("deleted_at", null);
    if (exErr) throw new Error(exErr.message);
    const kept = new Set(data.ids_manter);
    const toDelete = (existentes ?? []).map((r) => r.id).filter((eid) => !kept.has(eid));

    if (toInsert.length) {
      const { error } = await supabase.from("frequencia_profissional").insert(toInsert as never);
      if (error) throw new Error(error.message);
    }
    if (toUpdate.length) {
      const updates = toUpdate.map((l) => {
        const patch: Record<string, unknown> = { id: l.id!, updated_by: userId };
        for (const f of PAYLOAD_FIELDS) patch[f] = (l as any)[f];
        return patch;
      });

      const { error } = await supabase
        .from("frequencia_profissional")
        .upsert(updates as never);
      if (error) throw new Error(error.message);
    }
    if (toDelete.length) {
      const { error } = await supabase
        .from("frequencia_profissional")
        .update({ deleted_at: new Date().toISOString(), deleted_by: userId } as never)
        .in("id", toDelete);
      if (error) throw new Error(error.message);
    }
    const { error: fErr } = await supabase
      .from("frequencias")
      .update({ observacoes: data.observacoes ?? null, updated_by: userId } as never)
      .eq("id", data.frequencia_id);
    if (fErr) throw new Error(fErr.message);
    return { ok: true };
  });

const StatusEnum = z.enum([
  "rascunho",
  "enviada",
  "em_analise",
  "com_pendencias",
  "devolvida",
  "aprovada",
  "rejeitada",
  "arquivada",
]);

const AlterarStatusSchema = z.object({
  frequencia_id: z.string().uuid(),
  status: StatusEnum,
  observacoes: z.string().nullable().optional(),
  updated_at_check: z.string().nullable().optional(),
});

const PERM_STATUS: Record<string, string> = {
  enviada: ACOES.FREQUENCIA_ENVIAR,
  em_analise: ACOES.FREQUENCIA_ANALISAR,
  aprovada: ACOES.FREQUENCIA_APROVAR,
  rejeitada: ACOES.FREQUENCIA_REJEITAR,
  com_pendencias: ACOES.FREQUENCIA_REJEITAR,
  devolvida: ACOES.FREQUENCIA_REJEITAR,
  arquivada: ACOES.FREQUENCIA_ARQUIVAR,
  rascunho: ACOES.FREQUENCIA_REABRIR,
};

const EVENTO_STATUS: Record<string, string> = {
  enviada: EVENTOS.FREQUENCIA_ENVIADA,
  em_analise: EVENTOS.FREQUENCIA_EM_ANALISE,
  aprovada: EVENTOS.FREQUENCIA_APROVADA,
  rejeitada: EVENTOS.FREQUENCIA_REJEITADA,
  com_pendencias: EVENTOS.FREQUENCIA_COM_PENDENCIAS,
  devolvida: "frequencia.devolvida",
  arquivada: EVENTOS.FREQUENCIA_ARQUIVADA,
  rascunho: EVENTOS.FREQUENCIA_REABERTA,
};

const ACAO_LABEL: Record<string, string> = {
  enviada: "Envio para análise",
  em_analise: "Colocada em análise",
  aprovada: "Aprovação",
  com_pendencias: "Retorno com pendências",
  devolvida: "Devolvida para correção",
  rejeitada: "Rejeição",
  arquivada: "Arquivada",
  rascunho: "Reabertura",
};

export const alterarStatusFrequencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: z.infer<typeof AlterarStatusSchema>) => AlterarStatusSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const perm = PERM_STATUS[data.status];
    if (perm) await ensurePermission(supabase, userId, perm);

    // Recupera perfil para auditoria rica (usando 'nome' e 'codigo' como substituto de role)
    const { data: perfil } = await supabase
      .from("perfis")
      .select("nome, codigo")
      .eq("id", (context as any).user?.user_metadata?.perfil_id || "") // Assumindo que o perfil_id está no metadata
      .maybeSingle();

    const { data: freq, error: fErr } = await supabase
      .from("frequencias")
      .select(
        "id, tipo, status, updated_at, setor_id, competencia_unidade_id, competencia_unidades(competencia_id, unidades(id), competencias(prazo_envio))",
      )

      .eq("id", data.frequencia_id)
      .maybeSingle();
    if (fErr) throw new Error(fErr.message);
    if (!freq) throw new Error("Frequência não encontrada");
    const anterior = (freq as any).status;
    const updatedAt = (freq as any).updated_at;

    // Detectar alteração concorrente
    if (data.updated_at_check && updatedAt) {
      if (new Date(updatedAt).getTime() > new Date(data.updated_at_check).getTime()) {
        // Recarrega os dados para a orquestração e snapshot usar a versão do banco
        // Mas avisa o usuário
        console.warn(`[Concurrency] Frequência ${data.frequencia_id} alterada desde a abertura.`);
      }
    }

    // Guard: aprovar bloqueado se houver pendências
    if (data.status === "aprovada") {
      const { count } = await supabase
        .from("frequencia_pendencias")
        .select("id", { count: "exact", head: true })
        .eq("frequencia_id", data.frequencia_id)
        .in("status", ["aberta", "respondida"])
        .is("deleted_at", null);
      
      const { count: countLinhas } = await supabase
        .from("frequencia_pendencias_linhas")
        .select("id", { count: "exact", head: true })
        .eq("frequencia_id", data.frequencia_id)
        .eq("status", "aberta");

      if ((count ?? 0) > 0 || (countLinhas ?? 0) > 0) {
        throw new Error(`Existem ${(count ?? 0) + (countLinhas ?? 0)} pendência(s) não resolvida(s).`);
      }

      // Anti-duplicata
      const { data: fInfo } = await supabase
        .from("frequencias")
        .select("tipo, competencia_unidades(competencia_id)")
        .eq("id", data.frequencia_id)
        .single();
      
      if (fInfo?.tipo === "contratados") {
        const compId = (fInfo.competencia_unidades as any).competencia_id;
        const { data: profs } = await supabase
          .from("frequencias_contratados")
          .select("profissional_id, profissionais(nome_completo)")
          .eq("competencia_id", compId)
          .eq("unidade_id", (fInfo.competencia_unidades as any).unidade_id) // Adicionado segurança de unidade
          .eq("status", "rascunho"); // Apenas as que estamos tentando aprovar agora
        
        for (const p of profs || []) {
          const { data: duplicado } = await supabase.rpc("check_frequencia_duplicada", {
            _profissional_id: p.profissional_id,
            _competencia_id: compId
          });
          if (duplicado) {
            throw new Error(`Frequência duplicada! Profissional ${p.profissionais?.nome_completo} já tem frequência aprovada em outra unidade neste mês.`);
          }
        }
      }
    }

    // Se for aprovação, dispara a orquestração para garantir snapshot atômico ANTES de mudar o status final
    if (data.status === "aprovada") {
      const fInfo = freq as any;
      await orquestrarSincronizacao({
        data: {
          evento: "FOLHA_APROVADA",
          tipo: (fInfo.tipo || "contratados") as any,
          competencia_id: fInfo.competencia_unidades.competencia_id,
          unidade_id: fInfo.competencia_unidades.unidades.id,
          setor_id: fInfo.setor_id || undefined,
        }
      });
    }

    const patch: Record<string, unknown> = { status: data.status, updated_by: userId };
    if (data.status === "enviada") {
      patch.enviada_por = userId;
      patch.data_envio = new Date().toISOString();
    }
    if (data.status === "aprovada") {
      patch.aprovada_por = userId;
      patch.data_aprovacao = new Date().toISOString();
    }

    const { error: upErr } = await supabase
      .from("frequencias")
      .update(patch as never)
      .eq("id", data.frequencia_id);
    if (upErr) throw new Error(upErr.message);

    const label = ACAO_LABEL[data.status];
    if (label) {
      // --- CAPTURA DE SNAPSHOT DE ASSINATURA ---
      if (data.status === "enviada" || data.status === "aprovada") {
        try {
          const acaoSnapshot = data.status === "enviada" ? "enviar" : "aprovar";
          const tipoDoc = freq.tipo === "efetivos" ? "folha_efetivos" : "folha_contratados";
          
          // Busca a assinatura ativa para o usuário que está realizando a ação
          const assinatura = await obterAssinaturaInstitucionalAtual(tipoDoc as any, {
            unidadeId: (freq as any).competencia_unidades?.unidades?.id || null,
          });

          if (assinatura) {
            await supabase.from("frequencia_assinaturas_snapshot").upsert({
              frequencia_id: data.frequencia_id,
              acao: acaoSnapshot,
              usuario_id: userId,
              assinatura_id: assinatura.assinatura_id,
              storage_path: assinatura.storage_path,
              titular_nome: assinatura.titular_nome || "Não informado",
              titular_cargo: assinatura.titular_cargo,
              posicao_x: assinatura.posicao_x,
              posicao_y: assinatura.posicao_y,
              tamanho_percentual: assinatura.tamanho_percentual,
              alinhamento: assinatura.alinhamento,
              metadata: assinatura.metadata || {},
            } as never, { onConflict: 'frequencia_id, acao' });
          }
        } catch (snapErr) {
          logger.error("snapshot.capture.failed", { error: snapErr, frequencia_id: data.frequencia_id });
        }
      }
      // ------------------------------------------

      const prazoEnvio = (freq as any).competencia_unidades?.competencias?.prazo_envio;
      const foraPrazo =
        data.status === "enviada" &&
        !!prazoEnvio &&
        new Date() > new Date(prazoEnvio + "T23:59:59");
      
      const acaoFinal = foraPrazo ? `${label} (FORA DO PRAZO)` : label;

      await supabase.from("frequencia_historico").insert({
        frequencia_id: data.frequencia_id,
        status_anterior: anterior,
        status_novo: data.status,
        acao: acaoFinal,
        justificativa: data.observacoes ?? null,
        executado_por: userId,
        executado_nome: perfil?.nome || "Usuário HSM",
        executado_perfil: perfil?.codigo || "Indefinido",
      } as never);
    }


    const tipoEvento = EVENTO_STATUS[data.status];
    if (tipoEvento) {
      await emitEvento(supabase, tipoEvento, "frequencia", data.frequencia_id, {
        status_anterior: anterior,
        status_novo: data.status,
      });

      // Disparo de e-mails via SMTP
      // -----------------------------------------------------------------------
      try {
        const { data: details } = await supabase
          .from("frequencias")
          .select(`
            tipo,
            unidades(nome, gestor_email),
            competencias(mes, ano),
            perfis!frequencias_created_by_fkey(user_id, nome, user_email)
          `)
          .eq("id", data.frequencia_id)
          .maybeSingle();

        if (details) {
          const det = details as any;
          const gestorEmail = (det.unidades as any)?.email_institucional;
          const solicitanteEmail = det.perfis?.user_email;
          const unidadeNome = det.unidades?.nome || "Unidade não identificada";
          const competenciaStr = `${det.competencias?.mes}/${det.competencias?.ano}`;
          const baseUrl = process.env.VITE_APP_URL || "http://localhost:8080";

          // 1. Submissão (pendente/enviada) -> Notifica Gestor
          if (data.status === "enviada" && gestorEmail) {
            const html = generateEmailTemplate({
              title: "Nova Folha para Aprovação",
              message: `Uma nova folha de frequência da unidade ${unidadeNome} foi enviada e aguarda sua análise.`,
              ctaLabel: "Analisar Agora",
              ctaUrl: `${baseUrl}/aprovacoes`,
              details: [
                { label: "Unidade", value: unidadeNome },
                { label: "Competência", value: competenciaStr },
                { label: "Tipo", value: det.tipo },
              ],
            });
            await sendEmail({
              to: gestorEmail,
              subject: `[Aprovação] Nova Folha: ${unidadeNome} - ${competenciaStr}`,
              html,
            });
          }

          // 2. Aprovação -> Notifica Solicitante
          if (data.status === "aprovada" && solicitanteEmail) {
            const html = generateEmailTemplate({
              title: "Folha Aprovada",
              message: `A folha de frequência da unidade ${unidadeNome} foi aprovada com sucesso.`,
              ctaLabel: "Ver Detalhes",
              ctaUrl: `${baseUrl}/aprovacoes`,
              details: [
                { label: "Unidade", value: unidadeNome },
                { label: "Competência", value: competenciaStr },
                { label: "Status", value: "Aprovada" },
              ],
            });
            await sendEmail({
              to: solicitanteEmail,
              subject: `[Confirmação] Folha Aprovada: ${unidadeNome} - ${competenciaStr}`,
              html,
            });
          }

          // 3. Devolução/Rejeição -> Notifica Solicitante com Justificativa
          if (["rejeitada", "com_pendencias", "devolvida"].includes(data.status) && solicitanteEmail) {
            const statusLabel = data.status === "rejeitada" ? "Rejeitada" : "Devolvida para Ajustes";
            const html = generateEmailTemplate({
              title: `Folha ${statusLabel}`,
              message: `A folha de frequência da unidade ${unidadeNome} foi ${statusLabel.toLowerCase()}. Por favor, verifique a justificativa abaixo e providencie os ajustes necessários.`,
              ctaLabel: "Ajustar Folha",
              ctaUrl: `${baseUrl}/aprovacoes`,
              details: [
                { label: "Unidade", value: unidadeNome },
                { label: "Competência", value: competenciaStr },
                { label: "Justificativa", value: data.observacoes || "Nenhuma justificativa informada." },
              ],
            });
            await sendEmail({
              to: solicitanteEmail,
              subject: `[Ação Necessária] Folha ${statusLabel}: ${unidadeNome} - ${competenciaStr}`,
              html,
            });
          }
        }
      } catch (emailErr) {
        logger.error("email.trigger.failed", { error: emailErr, frequencia_id: data.frequencia_id });
      }
    }
    return { ok: true };
  });


const PendenciaSchema = z.object({
  frequencia_id: z.string().uuid(),
  frequencia_profissional_id: z.string().uuid(),
  titulo: z.string().min(1).max(200),
  descricao: z.string().max(2000).optional().default(""),
});

export const abrirPendenciaLinha = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: z.infer<typeof PendenciaSchema>) => PendenciaSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensurePermission(supabase, userId, ACOES.PENDENCIA_CRIAR);
    const { data: inserted, error } = await supabase
      .from("frequencia_pendencias")
      .insert({
        frequencia_id: data.frequencia_id,
        frequencia_profissional_id: data.frequencia_profissional_id,
        titulo: data.titulo,
        descricao: data.descricao,
        status: "aberta",
        aberta_por: userId,
        created_by: userId,
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    // Marca a frequência como com_pendencias se estava enviada/em_analise
    const { data: freq } = await supabase
      .from("frequencias")
      .select("status")
      .eq("id", data.frequencia_id)
      .maybeSingle();
    const st = (freq as any)?.status;
    if (st === "enviada" || st === "em_analise") {
      await supabase
        .from("frequencias")
        .update({ status: "com_pendencias", updated_by: userId } as never)
        .eq("id", data.frequencia_id);
      await emitEvento(
        supabase,
        EVENTOS.FREQUENCIA_COM_PENDENCIAS,
        "frequencia",
        data.frequencia_id,
        {
          motivo: "pendencia_aberta",
        },
      );
    }
    await emitEvento(
      supabase,
      EVENTOS.PENDENCIA_CRIADA,
      "pendencia",
      (inserted as any)?.id ?? null,
      {
        frequencia_id: data.frequencia_id,
        frequencia_profissional_id: data.frequencia_profissional_id,
        titulo: data.titulo,
      },
    );
    return { ok: true };
  });

const AutoInsertSchema = z.object({
  frequencia_id: z.string().uuid(),
  profissional_ids: z.array(z.string().uuid()).min(1),
});

export const inserirLinhasAuto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: z.infer<typeof AutoInsertSchema>) => AutoInsertSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensurePermission(supabase, userId, ACOES.FREQUENCIA_EDITAR);
    // Idempotente: ignora profissionais já presentes e reativa linhas removidas
    // (a constraint única não considera `deleted_at`).
    const { data: existentes, error: exErr } = await supabase
      .from("frequencia_profissional")
      .select("id, profissional_id, deleted_at")
      .eq("frequencia_id", data.frequencia_id)
      .in("profissional_id", data.profissional_ids);
    if (exErr) throw new Error(exErr.message);

    const jaAtivos = new Set(
      (existentes ?? []).filter((r: any) => !r.deleted_at).map((r: any) => r.profissional_id),
    );
    const paraReativar = (existentes ?? [])
      .filter((r: any) => r.deleted_at)
      .map((r: any) => r.id as string);

    if (paraReativar.length) {
      const { error } = await supabase
        .from("frequencia_profissional")
        .update({ deleted_at: null, deleted_by: null, updated_by: userId } as never)
        .in("id", paraReativar);
      if (error) throw new Error(error.message);
    }

    const existentesIds = new Set([
      ...jaAtivos,
      ...(existentes ?? []).filter((r: any) => r.deleted_at).map((r: any) => r.profissional_id),
    ]);

    const { data: profsStatus } = await supabase
      .from("profissionais")
      .select("id, status")
      .in("id", data.profissional_ids);

    const rows = data.profissional_ids
      .filter((pid) => !existentesIds.has(pid))
      .map((pid) => {
        const p = profsStatus?.find(x => x.id === pid);
        const status = p?.status?.toLowerCase();
        let val: number | string = 0;
        
        if (status === "ferias") val = "Férias";
        else if (status === "licenca_premio") val = "Licença Prêmio";
        else if (status === "licenca_maternidade") val = "Licença Maternidade";
        else if (status === "licenca_saude") val = "Licença Saúde";
        else if (status === "licenca_sem_vencimento") val = "Licença sem Vencimento";
        else if (status === "licenca_estudo") val = "Licença Estudo";
        else if (status?.includes("licenca")) val = "Licença";
        else if (status === "afastado" || status === "afastamento_inss") val = "Afastamento por INSS";
        else if (status === "atestado") val = "Atestado";
        else if (status === "falta_pad") val = "Falta informada ao RH (PAD)";
        else if (status === "vacancia") val = "Vacância";
        else if (status === "cedido") val = "Cedido";

        return {
          frequencia_id: data.frequencia_id,
          profissional_id: pid,
          created_by: userId,
          dias_trabalhados: val,
          faltas_justificadas: val,
          faltas_injustificadas: val,
          ferias: val,
          licencas: val,
          afastamentos: val,
          horas_extras: val,
          plantoes_extras: val,
          adicional_noturno: val,
          atestado: val,
          he_50: val,
          he_100: val,
          sobreaviso: val,
          incentivo: val,
        };
      });

    if (rows.length) {
      const { error } = await supabase.from("frequencia_profissional").insert(rows as never);
      if (error) throw new Error(error.message);
    }
    return { ok: true, inseridos: rows.length, reativados: paraReativar.length };
  });

/** Tipos e limite aceitos vêm de `@/lib/anexos-linha` (mesma regra no cliente). */

/**
 * Tipos de entidade aceitos para anexos de folha:
 * - `frequencia`: anexo da LINHA (um profissional dentro da folha);
 * - `frequencia_submissao`: anexo da SUBMISSÃO (competência + unidade + vínculo),
 *   usado como documentação de justificativa no envio para aprovação.
 */
const TipoAnexoEnum = z.enum(["frequencia", "frequencia_submissao"]);
export type TipoAnexoEntidade = z.infer<typeof TipoAnexoEnum>;

const AnexoSchema = z.object({
  entidade_id: z.string().uuid(),
  tipo_entidade: TipoAnexoEnum.default("frequencia"),
  /** Recorte dentro da entidade (ex.: "efetivos" | "contratados" na submissão). */
  subtipo: z.string().max(30).optional(),
  unidade_id: z.string().uuid().nullable().optional(),
  setor_id: z.string().uuid().nullable().optional(),
  secretaria_id: z.string().uuid().nullable().optional(),
  categoria_id: z.string().uuid().nullable().optional(),
  nome: z.string().min(1).max(255),
  storage_path: z.string().min(1).max(1024),
  mime_type: z.enum(ANEXO_MIMES_ACEITOS),
  tamanho_bytes: z.number().int().positive().max(ANEXO_TAMANHO_MAX),
});

export const registrarAnexoLinha = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: z.infer<typeof AnexoSchema>) => AnexoSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensurePermission(supabase, userId, ACOES.DOCUMENTO_UPLOAD);
    const { data: doc, error } = await supabase
      .from("documentos")
      .insert({
        tipo_entidade: data.tipo_entidade,
        entidade_id: data.entidade_id,
        unidade_id: data.unidade_id ?? null,
        secretaria_id: data.secretaria_id ?? null,
        categoria_id: data.categoria_id ?? null,
        
        nome: data.nome,
        storage_path: data.storage_path,
        mime_type: data.mime_type,
        tamanho_bytes: data.tamanho_bytes,
        metadata: {
          entidade_id: data.entidade_id,
          tipo_entidade: data.tipo_entidade,
          ...(data.subtipo ? { folha: data.subtipo } : {}),
          ...(data.setor_id ? { setor_id: data.setor_id } : {}),
        },
        created_by: userId,
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await emitEvento(supabase, EVENTOS.DOCUMENTO_ANEXADO, "documento", (doc as any)?.id ?? null, {
      tipo_entidade: data.tipo_entidade,
      entidade_id: data.entidade_id,
      nome: data.nome,
    });
    return { ok: true, id: (doc as any)?.id as string };
  });

const ListarAnexosSchema = z.object({
  entidade_id: z.string().uuid(),
  tipo_entidade: TipoAnexoEnum.default("frequencia"),
  subtipo: z.string().max(30).optional(),
  setor_id: z.string().uuid().optional(),
});

/**
 * Lista os anexos da entidade e devolve URLs assinadas de curta duração (5 min).
 * A leitura é governada apenas pela RLS de `documentos` (unidade/secretaria/master),
 * então quem aprova consegue abrir sem precisar de permissão de upload.
 */
export const listarAnexosLinha = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: z.infer<typeof ListarAnexosSchema>) => ListarAnexosSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let q = supabase
      .from("documentos")
      .select("id, nome, mime_type, tamanho_bytes, storage_path, created_at, created_by")
      .eq("tipo_entidade", data.tipo_entidade)
      .eq("entidade_id", data.entidade_id)
      .is("deleted_at", null);
    if (data.subtipo) q = q.eq("metadata->>folha", data.subtipo);
    if (data.setor_id) q = q.eq("metadata->>setor_id", data.setor_id);
    const { data: docs, error } = await q.order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const rows = docs ?? [];
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
        const { data: signed } = await supabase.storage
          .from("documentos")
          .createSignedUrl(d.storage_path, 300);
        return {
          id: d.id as string,
          nome: d.nome as string,
          mime_type: (d.mime_type ?? null) as string | null,
          tamanho_bytes: Number(d.tamanho_bytes ?? 0),
          created_at: d.created_at as string,
          enviado_por: autores.get(d.created_by) ?? null,
          url: signed?.signedUrl ?? null,
        };
      }),
    );

    if (assinadas.length) {
      await emitEvento(supabase, EVENTOS.DOCUMENTO_ANEXADO, "documento", data.entidade_id, {
        acao: "visualizacao",
        tipo_entidade: data.tipo_entidade,
        quantidade: assinadas.length,
        usuario_id: userId,
      });
    }
    return { anexos: assinadas };
  });

const RemoverAnexoSchema = z.object({
  documento_id: z.string().uuid(),
});


/**
 * Remoção = soft-delete apenas. O binário PERMANECE no Storage até a purga
 * automática (`/api/public/hooks/purgar-documentos`), depois de `purga_apos`.
 */
export const removerAnexoLinha = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: z.infer<typeof RemoverAnexoSchema>) => RemoverAnexoSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensurePermission(supabase, userId, ACOES.DOCUMENTO_UPLOAD);

    const { data: doc, error: sErr } = await supabase
      .from("documentos")
      .select("id, storage_path, tipo_entidade")
      .eq("id", data.documento_id)
      .is("deleted_at", null)
      .maybeSingle();
    if (sErr) throw new Error(sErr.message);
    const tipoEntidade = (doc as { tipo_entidade?: string } | null)?.tipo_entidade;
    if (!doc || !(TIPOS_ANEXO_FOLHA as readonly string[]).includes(tipoEntidade ?? "")) {
      throw new Error("Anexo não encontrado.");
    }
    const purgaApos = calcularPurgaApos(tipoEntidade);

    const { error: upErr } = await supabase
      .from("documentos")
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: userId,
        purga_apos: purgaApos,
      } as never)
      .eq("id", data.documento_id);
    if (upErr) throw new Error(upErr.message);

    await emitEvento(supabase, EVENTOS.DOCUMENTO_REMOVIDO, "documento", data.documento_id, {
      soft_delete: true,
      purga_apos: purgaApos,
    });
    return { ok: true };
  });

/** Lixeira: anexos removidos da entidade (somente quem tem `documento.excluir`). */
export const listarAnexosRemovidosLinha = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: z.infer<typeof ListarAnexosSchema>) => ListarAnexosSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensurePermission(supabase, userId, ACOES.DOCUMENTO_EXCLUIR);
    let q = supabase
      .from("documentos")
      .select("id, nome, mime_type, tamanho_bytes, storage_path, deleted_at, purga_apos")
      .eq("tipo_entidade", data.tipo_entidade)
      .eq("entidade_id", data.entidade_id)
      .not("deleted_at", "is", null);
    if (data.subtipo) q = q.eq("metadata->>folha", data.subtipo);
    if (data.setor_id) q = q.eq("metadata->>setor_id", data.setor_id);
    const { data: docs, error } = await q.order("deleted_at", { ascending: false });
    if (error) throw new Error(error.message);

    const rows = docs ?? [];
    return {
      anexos: await Promise.all(
        rows.map(async (d: Record<string, unknown>) => {
          const { data: signed } = await supabase.storage
            .from("documentos")
            .createSignedUrl(d.storage_path as string, 300);
          return {
            id: d.id as string,
            nome: d.nome as string,
            mime_type: (d.mime_type ?? null) as string | null,
            tamanho_bytes: Number(d.tamanho_bytes ?? 0),
            deleted_at: d.deleted_at as string,
            purga_apos: (d.purga_apos ?? null) as string | null,
            url: signed?.signedUrl ?? null,
          };
        }),
      ),
    };
  });

/** Restaura um anexo da lixeira. */
export const restaurarAnexoLinha = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: z.infer<typeof RemoverAnexoSchema>) => RemoverAnexoSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensurePermission(supabase, userId, ACOES.DOCUMENTO_EXCLUIR);
    const { error } = await supabase
      .from("documentos")
      .update({ deleted_at: null, deleted_by: null, purga_apos: null, updated_by: userId } as never)
      .eq("id", data.documento_id)
      .in("tipo_entidade", TIPOS_ANEXO_FOLHA);
    if (error) throw new Error(error.message);
    await emitEvento(supabase, EVENTOS.DOCUMENTO_ANEXADO, "documento", data.documento_id, {
      restaurado: true,
    });
    return { ok: true };
  });

const DescartarSchema = z.object({
  documento_ids: z.array(z.string().uuid()).min(1).max(50),
});

/**
 * Descarte definitivo de anexos ainda NÃO confirmados (ex.: o usuário fez
 * upload no modal de envio e fechou sem confirmar).
 *
 * Diferente de `removerAnexoLinha` (soft-delete + retenção legal), aqui o
 * registro e o binário são apagados de vez — mas apenas para quem subiu o
 * arquivo e enquanto ele não foi removido/retido.
 */
export const descartarAnexosPendentes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: z.infer<typeof DescartarSchema>) => DescartarSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensurePermission(supabase, userId, ACOES.DOCUMENTO_UPLOAD);

    const { data: docs, error } = await supabase
      .from("documentos")
      .select("id, storage_path, tipo_entidade, created_by")
      .in("id", data.documento_ids)
      .eq("created_by", userId)
      .is("deleted_at", null);
    if (error) throw new Error(error.message);

    const alvos = (docs ?? []).filter((d: Record<string, unknown>) =>
      (TIPOS_ANEXO_FOLHA as readonly string[]).includes(String(d.tipo_entidade ?? "")),
    );
    if (!alvos.length) return { ok: true, descartados: 0 };

    const ids = alvos.map((d: Record<string, unknown>) => d.id as string);
    const paths = alvos.map((d: Record<string, unknown>) => d.storage_path as string);

    const { error: dErr } = await supabase.from("documentos").delete().in("id", ids);
    if (dErr) throw new Error(dErr.message);

    await supabase.storage.from("documentos").remove(paths);

    await emitEvento(supabase, EVENTOS.DOCUMENTO_REMOVIDO, "documento", ids[0], {
      descarte_definitivo: true,
      motivo: "envio_cancelado",
      quantidade: ids.length,
    });
    return { ok: true, descartados: ids.length };
  });
