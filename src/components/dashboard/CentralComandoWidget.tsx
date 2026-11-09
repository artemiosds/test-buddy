import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AlertCircle, ArrowRight, CheckCircle2, ClipboardCheck, Clock3, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCompetenciaAtiva } from "@/hooks/use-competencia-ativa";
import { useCurrentUser, usePermissions } from "@/hooks/use-permissions";
import { useUnitScope } from "@/hooks/use-unit-scope";
import { supabase } from "@/integrations/supabase/client";
import { resumirComando, type LinhaComando } from "@/lib/central-comando-resumo";

/**
 * Visão operacional da página inicial: somente leitura. Não abre/fecha
 * competência nem executa ações financeiras. O RLS continua obrigatório,
 * com filtro adicional explícito por secretaria/unidade autorizada.
 */
export function CentralComandoWidget() {
  const { data: usuario, isLoading: usuarioCarregando } = useCurrentUser();
  const { hasAny, isLoading: permissoesCarregando } = usePermissions();
  const { data: competencia, isLoading: competenciaCarregando } = useCompetenciaAtiva();
  const escopo = useUnitScope();

  const podeVer = hasAny(["frequencia.analisar", "frequencia.aprovar", "competencia.encerrar"]);
  const perfil = usuario?.perfil_codigo ?? "";
  const master = perfil === "MASTER" || perfil === "ADMINISTRADOR_MASTER";
  const isAdminSms = perfil === "ADMIN_SMS";
  const allowed = usuario?.unidades ?? [];
  const escopoIds = !master && !isAdminSms
    ? (escopo.unidadePadraoId ? [escopo.unidadePadraoId] : allowed)
    : [];
  const habilitado = !!usuario?.id && !!competencia?.id && !escopo.isLoading &&
    !permissoesCarregando && podeVer;

  const resumoQuery = useQuery({
    queryKey: ["central-comando", usuario?.id, competencia?.id, perfil, usuario?.secretaria_id, escopoIds],
    enabled: habilitado,
    staleTime: 90_000,
    queryFn: async () => {
      const { data: comp, error: compErro } = await supabase.from("competencias")
        .select("id, secretaria_id").eq("id", competencia!.id).maybeSingle();
      if (compErro) throw compErro;
      if (!comp) return null;
      // O administrador de uma secretaria não deve visualizar outra secretaria.
      if (!master && isAdminSms && !usuario?.acesso_todas_secretarias &&
        comp.secretaria_id !== usuario?.secretaria_id) return null;
      if (!master && !isAdminSms && escopoIds.length === 0) return null;

      let unidadesQuery = supabase.from("competencia_unidades")
        .select("id, unidade_id").eq("competencia_id", competencia!.id)
        .is("deleted_at", null).neq("status", "arquivada").limit(5001);
      if (!master && !isAdminSms) unidadesQuery = unidadesQuery.in("unidade_id", escopoIds);
      const { data: unidadeRows, error: unidadesErro } = await unidadesQuery;
      if (unidadesErro) throw unidadesErro;
      if ((unidadeRows ?? []).length > 5000)
        throw new Error("Há mais de 5.000 vínculos de unidades. Use uma consulta paginada.");

      const unidadesIds = [...new Set((unidadeRows ?? []).map(r => r.unidade_id))];
      if (!unidadesIds.length) return resumirComando([], []);
      const competenciaUnidadeIds = (unidadeRows ?? []).map(r => r.id);
      const linhas: LinhaComando[] = [];
      // Blocos pequenos para evitar limite de URL e preservar o escopo autorizado.
      for (let i = 0; i < competenciaUnidadeIds.length; i += 100) {
        const ids = competenciaUnidadeIds.slice(i, i + 100);
        const { data, error } = await supabase.from("frequencias")
          .select("id, competencia_unidade_id, tipo, setor_id, status")
          .in("competencia_unidade_id", ids)
          .is("deleted_at", null).limit(5001);
        if (error) throw error;
        if ((data ?? []).length > 5000)
          throw new Error("Há mais de 5.000 folhas no período. Revise a consulta.");
        const unidadePorVinculo = new Map((unidadeRows ?? []).map(r => [r.id, r.unidade_id]));
        for (const f of data ?? []) {
          const unidadeId = unidadePorVinculo.get(f.competencia_unidade_id);
          if (unidadeId) linhas.push({
            id: f.id, unidade_id: unidadeId, tipo: f.tipo, setor_id: f.setor_id, status: f.status,
          });
        }
      }
      return resumirComando(unidadesIds, linhas);
    },
  });

  if (usuarioCarregando || permissoesCarregando || escopo.isLoading || competenciaCarregando) return null;
  if (!podeVer || !usuario) return null;

  const resumo = resumoQuery.data;
  return (
    <section className="rounded-xl border bg-card p-4 shadow-sm md:p-5 space-y-4" aria-label="Central de Comando da Saúde">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h2 className="text-lg font-semibold flex gap-2 items-center">
            <ShieldCheck className="h-5 w-5 text-primary" /> Central de Comando
          </h2>
          <p className="text-sm text-muted-foreground">
            {competencia ? `Competência ${competencia.label} · Ações que precisam de atenção`
              : "Nenhuma competência ativa disponível"}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => resumoQuery.refetch()}
          disabled={!habilitado || resumoQuery.isFetching} aria-label="Atualizar indicadores">
          <RefreshCw className={`mr-2 h-4 w-4 ${resumoQuery.isFetching ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>
      {resumoQuery.isPending && habilitado ? (
        <p className="text-sm text-muted-foreground">Conferindo a situação das folhas...</p>
      ) : resumoQuery.isError ? (
        <p role="alert" className="text-sm text-destructive">
          Não foi possível conferir as folhas agora. Nenhum indicador parcial será apresentado.
        </p>
      ) : !resumo ? (
        <p className="text-sm text-muted-foreground">Sem competência disponível no seu escopo de acesso.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: "Unidades monitoradas", numero: resumo.unidades, Icon: ShieldCheck },
              { label: "Aguardando envio", numero: resumo.pendentes, Icon: Clock3 },
              { label: "Com correções", numero: resumo.emCorrecao, Icon: AlertCircle },
              { label: "Aguardando análise", numero: resumo.prontasAprovacao, Icon: ClipboardCheck },
            ].map(item => (
              <div className="rounded-lg border bg-muted/30 p-3" key={item.label}>
                <div className="flex items-center gap-2 text-muted-foreground text-xs">
                  <item.Icon className="h-4 w-4" /> {item.label}
                </div>
                <div className="mt-2 text-2xl font-semibold tabular-nums">{item.numero}</div>
              </div>
            ))}
          </div>
          <div className="space-y-2 text-sm">
            {resumo.emCorrecao > 0 && (
              <Link to="/pendencias" className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/40">
                <span><strong>{resumo.emCorrecao}</strong> unidade(s) com correções pendentes</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}
            {resumo.prontasAprovacao > 0 && (
              <Link to="/aprovacoes" className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/40">
                <span><strong>{resumo.prontasAprovacao}</strong> unidade(s) com folhas para análise</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}
            {resumo.pendentes > 0 && (
              <Link to="/frequencias" className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/40">
                <span><strong>{resumo.pendentes}</strong> unidade(s) aguardando envio completo</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}
            {resumo.pendentes === 0 && resumo.emCorrecao === 0 && resumo.prontasAprovacao === 0 && (
              <p className="flex gap-2 items-center text-muted-foreground">
                <CheckCircle2 className="h-4 w-4" /> Nenhuma ação pendente identificada nas folhas consultadas.
              </p>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Dados somente de leitura, conforme suas permissões. Atualizados quando solicitado ou ao renovar a consulta.
          </p>
        </>
      )}
    </section>
  );
}
