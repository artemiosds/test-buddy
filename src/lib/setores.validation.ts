import { z } from 'zod'

export const TIPOS_SETOR = ['Administrativo', 'Assistencial', 'Logística'] as const
type TipoSetor = typeof TIPOS_SETOR[number]

export const setorFormSchema = z.object({
  nome: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres'),
  sigla: z.string().max(20, 'Sigla máximo 20 caracteres').optional().nullable(),
  tipo: z.string().refine((val) => (TIPOS_SETOR as readonly string[]).includes(val), {
    message: 'Selecione um tipo válido'
  }),
  cnes: z.string()
    .refine(val => !val || /^\d+$/.test(val), 'CNES deve conter apenas dígitos')
    .refine(val => !val || val.length === 7, 'CNES deve ter 7 dígitos')
    .optional()
    .nullable(),
  cnpj: z.string()
    .refine(val => !val || /^\d+$/.test(val), 'CNPJ deve conter apenas dígitos')
    .refine(val => !val || val.length === 14, 'CNPJ deve ter 14 dígitos')
    .optional()
    .nullable(),
  endereco: z.string().optional().nullable(),
  gestor_id: z.string().uuid('Gestor inválido').optional().nullable().or(z.literal('')),
  observacoes: z.string().optional().nullable(),
})

export type SetorFormData = z.infer<typeof setorFormSchema>

