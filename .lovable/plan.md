# Plano de Evolução: Relatório de Dados Salariais

Implementação completa do relatório de "Dados Salariais" seguindo as especificações de filtros, colunas, totais e gráficos solicitadas.

## Alterações

### 1. Núcleo de Dados e Catálogo
- **`src/lib/relatorio-inteligente/catalog.ts`**: Adicionar o bloco `dados_salariais` com a descrição curta "Salário base, bruto, líquido e demais rubricas cadastrais por profissional." e configurar os campos conforme solicitado (Salário Base, Bruto, Líquido, Horas Extras, Adicional Noturno, Gratificação Incentivo, Vencimento Líquido).
- **`src/hooks/use-profissionais-lista.ts`**: Garantir que todos os campos salariais necessários sejam buscados via Supabase.

### 2. Interface e Filtros (Wizard)
- **`src/routes/_authenticated/relatorio-inteligente.tsx`**: 
    - Adicionar suporte a múltiplos novos filtros na `Etapa 3`: Unidade (multi), Setor (multi), Cargo (multi), Vínculo, Status do Profissional, e Faixa Salarial (mínimo/máximo).
    - Implementar a lógica de filtragem para esses novos critérios no hook `useBuiltBlocks`.
    - Garantir que o modo `salarios` inicialize o Wizard na `Etapa 6` (Prévia) com os blocos e campos corretos.

### 3. Agregações e Gráficos
- **`src/lib/relatorios-gerenciais-intelligence.ts`**: Implementar a normalização de cargos (ENFERMEIRO(A) -> Enfermeiro) na agregação para evitar fragmentação nos totais.
- **Configuração de Gráficos**: Adicionar presets de gráficos para o bloco de salários:
    - Massa salarial bruta por unidade (barras).
    - Distribuição por tipo de vínculo (pizza).
    - Cargos com maior massa salarial (barras).

### 4. Visual e Navegação
- **`src/routes/_authenticated/relatorios-gerenciais.index.tsx`**: Atualizar o ícone e a descrição do card de atalho.

## Detalhes Técnicos
- O relatório utilizará a infraestrutura existente do `Wizard` gerencial, garantindo ordenação, exportação (PDF/Excel) e agrupamentos nativos.
- Filtros de faixa salarial serão implementados como inputs numéricos (min/max).
- A normalização de cargos será feita via regex/mapeamento simples durante a construção dos dados para os gráficos de totais.
