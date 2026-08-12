# Plano de Unificação e Correção do Fluxo de Importação (Piso Enfermagem)

Este plano unifica os esquemas de importação de Excel e PDF, permitindo granularidade total de 21 campos (alinhado com a planilha oficial), reescreve o prompt da IA para normalização via dicionário fechado e corrige fórmulas de cálculo e visualização.

## Mudanças Técnicas

### 1. Schema de Dados (`src/lib/piso-mapping.ts` e `src/lib/piso-import.ts`)
- Adicionar novos campos ao `PisoDestino` e `NUMERIC_KEYS`: `ferias_normais`, `grat_funcao_vr`, `grat_funcao_pct`, `grat_nivel_superior`, `incentivos`, `aux_fin_piso`, `outros_descontos`, `adn_informativo`.
- Renomear ou mapear `iss` para `outros_descontos`.

### 2. Dicionário de Normalização e Prompt IA (`src/lib/piso-fopag-ia.functions.ts`)
- Reescrever o `PROMPT` para usar o dicionário de sinônimos fornecido.
- O novo JSON retornado pela IA terá a estrutura de 21 campos.
- **Novo Shape do JSON da IA:**
```json
{
  "competencia": "YYYY-MM",
  "funcionarios": [
    {
      "nome": { "valor": "NOME", "confidence": 0.98 },
      "cargo": { "valor": "CARGO", "confidence": 0.98 },
      "cpf": { "valor": "00000000000", "confidence": 0.98 },
      "matricula": { "valor": "123", "confidence": 0.98 },
      "rubricas": {
        "salario_base": { "valor": 0, "referencia": 30, "confidence": 0.99 },
        "dias_trabalhados": { "valor": 30, "confidence": 0.99 },
        "tempo_servico": { "valor": 0, "confidence": 0.99 },
        "insalubridade": { "valor": 0, "confidence": 0.99 },
        "adicional_noturno": { "valor": 0, "confidence": 0.99 },
        "hora_extra_50": { "valor": 0, "confidence": 0.99 },
        "hora_extra_100": { "valor": 0, "confidence": 0.99 },
        "plantao": { "valor": 0, "confidence": 0.99 },
        "sobreaviso": { "valor": 0, "confidence": 0.99 },
        "vale_transporte": { "valor": 0, "confidence": 0.99 },
        "grat_funcao_vr": { "valor": 0, "confidence": 0.99 },
        "grat_funcao_pct": { "valor": 0, "confidence": 0.99 },
        "grat_nivel_superior": { "valor": 0, "confidence": 0.99 },
        "incentivos": { "valor": 0, "confidence": 0.99 },
        "aux_fin_piso": { "valor": 0, "confidence": 0.99 },
        "ferias_1_3": { "valor": 0, "confidence": 0.99 },
        "ferias_normais": { "valor": 0, "confidence": 0.99 },
        "inss": { "valor": 0, "confidence": 0.99 },
        "irrf": { "valor": 0, "confidence": 0.99 },
        "outros_descontos": { "valor": 0, "confidence": 0.99 },
        "adn_informativo": { "valor": 0, "confidence": 0.99 },
        "total_proventos": { "valor": 0, "confidence": 0.99 },
        "total_descontos": { "valor": 0, "confidence": 0.99 },
        "valor_liquido": { "valor": 0, "confidence": 0.99 }
      }
    }
  ]
}
```

### 3. Parser e Heurísticas (`src/lib/piso-fopag-parser.ts` e `src/lib/piso-heuristics.ts`)
- Atualizar `RUBRICAS_FOPAG` para incluir os novos campos.
- Corrigir extração de `dias_trabalhados` para vir da coluna "Referência" do Salário Base.

### 4. Motor de Cálculo (`src/lib/piso-calculo.ts`)
- Implementar as fórmulas:
  - `BASE_DE_CALCULO = salario_base + tempo_servico + insalubridade + grat_funcao_vr + grat_funcao_pct + grat_nivel_superior`
  - `COMPLEMENTACAO_DEVIDA = MAX(0, Piso_Referencia - BASE_DE_CALCULO)`
  - `DIFERENÇA_A_AJUSTAR = COMPLEMENTACAO_DEVIDA - aux_fin_piso` (atual pago)

### 5. UI de Auditoria (`src/components/piso/import-preview-table.tsx`)
- Atualizar as colunas da tabela para exibir todos os campos granulares.
- Remover campos genéricos como `ISS` e `TOTAL FINAL` em favor dos campos específicos.

### 6. Server Functions (`src/lib/piso-enfermagem.functions.ts`)
- Atualizar o `LinhaSchema` do Zod e o mapeamento no `commitImportPiso` e `appendPisoLinhas`.

## Próximos Passos
1. Atualizar o `PisoDestino` e `NUMERIC_KEYS` em `piso-mapping.ts` e `piso-import.ts`.
2. Modificar o `PROMPT` e a tipagem em `piso-fopag-ia.functions.ts`.
3. Atualizar o parser em `piso-fopag-parser.ts`.
4. Atualizar a lógica de cálculo em `piso-calculo.ts`.
5. Refatorar a `ImportPreviewTable` para suportar o novo schema.
6. Atualizar as server functions.
