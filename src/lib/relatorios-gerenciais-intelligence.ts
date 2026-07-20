/**
 * Sublote 13 — Inteligência para Relatórios Gerenciais.
 *
 * Este módulo NÃO altera nenhuma regra de negócio, banco, API ou cálculo
 * existente. Ele apenas ORQUESTRA leituras já disponíveis (client + RLS)
 * e produz derivações prontas para o front (KPIs, distribuições, rankings,
 * qualidade cadastral, alertas, semáforo e resumo executivo).
 *
 * Todas as reports gerenciais consomem `getGerencialAggregate()` via
 * React Query com uma única chave — reaproveitando o cache entre páginas.
 */
import { supabase } from "@/integrations/supabase/client";

export type Semaforo = "verde" | "amarelo" | "vermelho";

export type Alerta = {
  id: string;
  gravidade: Semaforo;
  titulo: string;
  detalhe: string;
  quantidade?: number;
};

export type QualityMetric = {
  chave: string;
  rotulo: string;
  percentual: number; // 0..100
  ok: number;
  total: number;
};

export type Comparativo = {
  chave: string;
  rotulo: string;
  atual: number;
  anterior: number;
  delta: number;
  deltaPct: number | null;
};

export type Ranking = {
  chave: string;
  titulo: string;
  itens: { nome: string; valor: number; extra?: string }[];
};

export type GerencialAggregate = {
  geradoEm: string;
  totais: {
    profissionais: number;
    unidades: number;
    setores: number;
    cargos: number;
    funcoes: number;
    vinculos: number;
    unidadesAtivas: number;
    unidadesInativas: number;
    setoresAtivos: number;
  };
  status: Record<string, number>; // ativo/afastado/ferias/licenciado/inativo/...
  // Contagens de "sem X"
  pendencias: {
    semUnidade: number;
    semSetor: number;
    semCargo: number;
    semFuncao: number;
    semMatricula: number;
    semCpf: number;
    semTelefone: number;
    semEmail: number;
    semNascimento: number;
    semCargaHoraria: number;
  };
  unidadesPend: {
    semDiretor: number;
    semCnes: number;
    semCnpj: number;
    semTelefone: number;
    semEmail: number;
    semTipo: number;
    semProfissionais: number;
  };
  setoresPend: {
    semCoordenador: number;
    semProfissionais: number;
    umServidor: number;
  };
  distribuicoes: {
    porVinculo: { nome: string; qtd: number }[];
    porStatus: { nome: string; qtd: number }[];
    porSexo: { nome: string; qtd: number }[];
    porFaixaEtaria: { nome: string; qtd: number }[];
    porUnidade: { nome: string; qtd: number }[];
    porSetor: { nome: string; qtd: number }[];
    porCargo: { nome: string; qtd: number }[];
    porFuncao: { nome: string; qtd: number }[];
    porTipoUnidade: { nome: string; qtd: number }[];
    porPorte: { nome: string; qtd: number }[]; // porte por # profissionais
    porTempoServico: { nome: string; qtd: number }[];
    porSecretaria: { nome: string; qtd: number }[];
  };
  rankings: {
    maioresUnidades: { nome: string; valor: number }[];
    menoresUnidades: { nome: string; valor: number }[];
    maioresSetores: { nome: string; valor: number }[];
    menoresSetores: { nome: string; valor: number }[];
    cargosMaisUtilizados: { nome: string; valor: number }[];
    funcoesMaisUtilizadas: { nome: string; valor: number }[];
    unidadesMaisAfastados: { nome: string; valor: number }[];
    unidadesMaisFerias: { nome: string; valor: number }[];
  };
  comparativos: Comparativo[];
  qualidade: {
    metricas: QualityMetric[];
    integridadeCadastral: number; // média das métricas de cadastro
    coberturaResponsaveis: number; // % unidades c/ diretor + setores c/ coord
    estruturaOrganizacional: number; // % setores com >=1 profissional
    lotacao: number; // % profissionais com unidade+setor
    geral: number; // média ponderada
  };
  semaforo: {
    global: Semaforo;
    itens: { chave: string; rotulo: string; nivel: Semaforo; motivo: string }[];
  };
  alertas: Alerta[];
  resumoExecutivo: string[]; // frases prontas para o secretário
  // Auditoria (últimos 30 dias)
  auditoria: {
    totalEventos: number;
    porOperacao: { nome: string; qtd: number }[];
    porTabela: { nome: string; qtd: number }[];
    porUsuario: { nome: string; qtd: number }[];
    porDia: { dia: string; qtd: number }[];
    porHora: { hora: string; qtd: number }[];
  };
};

