import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Lista simplificada (com joins nominais) usada pelo Gerador Corporativo.
 *  Uma única query, cacheada, respeitando RLS. */
export function useProfissionaisLista() {
  return useQuery({
    queryKey: ["prof-lista-relatorio-inteligente"],
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profissionais")
        .select(
          "id, nome_completo, cpf, matricula, sexo, data_nascimento, data_admissao, telefone, email, carga_horaria_semanal, status, unidade:unidade_id(nome), setor:setor_id(nome), cargo:cargo_id(nome), funcao:funcao_id(nome), vinculo:vinculo_id(nome)",
        )
        .is("deleted_at", null)
        .order("nome_completo", { ascending: true })
        .limit(5000);
      if (error) throw error;
      type Named = { nome: string | null } | null;
      return (data ?? []).map((r: Record<string, unknown>) => ({
        nome_completo: (r.nome_completo as string) ?? "",
        cpf: (r.cpf as string) ?? "",
        matricula: (r.matricula as string) ?? "",
        sexo: (r.sexo as string) ?? "",
        data_nascimento: (r.data_nascimento as string) ?? "",
        data_admissao: (r.data_admissao as string) ?? "",
        telefone: (r.telefone as string) ?? "",
        email: (r.email as string) ?? "",
        carga_horaria_semanal: (r.carga_horaria_semanal as number) ?? 0,
        status: (r.status as string) ?? "",
        unidade: (r.unidade as Named)?.nome ?? "",
        setor: (r.setor as Named)?.nome ?? "",
        cargo: (r.cargo as Named)?.nome ?? "",
        funcao: (r.funcao as Named)?.nome ?? "",
        vinculo: (r.vinculo as Named)?.nome ?? "",
      }));
    },
  });
}
