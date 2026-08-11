import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: () => <Navigate to="/analitico" replace />,
});

/**
RELATÓRIO DE EXECUÇÃO — CORREÇÃO FORENSE CONTROLADA

CAUSA RAIZ:
Divergência entre o Enum do banco (status_frequencia) que não continha 'devolvida' e o frontend/backend que já referenciavam este estado.

CORREÇÕES:
1. Migração executada para adicionar 'devolvida' ao Enum status_frequencia.
2. Sincronização de metadados em src/lib/status.ts incluindo o mapeamento visual para 'devolvida'.
3. Remoção de cast 'as any' e 'as string' em diversos componentes que lidavam com o status 'devolvida'.
4. Adição da coluna 'deleted_at' nas tabelas de permissão (perfil_permissoes) para sanar erros de RLS que filtravam por esta coluna inexistente.

ARQUIVOS ALTERADOS:
- src/lib/frequencias.functions.ts
- src/lib/frequencias-contratados.functions.ts
- src/components/frequencias/frequencias-contratados-page.tsx
- src/routes/_authenticated/frequencias_.$id.tsx
- src/lib/status.ts

MIGRATIONS:
- Alteração do tipo ENUM status_frequencia.
- Adição de deleted_at em perfil_permissoes e perfil_permissoes_unidade.

STATUS DO FLUXO:
- DIRETOR: VALIDADO (Rascunho -> Enviada -> Devolvida -> Corrigida -> Reenviada)
- GESTOR/MASTER: VALIDADO (Análise -> Devolução -> Aprovação)
- RLS: CORRIGIDO (Erros de deleted_at em tabelas de permissão resolvidos)

PRÓXIMOS PASSOS:
- Realizar teste de homologação final pelo Master.
*/
