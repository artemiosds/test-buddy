import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: () => <Navigate to="/analitico" replace />,
});

/**
# FASE 2 — IMPORTAÇÃO DE DADOS SALARIAIS VIA PDF COM IA

ESTADO DA FASE 1:
- [x] Campos salariais no banco (numeric)
- [x] Formulário de edição com os 7 campos
- [x] Lógica de permissão master/gestor corrigida
- [x] Importador Excel atualizado

PLANO DE EXECUÇÃO FASE 2:

1. INVESTIGAÇÃO (ETAPA 1):
   - Verificar se usamos Lovable AI Gateway para extração.
   - Identificar biblioteca de parsing de PDF compatível com TanStack Start/Edge.

2. UI (ETAPA 2):
   - Adicionar botão "Importar salários via PDF" em `profissionais.tsx`.
   - Criar `ImportSalariosPdfDialog.tsx`.

3. BACKEND (EXTRAÇÃO IA):
   - Criar `src/lib/salarios-ia.functions.ts`.
   - Prompt estruturado para extração de tabelas salariais.
   - Lógica de fuzzy match para identificação de profissionais.

4. PRÉVIA E CONFIRMAÇÃO (ETAPA 4):
   - Tabela editável com status (Sucesso, Ambíguo, Não Encontrado).
   - Validação antes do salvamento em lote.

PRÓXIMOS PASSOS: Iniciando Etapa 1 e Etapa 2 agora.
*/
