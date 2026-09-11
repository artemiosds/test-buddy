/**
 * Geral Cargos — agregação gerencial sobre o cadastro atual de profissionais.
 *
 * Usa a mesma fonte do Cadastro de Profissionais (`profissionais` + `cargos` +
 * `vinculos` + `unidades`), aplicando por cima:
 *  - a regra institucional de ATIVOS / DISPONÍVEL PARA ESCALA
 *    (`src/lib/situacao-funcional.ts`);
 *  - o De-Para de cargos consolidados (`src/lib/cargo-categorias.ts`).
 *
 * Somente leitura. Nada aqui altera cadastro, folha ou PDFs oficiais.
 */
import { supabase } from "@/integrations/supabase/client";
import {
  SITUACAO_LABEL,
  ehAtivoAmpliado,
  ehDisponivelEscala,
  situacaoNormalizada,
  type SituacaoFuncional,
} from "@/lib/situacao-funcional";
import { categoriaDoCargo } from "@/lib/cargo-categorias";

export type ModoGeralCargos = "ativos" | "geral";
export type AgrupamentoCargos = "categoria" | "cargo";

export type VinculoClasse = "efetivo" | "prestador" | "comissionado" | "terceirizado";

type ProfLinha = {
  id: string;
  status: string | null;
  situacao_funcional: string | null;
  cargo_id: string | null;
  vinculo_id: string | null;
  unidade_id: string | null;
  setor_id: string | null;
};

export type LinhaCargo = {
  chave: string;
  nome: string;
  efetivos: number;
  prestadores: number;
  ativos: number;
  disponivel: number;
  total: number;
};

export type LinhaUnidade = {
  id: string;
  nome: string;
  sigla: string | null;
  efetivos: number;
  prestadores: number;
  prestadores_servico: number;
  comissionados: number;
  terceirizados: number;
  ativos: number;
  disponivel: number;
  total: number;
};

/** Composição de cargos dentro de uma unidade específica. */
export type CruzamentoUnidade = {
  unidade: string;
  total: number;
  cargos: Array<{ nome: string; efetivos: number; prestadores: number; total: number }>;
};

/** Setores vinculados a uma unidade, com quadro quantitativo por setor. */
export type SetoresUnidade = {
  unidade: string;
  setores: Array<{
    nome: string;
    efetivos: number;
    prestadores: number;
    total: number;
  }>;
};

export type LinhaAfastamento = {
  situacao: SituacaoFuncional;
  label: string;
  qtd: number;
  cargos: string[];
};

/** Afastamentos agregados por local (unidade ou setor). */
export type AfastamentoPorLocal = {
  chave: string;
  nome: string;
  qtd: number;
  tipos: string[];
};

export type GeralCargosDados = {
  /** Todos os registros não excluídos. */
  total: number;
  /** ativo + férias + licença prêmio. */
  ativos: number;
  /** apenas ativo. */
  disponivel: number;
  efetivosAtivos: number;
  prestadoresAtivos: number;
  prestadoresServicoAtivos: number;
  comissionadosAtivos: number;
  terceirizadosAtivos: number;
  /** férias + licença prêmio (ativos, fora de escala). */
  foraDeEscala: number;
  /** registros fora dos ativos. */
  foraDosAtivos: number;
  porStatus: Array<{ situacao: SituacaoFuncional; label: string; qtd: number }>;
  unidades: LinhaUnidade[];
  cargos: LinhaCargo[];
  medicos: LinhaCargo[];
  afastamentos: LinhaAfastamento[];
  /** Afastamentos e ausências agrupados por unidade de lotação. */
  afastamentosPorUnidade: AfastamentoPorLocal[];
  /** Afastamentos e ausências agrupados por setor (setor é opcional). */
  afastamentosPorSetor: AfastamentoPorLocal[];
  /** Top 5 unidades por total, com os 5 cargos mais numerosos de cada uma. */
  cruzamento: CruzamentoUnidade[];
  /** Mesmas unidades do cruzamento, abertas por setor cadastrado. */
  setoresPorUnidade: SetoresUnidade[];
};

function classificarVinculo(natureza?: string | null, nome?: string | null): VinculoClasse {
  const n = `${natureza ?? ""} ${nome ?? ""}`.toLowerCase();
  if (n.includes("efetiv") || n.includes("estatut")) return "efetivo";
  if (n.includes("terceir")) return "terceirizado";
  if (n.includes("comission")) return "comissionado";
  return "prestador";
}

