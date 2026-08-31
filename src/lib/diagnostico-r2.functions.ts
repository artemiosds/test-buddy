import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensureMaster } from "./authz.server";
import {
  chaveR2,
  criarUrlLeitura,
  criarUrlUpload,
  isCaminhoR2,
  objetoExisteR2,
  providerConfigurado,
  r2Disponivel,
  removerArquivo,
} from "./storage-r2.server";

export type EtapaDiagnostico = {
  etapa: string;
  ok: boolean;
  detalhe: string;
};

export type AnexoAusente = {
  id: string;
  nome: string;
  tipo_entidade: string;
  entidade_id: string | null;
  created_at: string;
  storage_path: string;
};

/**
 * Diagnóstico do armazenamento no Cloudflare R2 (somente Administrador Master).
 *
 * 1. Faz um ciclo completo PUT assinado -> HEAD -> GET assinado -> DELETE com um
 *    arquivo descartável, provando que gravação e leitura funcionam de ponta a ponta.
 * 2. Audita todos os anexos ATIVOS gravados no R2 e aponta os que perderam o
 *    binário (que seriam exibidos como "Arquivo indisponível" em Aprovações).
 */
export const diagnosticarR2 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await ensureMaster(supabase, userId);

    const etapas: EtapaDiagnostico[] = [];
    const provider = providerConfigurado();
    const disponivel = r2Disponivel();

    etapas.push({
      etapa: "Configuração",
      ok: disponivel,
      detalhe: disponivel
        ? `Provider "${provider}" ativo com todas as credenciais presentes.`
        : `Provider "${provider}" — credenciais do R2 ausentes; novos uploads cairiam no Supabase Storage.`,
    });

    if (disponivel) {
      const chave = `diagnostico/health-${crypto.randomUUID()}.txt`;
      const conteudo = `hsm-gestao diagnostico ${new Date().toISOString()}`;
      let gravou = false;
      try {
        const urlPut = await criarUrlUpload(chave, "text/plain");
        const put = await fetch(urlPut, {
          method: "PUT",
          headers: { "content-type": "text/plain" },
          body: conteudo,
        });
        gravou = put.ok;
        etapas.push({
          etapa: "Gravação (PUT assinado)",
          ok: put.ok,
          detalhe: put.ok ? "Arquivo de teste enviado ao bucket." : `HTTP ${put.status}.`,
        });

        const existe = await objetoExisteR2(chave);
        etapas.push({
          etapa: "Confirmação (HEAD)",
          ok: existe,
          detalhe: existe ? "Objeto localizado no bucket." : "Objeto não encontrado após o envio.",
        });

        const urlGet = await criarUrlLeitura(chave, 60);
        const get = urlGet ? await fetch(urlGet) : null;
        const texto = get?.ok ? await get.text() : "";
        const leituraOk = !!get?.ok && texto === conteudo;
        etapas.push({
          etapa: "Leitura (URL assinada)",
          ok: leituraOk,
          detalhe: leituraOk
            ? "Download conferido byte a byte com o enviado."
            : `Falha ao ler o arquivo de teste (HTTP ${get?.status ?? "sem resposta"}).`,
        });
      } catch (e) {
        etapas.push({
          etapa: "Ciclo de teste",
          ok: false,
          detalhe: (e as Error)?.message ?? "Erro desconhecido.",
        });
      } finally {
        if (gravou) {
          const apagou = await removerArquivo(chave);
          etapas.push({
            etapa: "Limpeza (DELETE)",
            ok: apagou,
            detalhe: apagou
              ? "Arquivo de teste removido do bucket."
              : "Não foi possível remover o arquivo de teste.",
          });
        }
      }
    }

    // Auditoria dos anexos ativos gravados no R2.
    const { data: docs, error } = await supabase
      .from("documentos")
      .select("id, nome, tipo_entidade, entidade_id, storage_path, created_at")
      .is("deleted_at", null)
      .like("storage_path", "r2:%")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);

    const linhas = (docs ?? []) as AnexoAusente[];
    const verificados = await Promise.all(
      linhas.map(async (d) => ({
        doc: d,
        existe: isCaminhoR2(d.storage_path) ? await objetoExisteR2(chaveR2(d.storage_path)) : true,
      })),
    );
    const ausentes = verificados.filter((v) => !v.existe).map((v) => v.doc);

    return {
      provider,
      r2_ativo: disponivel,
      etapas,
      total_anexos_r2: linhas.length,
      ausentes,
      tudo_ok: etapas.every((e) => e.ok) && ausentes.length === 0,
    };
  });
