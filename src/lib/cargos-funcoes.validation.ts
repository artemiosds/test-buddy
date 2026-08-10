import { z } from 'zod';

export const NIVEIS_CARGO = ['fundamental', 'medio', 'tecnico', 'superior', 'pos_graduacao'] as const;
export type NivelCargo = (typeof NIVEIS_CARGO)[number];

export const AREAS_PROFISSIONAIS = [
  'Saúde',
  'Administrativa',
  'Logística',
  'Operacional',
  'Educação',
  'Outros'
] as const;
export type AreaProfissional = (typeof AREAS_PROFISSIONAIS)[number];

export const cargoFormSchema = z.object({
  nome: z.string()
    .min(3, 'Nome deve ter no mínimo 3 caracteres')
    .max(100, 'Nome deve ter no máximo 100 caracteres'),
  codigo: z.string()
    .max(20, 'Código deve ter no máximo 20 caracteres')
    .optional()
    .nullable()
    .transform(val => val || null),
  cbo: z.string()
    .optional()
    .nullable()
    .refine(val => !val || /^\d{6}$/.test(val), 'CBO deve conter exatamente 6 dígitos numéricos')
    .transform(val => val || null),
  nivel: z.enum(['fundamental', 'medio', 'tecnico', 'superior', 'pos_graduacao']).nullable(),
  area_profissional: z.enum(['Saúde', 'Administrativa', 'Logística', 'Operacional', 'Educação', 'Outros']).nullable(),
  exige_conselho: z.boolean().default(false),
});

export const funcaoFormSchema = z.object({
  nome: z.string()
    .min(3, 'Nome deve ter no mínimo 3 caracteres')
    .max(100, 'Nome deve ter no máximo 100 caracteres'),
  codigo: z.string()
    .max(20, 'Código deve ter no máximo 20 caracteres')
    .optional()
    .nullable()
    .transform(val => val || null),
  cargo_id: z.string().uuid('Cargo inválido').nullable(),
  gratificacao_percentual: z.coerce.number()
    .min(0, 'Gratificação mínima 0%')
    .max(100, 'Gratificação máxima 100%')
    .nullable()
    .optional()
    .transform(val => val === 0 ? 0 : val || null),
});

export type CargoFormData = z.infer<typeof cargoFormSchema>;
export type FuncaoFormData = z.infer<typeof funcaoFormSchema>;