function group<T>(rows: T[], key: (r: T) => string | null | undefined) {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = key(r) ?? "—";
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return Array.from(m.entries())
    .map(([nome, qtd]) => ({ nome, qtd }))
    .sort((a, b) => b.qtd - a.qtd);
}

function pct(n: number, d: number) {
  if (!d) return 0;
  return Math.round((n / d) * 1000) / 10;
}

function faixaEtaria(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const age = Math.floor((Date.now() - d.getTime()) / (365.25 * 86400_000));
  if (age < 25) return "< 25";
  if (age < 35) return "25–34";
  if (age < 45) return "35–44";
  if (age < 55) return "45–54";
  if (age < 65) return "55–64";
  return "65+";
}

function tempoServico(iso: string | null): string {
  if (!iso) return "Sem admissão";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "Sem admissão";
  const anos = (Date.now() - d.getTime()) / (365.25 * 86400_000);
  if (anos < 1) return "< 1 ano";
  if (anos < 5) return "1–4 anos";
  if (anos < 10) return "5–9 anos";
  if (anos < 20) return "10–19 anos";
  if (anos < 30) return "20–29 anos";
  return "30+ anos";
}

function porte(qtd: number): string {
  if (qtd === 0) return "Vazias";
  if (qtd < 10) return "Pequenas (<10)";
  if (qtd < 30) return "Médias (10–29)";
  if (qtd < 100) return "Grandes (30–99)";
  return "Muito grandes (100+)";
}

