/**
 * Achados e pontos de controle — detecção automática sobre a trilha de auditoria.
 * Regras objetivas, sem heurística obscura: cada achado aponta a evidência que o gerou.
 */

export type NivelAchado = "alto" | "medio" | "informativo";

export type Achado = {
  nivel: NivelAchado;
  titulo: string;
  detalhe: string;
  ocorrencias: number;
};

export type LinhaTrilha = {
  ocorrido_em: string;
  operacao: string;
  tabela: string;
  registro_id: string | null;
  usuario_id: string | null;
  usuario_email: string | null;
  ip: string | null;
};

const HORA_INICIO_COMERCIAL = 7;
const HORA_FIM_COMERCIAL = 19;

function horaLocal(iso: string): { hora: number; diaSemana: number } {
  const d = new Date(iso);
  return { hora: d.getHours(), diaSemana: d.getDay() };
}

/** Avalia a trilha e devolve os achados. Lista vazia = nenhum achado identificado. */
export function detectarAchados(linhas: LinhaTrilha[]): Achado[] {
  const achados: Achado[] = [];
  if (!linhas.length) return achados;

  // 1. Ações sem autoria identificável
  const semAutor = linhas.filter((l) => !l.usuario_id);
  if (semAutor.length) {
    achados.push({
      nivel: "alto",
      titulo: "Operações sem autoria identificável",
      detalhe:
        "Existem registros sem usuário autenticado associado. Toda alteração deve ter autor rastreável; verificar rotinas automáticas ou acessos com chave de serviço.",
      ocorrencias: semAutor.length,
    });
  }

  // 2. Alterações fora do horário comercial ou em fim de semana
  const foraHorario = linhas.filter((l) => {
    if (!["insert", "update", "delete"].includes(l.operacao)) return false;
    const { hora, diaSemana } = horaLocal(l.ocorrido_em);
    return hora < HORA_INICIO_COMERCIAL || hora >= HORA_FIM_COMERCIAL || diaSemana === 0 || diaSemana === 6;
  });
  if (foraHorario.length) {
    achados.push({
      nivel: "medio",
      titulo: "Alterações fora do horário comercial",
      detalhe:
        "Gravações registradas antes das 07h, após as 19h ou em fim de semana. Confirmar se houve autorização para o expediente extraordinário.",
      ocorrencias: foraHorario.length,
    });
  }

  // 3. Exclusões de registros
  const exclusoes = linhas.filter((l) => l.operacao === "delete");
  if (exclusoes.length) {
    achados.push({
      nivel: "alto",
      titulo: "Exclusões de registros",
      detalhe:
        "Foram identificadas exclusões definitivas na base. Cada exclusão deve ter justificativa formal do responsável.",
      ocorrencias: exclusoes.length,
    });
  }

  // 4. Registros sem IP de origem
  const semIp = linhas.filter((l) => !l.ip);
  if (semIp.length) {
    achados.push({
      nivel: "informativo",
      titulo: "Registros sem IP de origem",
      detalhe:
        "Operações gravadas antes da captura de IP ou originadas em rotinas internas do servidor. Não há prejuízo de autoria, apenas de origem de rede.",
      ocorrencias: semIp.length,
    });
  }

  // 5. Concentração incomum de alterações no mesmo registro por um mesmo usuário
  const porChave = new Map<string, number>();
  for (const l of linhas) {
    if (l.operacao !== "update" || !l.registro_id) continue;
    const k = `${l.usuario_id ?? "?"}|${l.tabela}|${l.registro_id}`;
    porChave.set(k, (porChave.get(k) ?? 0) + 1);
  }
  const repetidos = Array.from(porChave.values()).filter((n) => n >= 20).length;
  if (repetidos) {
    achados.push({
      nivel: "medio",
      titulo: "Reincidência elevada de edições no mesmo registro",
      detalhe:
        "Há registros com 20 ou mais atualizações pelo mesmo usuário. Pode indicar retrabalho, correção sucessiva de dados ou tentativa de ajuste após conferência.",
      ocorrencias: repetidos,
    });
  }

  // 6. Múltiplos IPs para o mesmo usuário no período
  const ipsPorUsuario = new Map<string, Set<string>>();
  for (const l of linhas) {
    if (!l.usuario_id || !l.ip) continue;
    const s = ipsPorUsuario.get(l.usuario_id) ?? new Set<string>();
    s.add(l.ip);
    ipsPorUsuario.set(l.usuario_id, s);
  }
  const multiIp = Array.from(ipsPorUsuario.values()).filter((s) => s.size >= 3).length;
  if (multiIp) {
    achados.push({
      nivel: "medio",
      titulo: "Mesmo usuário operando de várias origens de rede",
      detalhe:
        "Usuários com três ou mais IPs distintos no período. Confirmar se corresponde a uso legítimo (unidade, domicílio, rede móvel).",
      ocorrencias: multiIp,
    });
  }

  return achados;
}

export const TEXTO_SEM_ACHADOS =
  "Nenhum achado identificado nesta auditoria: no período analisado não foram detectadas operações sem autoria, exclusões definitivas, alterações fora do horário comercial ou inconsistências de origem de rede.";
