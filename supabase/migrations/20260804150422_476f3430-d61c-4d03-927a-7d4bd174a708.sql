BEGIN;

-- 1. Limpeza de Frequências
DELETE FROM public.frequencia_pendencias;
DELETE FROM public.frequencia_aprovacoes;
DELETE FROM public.frequencia_profissional;
DELETE FROM public.frequencias;
DELETE FROM public.frequencias_contratados;

-- 2. Limpeza de Dados de Envio de Unidades (Reset para 'nao_iniciada')
UPDATE public.competencia_unidades SET 
    data_envio = NULL, 
    responsavel_id = NULL, 
    status = 'nao_iniciada', 
    observacoes = NULL, 
    data_analise = NULL, 
    data_aprovacao = NULL;

-- 3. Limpeza de Piso Nacional da Enfermagem
DELETE FROM public.piso_pendencias;
DELETE FROM public.piso_competencia_profissional;
DELETE FROM public.piso_enfermagem;

-- 4. Limpeza de Documentos, Pendências e Notificações
DELETE FROM public.documentos_assinados;
DELETE FROM public.documentos_assinados_publico;
DELETE FROM public.documentos;
DELETE FROM public.pendencia_historico;
DELETE FROM public.pendencias;
DELETE FROM public.notificacoes;

-- 5. Limpeza de Histórico de Importações
DELETE FROM public.import_layout_uso;
DELETE FROM public.historico_importacoes;

-- 6. Limpeza de Auditoria de Tabelas Operacionais
DELETE FROM public.audit_log 
WHERE tabela IN (
    'frequencias', 
    'frequencia_profissional', 
    'frequencia_pendencias', 
    'frequencia_aprovacoes', 
    'piso_enfermagem', 
    'piso_pendencias', 
    'documentos', 
    'pendencias'
);

COMMIT;