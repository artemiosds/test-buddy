DO $$
DECLARE
    v_old_id uuid;
    v_new_id uuid;
BEGIN
    -- 1. Seleciona o ID do vínculo legado
    SELECT id INTO v_old_id FROM public.vinculos WHERE nome = 'Contrato Temporário' LIMIT 1;
    
    IF v_old_id IS NULL THEN
        RAISE EXCEPTION 'Vínculo "Contrato Temporário" não encontrado.';
    END IF;

    -- 2. Criar o novo vínculo "Prestadores de Serviços"
    INSERT INTO public.vinculos (
        nome, 
        codigo, 
        natureza, 
        categoria, 
        descricao, 
        base_legal, 
        permite_acumulo, 
        requer_concurso, 
        status
    )
    SELECT 
        'Prestadores de Serviços', 
        'PREST', 
        natureza, 
        categoria, 
        'Novo vínculo para prestadores de serviços migrados', 
        base_legal, 
        permite_acumulo, 
        requer_concurso, 
        'ativa'
    FROM public.vinculos WHERE id = v_old_id
    RETURNING id INTO v_new_id;

    -- 3. Renomeação do Vínculo Legado para "Contrato"
    UPDATE public.vinculos SET nome = 'Contrato' WHERE id = v_old_id;

    -- 4. Migração de Dados dos Profissionais
    -- Esta é a tabela principal. As outras tabelas (frequencias_contratados, etc) 
    -- referenciam profissional_id, então o histórico é preservado via FK do profissional.
    -- Algumas tabelas podem ter vinculo_id redundante; vamos tratar com cautela.
    UPDATE public.profissionais SET vinculo_id = v_new_id WHERE vinculo_id = v_old_id;

    -- 5. Atualização de tabelas que POSSUEM a coluna vinculo_id explicitamente
    -- Folha de Pagamento (se existir)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'folha_pagamento' AND column_name = 'vinculo_id' AND table_schema = 'public') THEN
        EXECUTE 'UPDATE public.folha_pagamento SET vinculo_id = $1 WHERE vinculo_id = $2' USING v_new_id, v_old_id;
    END IF;

    -- Fichas Financeiras (se existir)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fichas_financeiras' AND column_name = 'vinculo_id' AND table_schema = 'public') THEN
        EXECUTE 'UPDATE public.fichas_financeiras SET vinculo_id = $1 WHERE vinculo_id = $2' USING v_new_id, v_old_id;
    END IF;

    -- Frequencias Contratados (Vimos no types.ts que não tem vinculo_id, apenas profissional_id)
    -- Mas se houver alguma tabela de log ou cache com vinculo_id, atualizamos:
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_log' AND column_name = 'vinculo_id' AND table_schema = 'public') THEN
        EXECUTE 'UPDATE public.audit_log SET vinculo_id = $1 WHERE vinculo_id = $2' USING v_new_id, v_old_id;
    END IF;

END $$;
