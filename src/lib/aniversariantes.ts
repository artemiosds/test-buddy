/** Cálculo puro de aniversários (sem fuso: usa só dia/mês da string YYYY-MM-DD). */
export interface PessoaAniv {
  id: string;
  nome: string;
  data_nascimento: string | null;
  cargo?: string | null;
  setor?: string | null;
  unidade?: string | null;
}
export interface Aniversariante extends PessoaAniv {
  dia: number;
  mes: number;
  emDias: number;
}

export function parseDiaMes(data: string | null | undefined): { dia: number; mes: number } | null {
  if (!data) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(data);
  if (!m) return null;
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  return { dia, mes };
}

/** Dias até o próximo aniversário a partir de `hoje` (data local). 29/02 vira 28/02 em anos não bissextos. */
export function diasAteAniversario(dia: number, mes: number, hoje: Date): number {
  const base = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const alvo = (ano: number) => {
    const ultimo = new Date(ano, mes, 0).getDate();
    return new Date(ano, mes - 1, Math.min(dia, ultimo));
  };
  let d = alvo(base.getFullYear());
  if (d < base) d = alvo(base.getFullYear() + 1);
  return Math.round((d.getTime() - base.getTime()) / 86400000);
}

export function calcularAniversariantes(pessoas: PessoaAniv[], hoje: Date = new Date()) {
  const lista: Aniversariante[] = [];
  for (const p of pessoas) {
    const dm = parseDiaMes(p.data_nascimento);
    if (!dm) continue;
    lista.push({ ...p, ...dm, emDias: diasAteAniversario(dm.dia, dm.mes, hoje) });
  }
  const ord = (a: Aniversariante, b: Aniversariante) => a.emDias - b.emDias || a.nome.localeCompare(b.nome);
  const mesAtual = hoje.getMonth() + 1;
  return {
    hoje: lista.filter((a) => a.emDias === 0).sort(ord),
    proximos: lista.filter((a) => a.emDias >= 1 && a.emDias <= 7).sort(ord),
    mes: lista.filter((a) => a.mes === mesAtual).sort((a, b) => a.dia - b.dia || a.nome.localeCompare(b.nome)),
  };
}

export function rotuloEmDias(a: { emDias: number; dia: number; mes: number }): string {
  if (a.emDias === 0) return "Hoje";
  if (a.emDias === 1) return "Amanhã";
  return `Em ${a.emDias} dias · ${String(a.dia).padStart(2, "0")}/${String(a.mes).padStart(2, "0")}`;
}
