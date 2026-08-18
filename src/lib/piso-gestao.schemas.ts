import { z } from "zod";

export const ListInput = z.object({
  competencia: z.string().nullable().optional(),
  categoria: z.string().nullable().optional(),
  unidade_id: z.string().nullable().optional(),
  cargo_id: z.string().nullable().optional(),
  vinculo_id: z.string().nullable().optional(),
  situacao: z.string().nullable().optional(),
  cpf: z.string().nullable().optional(),
  statusImportacao: z.enum(["todos", "importado", "pendente", "divergente"]).default("todos"),
  busca: z.string().nullable().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(500).default(25),
});

export const ValoresSchema = z.object({
  salario_base: z.number().nullable().optional(),
  insalubridade: z.number().nullable().optional(),
  auxilio_financeiro: z.number().nullable().optional(),
  tempo_servico: z.number().nullable().optional(),
  hora_extra_50: z.number().nullable().optional(),
  hora_extra_100: z.number().nullable().optional(),
  plantao: z.number().nullable().optional(),
  sobreaviso: z.number().nullable().optional(),
  gratificacoes: z.number().nullable().optional(),
  vale_transporte: z.number().nullable().optional(),
  inss: z.number().nullable().optional(),
  irrf: z.number().nullable().optional(),
  total_descontos: z.number().nullable().optional(),
  total_proventos: z.number().nullable().optional(),
  valor_liquido: z.number().nullable().optional(),
});

export const ConsolidarInput = z.object({
  historico_id: z.string().uuid(),
  competencia: z.string().min(1),
  tipo: z.enum(["piso", "fopag"]),
  origem_arquivo: z.string().min(1),
  layout_versao: z.string().nullable().optional(),
  linhas: z
    .array(
      ValoresSchema.extend({
        cpf: z.string().nullable().optional(),
        nome: z.string().nullable().optional(),
        matricula: z.string().nullable().optional(),
        profissional_id: z.string().uuid().nullable().optional(),
      }),
    )
    .max(500),
});
