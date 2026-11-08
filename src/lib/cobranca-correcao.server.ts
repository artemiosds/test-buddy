/**
 * Cobrança diária de folhas devolvidas/rejeitadas que ainda precisam de correção.
 * Executada pelo deadline-check, usa o mesmo ledger idempotente de avisos
 * internos e e-mails; não modifica status de folhas, competências ou pessoas.
 */
import { notificarUsuarios } from "./notificar.server";
import { exigeLembreteCorrecao, eventoLembreteCorrecao, type FolhaCorrecao, STATUS_CORRECAO } from "./cobranca-correcao";
import { gestorPodeReceber } from "./cobranca-folhas";

type Usuario = {
  id: string;
  perfil_id: string;
  secretaria_id: string | null;
  acesso_todas_secretarias: boolean;
};
type Perfil = { id: string; codigo: string };
type Parametros = {
  supa: any;
  agora: Date;
  usuarios: Usuario[];
  perfis: Perfil[];
  unidadesPorDiretor: ReadonlyMap<string, ReadonlySet<string>>;
};
type Resultado = { folhas: number; avisos: number; falhas: number; emails: number; emails_falhos: number };

export async function cobrarFolhasDevolvidas(params: Parametros): Promise<Resultado> {
  const { supa, agora, usuarios, perfis, unidadesPorDiretor } = params;
  const resultado: Resultado = { folhas: 0, avisos: 0, falhas: 0, emails: 0, emails_falhos: 0 };
  const limite = new Date(agora.getTime() - 86_400_000).toISOString();

  // Paginação em vez de limitar os lembretes às primeiras 1000 folhas.
  const selecionadas: Array<{
    id: string; status: string; tipo: string; updated_at: string;
    competencia_unidade_id: string;
  }> = [];
  const tamanho = 500;
  for (let pagina = 0; ; pagina++) {
    const { data, error } = await supa.from("frequencias")
      .select("id, status, tipo, updated_at, competencia_unidade_id")
      .in("status", [...STATUS_CORRECAO])
      .is("deleted_at", null)
      .lte("updated_at", limite)
      .order("id", { ascending: true })
      .range(pagina * tamanho, (pagina + 1) * tamanho - 1);
    if (error) throw new Error("Falha ao consultar folhas devolvidas para cobrança.");
    const lote = (data ?? []) as typeof selecionadas;
    selecionadas.push(...lote);
    if (lote.length < tamanho) break;
    if (pagina >= 39) throw new Error("Limite de segurança da cobrança atingido; revisar o volume de folhas.");
  }
  if (!selecionadas.length) return resultado;

  const cuIds = [...new Set(selecionadas.map(f => f.competencia_unidade_id))];
  const vinculos = new Map<string, { unidade_id: string; competencia_id: string }>();
  for (let i = 0; i < cuIds.length; i += 200) {
    const { data, error } = await supa.from("competencia_unidades")
      .select("id, unidade_id, competencia_id, status")
      .in("id", cuIds.slice(i, i + 200)).is("deleted_at", null);
    if (error) throw new Error("Falha ao consultar vínculos das folhas devolvidas.");
    for (const cu of data ?? []) {
      if (cu.status !== "arquivada") vinculos.set(cu.id, cu);
    }
  }
  const compIds = [...new Set([...vinculos.values()].map(x => x.competencia_id))];
  const competencias = new Map<string, { status: string; secretaria_id: string; ano: number; mes: number }>();
  for (let i = 0; i < compIds.length; i += 200) {
    const { data, error } = await supa.from("competencias")
      .select("id, status, secretaria_id, ano, mes")
      .in("id", compIds.slice(i, i + 200)).is("deleted_at", null);
    if (error) throw new Error("Falha ao consultar competências das folhas devolvidas.");
    for (const comp of data ?? []) competencias.set(comp.id, comp);
  }

  const perfilPorId = new Map(perfis.map(p => [p.id, p.codigo]));
  for (const folha of selecionadas) {
    const cu = vinculos.get(folha.competencia_unidade_id);
    const comp = cu && competencias.get(cu.competencia_id);
    if (!cu || !comp) continue;
    const f: FolhaCorrecao = {
      id: folha.id, status: folha.status, tipo: folha.tipo, updated_at: folha.updated_at,
      unidade_id: cu.unidade_id, competencia_id: cu.competencia_id,
      competencia_status: comp.status, secretaria_id: comp.secretaria_id,
    };
    if (!exigeLembreteCorrecao(f, agora)) continue;

    const destinatarios = usuarios.filter(u => {
      const perfil = perfilPorId.get(u.perfil_id);
      if (!gestorPodeReceber(perfil, u.secretaria_id, comp.secretaria_id, u.acesso_todas_secretarias))
        return false;
      if (perfil !== "DIRETOR_UNIDADE") return true;
      return unidadesPorDiretor.get(u.id)?.has(cu.unidade_id) ?? false;
    }).map(u => u.id);
    if (!destinatarios.length) continue;

    // Uma edição/reenvio feita durante o job impede lembrete obsoleto.
    const { data: atual, error } = await supa.from("frequencias")
      .select("status, updated_at").eq("id", folha.id).maybeSingle();
    if (error) throw new Error("Falha ao reconferir status antes da cobrança.");
    if (!atual || atual.status !== folha.status || atual.updated_at !== folha.updated_at) continue;

    const periodo = `${String(comp.mes).padStart(2, "0")}/${comp.ano}`;
    const tipo = folha.tipo === "efetivos" ? "efetivos" : "contratados";
    const status = folha.status === "devolvida" ? "devolvida" :
      folha.status === "rejeitada" ? "rejeitada" : "com pendências";
    const aviso = await notificarUsuarios({
      client: supa,
      destinatarios,
      titulo: `Correção pendente: folha de ${tipo} — ${periodo}`,
      mensagem: `A folha de ${tipo} (${periodo}) continua ${status} há pelo menos 24 horas. Verifique a pendência e corrija os dados antes de reenviar.`,
      tipo: "alerta",
      prioridade: "alta",
      canal: "interno",
      entidade_tipo: "frequencia",
      entidade_id: folha.id,
      link: `/frequencias/${folha.id}`,
      eventoId: eventoLembreteCorrecao(f, agora),
      email: true,
      emailCtaLabel: "Conferir folha pendente",
      emailDetalhes: [{ label: "Competência", value: periodo }, { label: "Situação", value: status }],
    });
    resultado.folhas++;
    resultado.avisos += aviso.notificacoes;
    resultado.falhas += aviso.notificacoes_falhas;
    resultado.emails += aviso.emails;
    resultado.emails_falhos += aviso.emails_falhos;
  }
  return resultado;
}