export async function getGerencialAggregate(): Promise<GerencialAggregate> {
  const [
    profRes, uRes, sRes, cRes, fRes, vRes, secRes, tuRes, auditNow, auditPrev,
  ] = await Promise.all([
    supabase.from("profissionais").select(
      "id, sexo, data_nascimento, data_admissao, status, secretaria_id, unidade_id, setor_id, cargo_id, funcao_id, vinculo_id, cpf, matricula, telefone, email, carga_horaria_semanal",
    ).is("deleted_at", null),
    supabase.from("unidades").select(
      "id, nome, sigla, tipo_unidade, status, cnes, cnpj, telefone, email_institucional, responsavel_nome",
    ).is("deleted_at", null),
    supabase.from("setores").select("id, nome, unidade_id, status, responsavel_nome").is("deleted_at", null),
    supabase.from("cargos").select("id, nome").is("deleted_at", null),
    supabase.from("funcoes").select("id, nome").is("deleted_at", null),
    supabase.from("vinculos").select("id, nome").is("deleted_at", null),
    supabase.from("secretarias").select("id, nome").is("deleted_at", null),
    supabase.from("tipos_unidade").select("id, nome").is("deleted_at", null),
    supabase.from("audit_log").select("id, ocorrido_em, operacao, tabela, usuario_email")
      .gte("ocorrido_em", new Date(Date.now() - 30 * 86400_000).toISOString())
      .order("ocorrido_em", { ascending: false })
      .limit(5000),
    supabase.from("audit_log").select("id", { count: "exact", head: true })
      .gte("ocorrido_em", new Date(Date.now() - 60 * 86400_000).toISOString())
      .lt("ocorrido_em", new Date(Date.now() - 30 * 86400_000).toISOString()),
  ]);

  if (profRes.error) throw profRes.error;
  if (uRes.error) throw uRes.error;
  if (sRes.error) throw sRes.error;

  const profs = (profRes.data ?? []) as Array<{
    id: string; sexo: string | null; data_nascimento: string | null; data_admissao: string | null;
    status: string | null; secretaria_id: string | null; unidade_id: string | null; setor_id: string | null;
    cargo_id: string | null; funcao_id: string | null; vinculo_id: string | null;
    cpf: string | null; matricula: string | null; telefone: string | null; email: string | null;
    carga_horaria_semanal: number | null;
  }>;
  const unidades = uRes.data ?? [];
  const setores = sRes.data ?? [];

  const mapN = (arr: { id: string; nome: string }[] | null) =>
    (arr ?? []).reduce<Record<string, string>>((a, r) => ((a[r.id] = r.nome), a), {});
  const mU = mapN(unidades);
  const mS = mapN(setores);
  const mC = mapN(cRes.data);
  const mF = mapN(fRes.data);
  const mV = mapN(vRes.data);
  const mSec = mapN(secRes.data);

  const total = profs.length;

  const status: Record<string, number> = {};
  for (const p of profs) status[p.status ?? "—"] = (status[p.status ?? "—"] ?? 0) + 1;

  const isEmpty = (v: string | null) => !v || !v.trim();

  const pendencias = {
    semUnidade: profs.filter((p) => !p.unidade_id).length,
    semSetor: profs.filter((p) => !p.setor_id).length,
    semCargo: profs.filter((p) => !p.cargo_id).length,
    semFuncao: profs.filter((p) => !p.funcao_id).length,
    semMatricula: profs.filter((p) => isEmpty(p.matricula)).length,
    semCpf: profs.filter((p) => isEmpty(p.cpf)).length,
    semTelefone: profs.filter((p) => isEmpty(p.telefone)).length,
    semEmail: profs.filter((p) => isEmpty(p.email)).length,
    semNascimento: profs.filter((p) => !p.data_nascimento).length,
    semCargaHoraria: profs.filter((p) => !p.carga_horaria_semanal).length,
  };

  // Contagens por unidade/setor
  const profPorUnidade = new Map<string, number>();
  const profAtivoPorUnidade = new Map<string, number>();
  const profAfastPorUnidade = new Map<string, number>();
  const profFeriasPorUnidade = new Map<string, number>();
  const profPorSetor = new Map<string, number>();
  for (const p of profs) {
    if (p.unidade_id) profPorUnidade.set(p.unidade_id, (profPorUnidade.get(p.unidade_id) ?? 0) + 1);
    if (p.unidade_id && p.status === "ativo") profAtivoPorUnidade.set(p.unidade_id, (profAtivoPorUnidade.get(p.unidade_id) ?? 0) + 1);
    if (p.unidade_id && p.status === "afastado") profAfastPorUnidade.set(p.unidade_id, (profAfastPorUnidade.get(p.unidade_id) ?? 0) + 1);
    if (p.unidade_id && p.status === "ferias") profFeriasPorUnidade.set(p.unidade_id, (profFeriasPorUnidade.get(p.unidade_id) ?? 0) + 1);
    if (p.setor_id) profPorSetor.set(p.setor_id, (profPorSetor.get(p.setor_id) ?? 0) + 1);
  }

  const unidadesPend = {
    semDiretor: unidades.filter((u) => !u.responsavel_nome).length,
    semCnes: unidades.filter((u) => !u.cnes).length,
    semCnpj: unidades.filter((u) => !u.cnpj).length,
    semTelefone: unidades.filter((u) => !u.telefone).length,
    semEmail: unidades.filter((u) => !u.email_institucional).length,
    semTipo: unidades.filter((u) => !u.tipo_unidade).length,
    semProfissionais: unidades.filter((u) => (profPorUnidade.get(u.id) ?? 0) === 0).length,
  };
  const unidadesAtivas = unidades.filter((u) => u.status === "ativa").length;
  const unidadesInativas = unidades.length - unidadesAtivas;

  const setoresPend = {
    semCoordenador: setores.filter((s) => !s.responsavel_nome).length,
    semProfissionais: setores.filter((s) => (profPorSetor.get(s.id) ?? 0) === 0).length,
    umServidor: setores.filter((s) => (profPorSetor.get(s.id) ?? 0) === 1).length,
  };
  const setoresAtivos = setores.filter((s) => s.status === "ativo").length;

  // Distribuições
  const porUnidade = group(profs, (p) => (p.unidade_id ? mU[p.unidade_id] ?? "—" : "Sem unidade"));
  const porSetor = group(profs, (p) => (p.setor_id ? mS[p.setor_id] ?? "—" : "Sem setor"));
  const porCargo = group(profs, (p) => (p.cargo_id ? mC[p.cargo_id] ?? "—" : "Sem cargo"));
  const porFuncao = group(profs, (p) => (p.funcao_id ? mF[p.funcao_id] ?? "—" : "Sem função"));
  const porVinculo = group(profs, (p) => (p.vinculo_id ? mV[p.vinculo_id] ?? "—" : "Sem vínculo"));
  const porSecretaria = group(profs, (p) => (p.secretaria_id ? mSec[p.secretaria_id] ?? "—" : "—"));
  const porTipoUnidade = group(unidades, (u) => u.tipo_unidade ?? "Sem tipo").map((r) => ({ nome: r.nome, qtd: r.qtd }));
  const porPorte = (() => {
    const arr = unidades.map((u) => porte(profPorUnidade.get(u.id) ?? 0));
    return group(arr, (n) => n);
  })();

  const distribuicoes = {
    porVinculo,
    porStatus: Object.entries(status).map(([nome, qtd]) => ({ nome, qtd })).sort((a, b) => b.qtd - a.qtd),
    porSexo: group(profs, (p) => p.sexo ?? "—"),
    porFaixaEtaria: group(profs, (p) => faixaEtaria(p.data_nascimento)),
    porUnidade: porUnidade.slice(0, 20),
    porSetor: porSetor.slice(0, 20),
    porCargo: porCargo.slice(0, 20),
    porFuncao: porFuncao.slice(0, 20),
    porTipoUnidade,
    porPorte,
    porTempoServico: group(profs, (p) => tempoServico(p.data_admissao)),
    porSecretaria,
  };

  // Rankings
  const rankings = {
    maioresUnidades: unidades
      .map((u) => ({ nome: u.nome, valor: profPorUnidade.get(u.id) ?? 0 }))
      .filter((r) => r.valor > 0)
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 10),
    menoresUnidades: unidades
      .map((u) => ({ nome: u.nome, valor: profPorUnidade.get(u.id) ?? 0 }))
      .filter((r) => r.valor > 0)
      .sort((a, b) => a.valor - b.valor)
      .slice(0, 10),
    maioresSetores: setores
      .map((s) => ({ nome: s.nome, valor: profPorSetor.get(s.id) ?? 0 }))
      .filter((r) => r.valor > 0)
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 10),
    menoresSetores: setores
      .map((s) => ({ nome: s.nome, valor: profPorSetor.get(s.id) ?? 0 }))
      .filter((r) => r.valor > 0)
      .sort((a, b) => a.valor - b.valor)
      .slice(0, 10),
    cargosMaisUtilizados: porCargo.slice(0, 10).map((r) => ({ nome: r.nome, valor: r.qtd })),
    funcoesMaisUtilizadas: porFuncao.slice(0, 10).map((r) => ({ nome: r.nome, valor: r.qtd })),
    unidadesMaisAfastados: unidades
      .map((u) => ({ nome: u.nome, valor: profAfastPorUnidade.get(u.id) ?? 0 }))
      .filter((r) => r.valor > 0).sort((a, b) => b.valor - a.valor).slice(0, 10),
    unidadesMaisFerias: unidades
      .map((u) => ({ nome: u.nome, valor: profFeriasPorUnidade.get(u.id) ?? 0 }))
      .filter((r) => r.valor > 0).sort((a, b) => b.valor - a.valor).slice(0, 10),
  };

  // Qualidade cadastral
  const metricas: QualityMetric[] = [
    { chave: "cpf", rotulo: "CPF preenchido", total, ok: total - pendencias.semCpf, percentual: pct(total - pendencias.semCpf, total) },
    { chave: "matricula", rotulo: "Matrícula preenchida", total, ok: total - pendencias.semMatricula, percentual: pct(total - pendencias.semMatricula, total) },
    { chave: "telefone", rotulo: "Telefone preenchido", total, ok: total - pendencias.semTelefone, percentual: pct(total - pendencias.semTelefone, total) },
    { chave: "email", rotulo: "E-mail preenchido", total, ok: total - pendencias.semEmail, percentual: pct(total - pendencias.semEmail, total) },
    { chave: "nascimento", rotulo: "Data de nascimento", total, ok: total - pendencias.semNascimento, percentual: pct(total - pendencias.semNascimento, total) },
    { chave: "carga", rotulo: "Carga horária", total, ok: total - pendencias.semCargaHoraria, percentual: pct(total - pendencias.semCargaHoraria, total) },
    { chave: "unidade", rotulo: "Lotação (unidade)", total, ok: total - pendencias.semUnidade, percentual: pct(total - pendencias.semUnidade, total) },
    { chave: "setor", rotulo: "Lotação (setor)", total, ok: total - pendencias.semSetor, percentual: pct(total - pendencias.semSetor, total) },
    { chave: "cargo", rotulo: "Cargo", total, ok: total - pendencias.semCargo, percentual: pct(total - pendencias.semCargo, total) },
  ];
  const integridadeCadastral = metricas.slice(0, 6).reduce((a, m) => a + m.percentual, 0) / 6;
  const lotacao = metricas.slice(6).reduce((a, m) => a + m.percentual, 0) / 3;
  const coberturaResponsaveis =
    unidades.length + setores.length === 0
      ? 100
      : pct(
          (unidades.length - unidadesPend.semDiretor) + (setores.length - setoresPend.semCoordenador),
          unidades.length + setores.length,
        );
  const estruturaOrganizacional = pct(setores.length - setoresPend.semProfissionais, Math.max(1, setores.length));
  const geralQ = Math.round(((integridadeCadastral + lotacao + coberturaResponsaveis + estruturaOrganizacional) / 4) * 10) / 10;

  // Comparativos (períodos e distribuições relativas)
  const auditPrevCount = auditPrev.count ?? 0;
  const auditNowCount = (auditNow.data ?? []).length;
  const comparativos: Comparativo[] = [
    { chave: "audit-30d", rotulo: "Auditoria 30d vs 30d anteriores", atual: auditNowCount, anterior: auditPrevCount, delta: auditNowCount - auditPrevCount, deltaPct: auditPrevCount ? pct(auditNowCount - auditPrevCount, auditPrevCount) : null },
    { chave: "ativos-vs-afast", rotulo: "Ativos vs Afastados", atual: status["ativo"] ?? 0, anterior: status["afastado"] ?? 0, delta: (status["ativo"] ?? 0) - (status["afastado"] ?? 0), deltaPct: null },
    { chave: "u-com-vs-sem-diretor", rotulo: "Unidades com vs sem Diretor", atual: unidades.length - unidadesPend.semDiretor, anterior: unidadesPend.semDiretor, delta: (unidades.length - unidadesPend.semDiretor) - unidadesPend.semDiretor, deltaPct: null },
    { chave: "s-com-vs-sem-coord", rotulo: "Setores com vs sem Coordenador", atual: setores.length - setoresPend.semCoordenador, anterior: setoresPend.semCoordenador, delta: (setores.length - setoresPend.semCoordenador) - setoresPend.semCoordenador, deltaPct: null },
    { chave: "cargos-ocup-vs-vazio", rotulo: "Cargos ocupados vs vagos", atual: (cRes.data ?? []).length - (cRes.data ?? []).filter((c) => !porCargo.find((x) => x.nome === c.nome && x.qtd > 0)).length, anterior: (cRes.data ?? []).filter((c) => !porCargo.find((x) => x.nome === c.nome && x.qtd > 0)).length, delta: 0, deltaPct: null },
  ];

  // Semáforo
  const semItens: { chave: string; rotulo: string; nivel: Semaforo; motivo: string }[] = [];
  const level = (n: number, a: number, c: number): Semaforo => (n >= c ? "vermelho" : n >= a ? "amarelo" : "verde");
  semItens.push({ chave: "diretor", rotulo: "Unidades sem Diretor", nivel: level(unidadesPend.semDiretor, 1, 5), motivo: `${unidadesPend.semDiretor} sem diretor` });
  semItens.push({ chave: "coord", rotulo: "Setores sem Coordenador", nivel: level(setoresPend.semCoordenador, 5, 20), motivo: `${setoresPend.semCoordenador} sem coordenador` });
  semItens.push({ chave: "lotacao", rotulo: "Profissionais sem lotação", nivel: level(pendencias.semUnidade, 5, 20), motivo: `${pendencias.semUnidade} sem unidade` });
  semItens.push({ chave: "cnes", rotulo: "Unidades sem CNES", nivel: level(unidadesPend.semCnes, 1, 5), motivo: `${unidadesPend.semCnes} sem CNES` });
  semItens.push({ chave: "cnpj", rotulo: "Unidades sem CNPJ", nivel: level(unidadesPend.semCnpj, 1, 5), motivo: `${unidadesPend.semCnpj} sem CNPJ` });
  semItens.push({ chave: "cad", rotulo: "Integridade cadastral", nivel: integridadeCadastral < 75 ? "vermelho" : integridadeCadastral < 90 ? "amarelo" : "verde", motivo: `${integridadeCadastral.toFixed(1)}%` });
  const globalSem: Semaforo = semItens.some((s) => s.nivel === "vermelho")
    ? "vermelho"
    : semItens.some((s) => s.nivel === "amarelo")
      ? "amarelo"
      : "verde";

  // Alertas
  const alertas: Alerta[] = [];
  if (unidadesPend.semDiretor) alertas.push({ id: "u-diretor", gravidade: unidadesPend.semDiretor >= 5 ? "vermelho" : "amarelo", titulo: "Unidades sem Diretor", detalhe: `${unidadesPend.semDiretor} unidade(s) sem responsável.`, quantidade: unidadesPend.semDiretor });
  if (setoresPend.semCoordenador) alertas.push({ id: "s-coord", gravidade: setoresPend.semCoordenador >= 20 ? "vermelho" : "amarelo", titulo: "Setores sem Coordenador", detalhe: `${setoresPend.semCoordenador} setor(es) sem coordenador.`, quantidade: setoresPend.semCoordenador });
  if (pendencias.semUnidade) alertas.push({ id: "p-unidade", gravidade: pendencias.semUnidade >= 20 ? "vermelho" : "amarelo", titulo: "Profissionais sem Lotação", detalhe: `${pendencias.semUnidade} profissional(is) sem unidade.`, quantidade: pendencias.semUnidade });
  if (pendencias.semCpf) alertas.push({ id: "p-cpf", gravidade: "vermelho", titulo: "Cadastros sem CPF", detalhe: `${pendencias.semCpf} profissional(is) sem CPF.`, quantidade: pendencias.semCpf });
  if (pendencias.semMatricula) alertas.push({ id: "p-mat", gravidade: "amarelo", titulo: "Sem Matrícula", detalhe: `${pendencias.semMatricula} profissional(is) sem matrícula.`, quantidade: pendencias.semMatricula });
  if (pendencias.semTelefone) alertas.push({ id: "p-tel", gravidade: "amarelo", titulo: "Sem Telefone", detalhe: `${pendencias.semTelefone} profissional(is) sem telefone.`, quantidade: pendencias.semTelefone });
  if (pendencias.semCargo) alertas.push({ id: "p-cargo", gravidade: "amarelo", titulo: "Sem Cargo", detalhe: `${pendencias.semCargo} profissional(is) sem cargo.`, quantidade: pendencias.semCargo });
  if (unidadesPend.semCnes) alertas.push({ id: "u-cnes", gravidade: "vermelho", titulo: "Unidades sem CNES", detalhe: `${unidadesPend.semCnes} unidade(s) sem CNES.`, quantidade: unidadesPend.semCnes });
  if (unidadesPend.semCnpj) alertas.push({ id: "u-cnpj", gravidade: "amarelo", titulo: "Unidades sem CNPJ", detalhe: `${unidadesPend.semCnpj} unidade(s) sem CNPJ.`, quantidade: unidadesPend.semCnpj });
  if (unidadesPend.semProfissionais) alertas.push({ id: "u-vazias", gravidade: "amarelo", titulo: "Unidades sem Profissionais", detalhe: `${unidadesPend.semProfissionais} unidade(s) sem lotação.`, quantidade: unidadesPend.semProfissionais });

  // Resumo executivo
  const topUn = rankings.maioresUnidades[0];
  const topCargo = rankings.cargosMaisUtilizados[0];
  const resumoExecutivo: string[] = [
    `A Secretaria conta com ${total.toLocaleString("pt-BR")} profissional(is), distribuídos em ${unidades.length} unidade(s) e ${setores.length} setor(es).`,
    `Ativos: ${(status["ativo"] ?? 0).toLocaleString("pt-BR")} (${pct(status["ativo"] ?? 0, total)}%). Afastados: ${(status["afastado"] ?? 0).toLocaleString("pt-BR")}. Férias: ${(status["ferias"] ?? 0).toLocaleString("pt-BR")}.`,
    topUn ? `Maior unidade: ${topUn.nome} com ${topUn.valor} profissional(is).` : "Sem unidades com lotação registrada.",
    topCargo ? `Cargo mais utilizado: ${topCargo.nome} (${topCargo.valor}).` : "",
    `Integridade cadastral: ${integridadeCadastral.toFixed(1)}% · Cobertura de responsáveis: ${coberturaResponsaveis.toFixed(1)}% · Índice geral de qualidade: ${geralQ}%.`,
    globalSem === "verde"
      ? "Semáforo executivo: VERDE — nenhum indicador crítico."
      : globalSem === "amarelo"
        ? "Semáforo executivo: AMARELO — há pontos de atenção listados nos alertas."
        : "Semáforo executivo: VERMELHO — há indicadores críticos que exigem ação imediata.",
  ].filter(Boolean);

  // Auditoria
  const auditRows = (auditNow.data ?? []) as Array<{ id: number; ocorrido_em: string; operacao: string; tabela: string; usuario_email: string | null }>;
  const porOperacao = group(auditRows, (r) => r.operacao);
  const porTabela = group(auditRows, (r) => r.tabela.replace(/^public\./, "")).slice(0, 10);
  const porUsuario = group(auditRows, (r) => r.usuario_email ?? "sistema").slice(0, 10);
  const porDiaMap = new Map<string, number>();
  const porHoraMap = new Map<string, number>();
  for (const r of auditRows) {
    const d = new Date(r.ocorrido_em);
    const dia = d.toISOString().slice(0, 10);
    const hora = String(d.getHours()).padStart(2, "0") + "h";
    porDiaMap.set(dia, (porDiaMap.get(dia) ?? 0) + 1);
    porHoraMap.set(hora, (porHoraMap.get(hora) ?? 0) + 1);
  }
  const porDia = Array.from(porDiaMap.entries())
    .map(([dia, qtd]) => ({ dia, qtd }))
    .sort((a, b) => a.dia.localeCompare(b.dia));
  const porHora = Array.from(porHoraMap.entries())
    .map(([hora, qtd]) => ({ hora, qtd }))
    .sort((a, b) => a.hora.localeCompare(b.hora));

  return {
    geradoEm: new Date().toISOString(),
    totais: {
      profissionais: total,
      unidades: unidades.length,
      setores: setores.length,
      cargos: (cRes.data ?? []).length,
      funcoes: (fRes.data ?? []).length,
      vinculos: (vRes.data ?? []).length,
      unidadesAtivas, unidadesInativas, setoresAtivos,
    },
    status, pendencias, unidadesPend, setoresPend, distribuicoes, rankings, comparativos,
    qualidade: {
      metricas,
      integridadeCadastral: Math.round(integridadeCadastral * 10) / 10,
      coberturaResponsaveis: Math.round(coberturaResponsaveis * 10) / 10,
      estruturaOrganizacional: Math.round(estruturaOrganizacional * 10) / 10,
      lotacao: Math.round(lotacao * 10) / 10,
      geral: geralQ,
    },
    semaforo: { global: globalSem, itens: semItens },
    alertas,
    resumoExecutivo,
    auditoria: {
      totalEventos: auditRows.length,
      porOperacao: porOperacao.map((r) => ({ nome: r.nome, qtd: r.qtd })),
      porTabela: porTabela.map((r) => ({ nome: r.nome, qtd: r.qtd })),
      porUsuario: porUsuario.map((r) => ({ nome: r.nome, qtd: r.qtd })),
      porDia, porHora,
    },
    // extras used elsewhere but not typed above
    ...(undefined as unknown as {}),
  };
}

// helper reused pelas exportações
export type { QualityMetric as QM };
// tipos suplementares (não expostos) — utilitário de gráficos
export const CHART_COLORS = ["#6366F1", "#10B981", "#F59E0B", "#EF4444", "#3B82F6", "#8B5CF6", "#EC4899", "#14B8A6", "#F97316", "#22D3EE", "#A855F7", "#84CC16"];
