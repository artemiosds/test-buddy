import { z } from "zod";

/** Campos numéricos/data: "" precisa virar null (Postgres rejeita string vazia). */
const emptyToNull = z
  .union([z.string(), z.number(), z.null()])
  .optional()
  .transform((val) => {
    if (val === null || val === undefined) return null;
    if (typeof val === "number") return val;
    const trimmed = val.trim();
    return trimmed === "" ? null : trimmed;
  });

/** Campos ENUM opcionais: "" precisa virar null (Postgres rejeita "" em enum). */
const enumEmptyToNull = z
  .union([z.string(), z.null()])
  .optional()
  .transform((val) => {
    if (val === null || val === undefined) return null;
    const trimmed = val.trim();
    return trimmed === "" ? null : trimmed;
  });

export const profissionalSchema = z.object({
  id: z.string().uuid().nullish().or(z.literal("")).transform(val => val === "" ? null : val),
  nome_completo: z.string().min(1, "Nome é obrigatório"),
  nome_social: z.string().nullish().default(""),
  // CHECK exige 11 dígitos — "" precisa virar null
  cpf: enumEmptyToNull,
  matricula: z.string().nullish().default(""),
  email: z.string().email("E-mail inválido").nullish().or(z.literal("")).default(""),
  telefone: z.string().nullish().default(""),
  data_nascimento: emptyToNull,
  // CHECK aceita apenas M/F/O — "" precisa virar null
  sexo: enumEmptyToNull,
  data_admissao: emptyToNull,
  carga_horaria_semanal: emptyToNull,
  // ENUM NOT NULL no banco (status_profissional): nunca enviar "" — cai para "ativo".
  status: z
    .union([z.string(), z.null()])
    .optional()
    .transform((v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : "ativo")),
  observacoes: z.string().nullish().default(""),
  secretaria_id: z.string().uuid().min(1, "Secretaria é obrigatória"),
  unidade_id: z.string().uuid().nullish().or(z.literal("")).transform(val => val === "" ? null : val),
  setor_id: z.string().uuid().nullish().or(z.literal("")).transform(val => val === "" ? null : val),
  cargo_id: z.string().uuid().nullish().or(z.literal("")).transform(val => val === "" ? null : val),
  funcao_id: z.string().uuid().nullish().or(z.literal("")).transform(val => val === "" ? null : val),
  vinculo_id: z.string().uuid().nullish().or(z.literal("")).transform(val => val === "" ? null : val),
  cep: z.string().nullish().default(""),
  logradouro: z.string().nullish().default(""),
  numero: z.string().nullish().default(""),
  bairro: z.string().nullish().default(""),
  cidade: z.string().nullish().default(""),
  uf: z.string().nullish().default(""),
  banco: z.string().nullish().default(""),
  agencia: z.string().nullish().default(""),
  conta_corrente: z.string().nullish().default(""),
  proj: emptyToNull,
  h_p: emptyToNull,
  c_h: emptyToNull,
  jorn: emptyToNull,
  conselho_classe: z.string().nullish().default(""),
  conselho_numero: z.string().nullish().default(""),
  conselho_uf: z.string().nullish().default(""),
  conselho_validade: emptyToNull,
  gestor_imediato_id: z.string().uuid().nullish().or(z.literal("")).transform(val => val === "" ? null : val),
  // ENUM nullable no banco (situacao_funcional)
  situacao_funcional: enumEmptyToNull,
  situacao_data_inicio: emptyToNull,
  situacao_data_fim: emptyToNull,
  foto_url: z.string().nullish().default(""),
});

export type ProfissionalFormValues = z.infer<typeof profissionalSchema>;