async function buscarProfissionais(): Promise<ProfLinha[]> {
  const linhas: ProfLinha[] = [];
  const passo = 1000;
  for (let inicio = 0; ; inicio += passo) {
    const { data, error } = await supabase
      .from("profissionais")
      .select("id, status, situacao_funcional, cargo_id, vinculo_id, unidade_id, setor_id")
      .is("deleted_at", null)
      .order("id")
      .range(inicio, inicio + passo - 1);
    if (error) throw error;
    const lote = (data ?? []) as ProfLinha[];
    linhas.push(...lote);
    if (lote.length < passo) break;
  }
  return linhas;
}

export async function getGeralCargos(
  modo: ModoGeralCargos,
  agrupamento: AgrupamentoCargos = "categoria",
): Promise<GeralCargosDados> {
  const [profs, cargosRes, vinculosRes, unidadesRes, setoresRes] = await Promise.all([
    buscarProfissionais(),
    supabase.from("cargos").select("id, nome"),
    supabase.from("vinculos").select("id, nome, natureza"),
    supabase.from("unidades").select("id, nome, sigla").is("deleted_at", null),
    supabase.from("setores").select("id, nome, unidade_id").is("deleted_at", null),
  ]);
  if (cargosRes.error) throw cargosRes.error;
  if (vinculosRes.error) throw vinculosRes.error;
  if (unidadesRes.error) throw unidadesRes.error;
  if (setoresRes.error) throw setoresRes.error;
  const setores = setoresRes.data ?? [];

  const nomeCargo = new Map((cargosRes.data ?? []).map((c) => [c.id, c.nome]));
  const classeVinculo = new Map(
    (vinculosRes.data ?? []).map((v) => [v.id, classificarVinculo(v.natureza, v.nome)]),
  );
  const unidades = unidadesRes.data ?? [];

  const total = profs.length;
  const ativosTodos = profs.filter((p) => ehAtivoAmpliado(p));
  const base = modo === "ativos" ? ativosTodos : profs;

  /* ------------------------------------------------ contagem por situação */
  const statusMap = new Map<SituacaoFuncional, number>();
  for (const p of profs) {
    const s = situacaoNormalizada(p);
    statusMap.set(s, (statusMap.get(s) ?? 0) + 1);
  }
  const porStatus = Array.from(statusMap, ([situacao, qtd]) => ({
    situacao,
    label: SITUACAO_LABEL[situacao],
    qtd,
  })).sort((a, b) => b.qtd - a.qtd);

  /* -------------------------------------------------------- KPIs globais */
  const classeDe = (p: ProfLinha) =>
    p.vinculo_id ? (classeVinculo.get(p.vinculo_id) ?? "prestador") : "prestador";

  const ativos = ativosTodos.length;
  const disponivel = profs.filter((p) => ehDisponivelEscala(p)).length;
  const efetivosAtivos = ativosTodos.filter((p) => classeDe(p) === "efetivo").length;
  const prestadoresServicoAtivos = ativosTodos.filter((p) => classeDe(p) === "prestador").length;
  const comissionadosAtivos = ativosTodos.filter((p) => classeDe(p) === "comissionado").length;
  const terceirizadosAtivos = ativosTodos.filter((p) => classeDe(p) === "terceirizado").length;

  /* --------------------------------------------------- bloco por unidade */
  const porUnidade = new Map<string, LinhaUnidade>();
  const linhaUnidade = (id: string | null) => {
    const chave = id ?? "sem-unidade";
    let l = porUnidade.get(chave);
    if (!l) {
      const u = unidades.find((x) => x.id === id);
      l = {
        id: chave,
        nome: u?.nome ?? "Sem unidade",
        sigla: u?.sigla ?? null,
        efetivos: 0,
        prestadores: 0,
        prestadores_servico: 0,
        comissionados: 0,
        terceirizados: 0,
        ativos: 0,
        disponivel: 0,
        total: 0,
      };
      porUnidade.set(chave, l);
    }
    return l;
  };

  /* ------------------------------------------- blocos de cargos/categorias */
  const acumCargos = new Map<string, LinhaCargo & { grupo: string }>();

  /** unidade → cargo → {efetivos, prestadores, total} */
  const cruzUnidade = new Map<
    string,
    Map<string, { efetivos: number; prestadores: number; total: number }>
  >();

  /** setor_id → {efetivos, prestadores, total} */
  const porSetor = new Map<string, { efetivos: number; prestadores: number; total: number }>();

  for (const p of base) {
    const classe = classeDe(p);
    const u = linhaUnidade(p.unidade_id);
    u.total += 1;
    if (classe === "efetivo") u.efetivos += 1;
    else {
      u.prestadores += 1;
      if (classe === "prestador") u.prestadores_servico += 1;
      if (classe === "comissionado") u.comissionados += 1;
      if (classe === "terceirizado") u.terceirizados += 1;
    }
    if (ehAtivoAmpliado(p)) u.ativos += 1;
    if (ehDisponivelEscala(p)) u.disponivel += 1;

    const cat = categoriaDoCargo(p.cargo_id ? (nomeCargo.get(p.cargo_id) ?? null) : null);
    let mapaCargos = cruzUnidade.get(u.id);
    if (!mapaCargos) {
      mapaCargos = new Map();
      cruzUnidade.set(u.id, mapaCargos);
    }
    let cel = mapaCargos.get(cat.nome);
    if (!cel) {
      cel = { efetivos: 0, prestadores: 0, total: 0 };
      mapaCargos.set(cat.nome, cel);
    }
    cel.total += 1;
    if (classe === "efetivo") cel.efetivos += 1;
    else cel.prestadores += 1;

    if (p.setor_id) {
      let celS = porSetor.get(p.setor_id);
      if (!celS) {
        celS = { efetivos: 0, prestadores: 0, total: 0 };
        porSetor.set(p.setor_id, celS);
      }
      celS.total += 1;
      if (classe === "efetivo") celS.efetivos += 1;
      else celS.prestadores += 1;
    }
  }

  const acumular = (agrupamento: AgrupamentoCargos) => {
    acumCargos.clear();
    for (const p of base) {
      const cargo = p.cargo_id ? (nomeCargo.get(p.cargo_id) ?? null) : null;
      const cat = categoriaDoCargo(cargo);
      const chave = agrupamento === "categoria" ? cat.slug : `cargo:${cargo ?? "sem-cargo"}`;
      const nome = agrupamento === "categoria" ? cat.nome : (cargo ?? "Sem cargo");
      let l = acumCargos.get(chave);
      if (!l) {
        l = {
          chave,
          nome,
          grupo: cat.grupo,
          efetivos: 0,
          prestadores: 0,
          ativos: 0,
          disponivel: 0,
          total: 0,
        };
        acumCargos.set(chave, l);
      }
      l.total += 1;
      if (classeDe(p) === "efetivo") l.efetivos += 1;
      else l.prestadores += 1;
      if (ehAtivoAmpliado(p)) l.ativos += 1;
      if (ehDisponivelEscala(p)) l.disponivel += 1;
    }
    return Array.from(acumCargos.values());
  };

  const agrupado = acumular(agrupamento);
  const ordenar = (a: LinhaCargo, b: LinhaCargo) =>
    b.total - a.total || a.nome.localeCompare(b.nome, "pt-BR");

  const cargos = agrupado
    .filter((l) => l.grupo === "geral")
    .map(({ grupo: _g, ...l }) => l)
    .sort(ordenar);
  const medicos = agrupado
    .filter((l) => l.grupo === "medico")
    .map(({ grupo: _g, ...l }) => l)
    .sort(ordenar);

  /* ----------------------------------------------- bloco de afastamentos */
  const foraDosAtivosLinhas = profs.filter((p) => !ehAtivoAmpliado(p));
  const afastMap = new Map<SituacaoFuncional, { qtd: number; cargos: Map<string, number> }>();

  type LocalAcum = { nome: string; qtd: number; tipos: Map<string, number> };
  const afastUnidade = new Map<string, LocalAcum>();
  const afastSetor = new Map<string, LocalAcum>();
  const nomeUnidade = new Map(unidades.map((u) => [u.id, u.sigla ? `${u.nome} (${u.sigla})` : u.nome]));
  const nomeSetor = new Map(
    setores.map((s) => {
      const u = s.unidade_id ? nomeUnidade.get(s.unidade_id) : null;
      return [s.id, u ? `${s.nome} — ${u}` : s.nome];
    }),
  );
  const acumularLocal = (
    mapa: Map<string, LocalAcum>,
    chave: string,
    nome: string,
    label: string,
  ) => {
    let l = mapa.get(chave);
    if (!l) {
      l = { nome, qtd: 0, tipos: new Map() };
      mapa.set(chave, l);
    }
    l.qtd += 1;
    l.tipos.set(label, (l.tipos.get(label) ?? 0) + 1);
  };

  for (const p of foraDosAtivosLinhas) {
    const s = situacaoNormalizada(p);
    let a = afastMap.get(s);
    if (!a) {
      a = { qtd: 0, cargos: new Map() };
      afastMap.set(s, a);
    }
    a.qtd += 1;
    const cat = categoriaDoCargo(p.cargo_id ? (nomeCargo.get(p.cargo_id) ?? null) : null);
    a.cargos.set(cat.nome, (a.cargos.get(cat.nome) ?? 0) + 1);

    const label = SITUACAO_LABEL[s];
    const chaveU = p.unidade_id ?? "sem-unidade";
    acumularLocal(
      afastUnidade,
      chaveU,
      p.unidade_id ? (nomeUnidade.get(p.unidade_id) ?? "Sem unidade") : "Sem unidade",
      label,
    );
    const chaveS = p.setor_id ?? "sem-setor";
    acumularLocal(
      afastSetor,
      chaveS,
      p.setor_id ? (nomeSetor.get(p.setor_id) ?? "Setor não identificado") : "Sem setor informado",
      label,
    );
  }

  const localParaLinhas = (mapa: Map<string, LocalAcum>): AfastamentoPorLocal[] =>
    Array.from(mapa, ([chave, l]) => ({
      chave,
      nome: l.nome,
      qtd: l.qtd,
      tipos: Array.from(l.tipos)
        .sort((x, y) => y[1] - x[1])
        .slice(0, 3)
        .map(([nome, qtd]) => `${nome} (${qtd})`),
    })).sort((a, b) => b.qtd - a.qtd || a.nome.localeCompare(b.nome, "pt-BR"));

  const afastamentosPorUnidade = localParaLinhas(afastUnidade);
  const afastamentosPorSetor = localParaLinhas(afastSetor);
  const afastamentos: LinhaAfastamento[] = Array.from(afastMap, ([situacao, a]) => ({
    situacao,
    label: SITUACAO_LABEL[situacao],
    qtd: a.qtd,
    cargos: Array.from(a.cargos)
      .sort((x, y) => y[1] - x[1])
      .slice(0, 3)
      .map(([nome, qtd]) => `${nome} (${qtd})`),
  })).sort((a, b) => b.qtd - a.qtd);

  const foraDeEscala = ativos - disponivel;

  const listaUnidades = Array.from(porUnidade.values()).sort(
    (a, b) => b.total - a.total || a.nome.localeCompare(b.nome, "pt-BR"),
  );

  const cruzamento: CruzamentoUnidade[] = listaUnidades.slice(0, 5).map((u) => ({
    unidade: u.sigla ? `${u.nome} (${u.sigla})` : u.nome,
    total: u.total,
    cargos: Array.from(cruzUnidade.get(u.id) ?? new Map(), ([nome, c]) => ({ nome, ...c }))
      .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, "pt-BR"))
      .slice(0, 5),
  }));

  const setoresPorUnidade: SetoresUnidade[] = listaUnidades.slice(0, 5).map((u) => {
    const lista = setores
      .filter((s) => s.unidade_id === u.id)
      .map((s) => {
        const c = porSetor.get(s.id) ?? { efetivos: 0, prestadores: 0, total: 0 };
        return {
          nome: s.nome,
          efetivos: c.efetivos,
          prestadores: c.prestadores,
          total: c.total,
        };
      })
      .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, "pt-BR"));
    return {
      unidade: u.sigla ? `${u.nome} (${u.sigla})` : u.nome,
      setores: lista,
    };
  });

  return {
    total,
    ativos,
    disponivel,
    efetivosAtivos,
    prestadoresAtivos: prestadoresServicoAtivos + comissionadosAtivos + terceirizadosAtivos,
    prestadoresServicoAtivos,
    comissionadosAtivos,
    terceirizadosAtivos,
    foraDeEscala,
    foraDosAtivos: total - ativos,
    porStatus,
    unidades: listaUnidades,
    cargos,
    medicos,
    afastamentos,
    afastamentosPorUnidade,
    afastamentosPorSetor,
    cruzamento,
    setoresPorUnidade,
  };
}
