-- 1. Grant EXECUTE to authenticated and anon roles for safety
GRANT EXECUTE ON FUNCTION public.is_master(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.user_has_secretaria(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.user_has_secretaria_core(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.user_has_unit(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.user_has_unit_core(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.save_profissional_complete(jsonb) TO authenticated;

-- 2. Update save_profissional_complete to be more resilient and fix the "secretaria" error
CREATE OR REPLACE FUNCTION public.save_profissional_complete(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_id UUID;
    v_cpf TEXT;
    v_matricula TEXT;
    v_secretaria_id UUID;
    v_unidade_id UUID;
    v_result JSONB;
    v_is_master BOOLEAN;
BEGIN
    -- Determinar se é MASTER uma única vez para performance
    v_is_master := public.is_master(auth.uid());

    -- Extrair IDs para validação
    v_id := NULLIF(p_payload->>'id', '')::UUID;
    v_secretaria_id := NULLIF(p_payload->>'secretaria_id', '')::UUID;
    v_unidade_id := NULLIF(p_payload->>'unidade_id', '')::UUID;
    v_cpf := NULLIF(p_payload->>'cpf', '');
    v_matricula := NULLIF(p_payload->>'matricula', '');

    -- Validação de Segurança REFORÇADA: 
    -- MASTER: acesso total irrestrito
    -- GESTOR: acesso a qualquer unidade da secretaria dele
    IF NOT v_is_master THEN
        -- Se não for MASTER, verificamos se é GESTOR da secretaria ou tem acesso à unidade
        IF v_unidade_id IS NOT NULL THEN
            -- Se informou unidade, precisa ter acesso à unidade OU à secretaria pai
            IF NOT (public.user_has_unit(auth.uid(), v_unidade_id) OR (v_secretaria_id IS NOT NULL AND public.user_has_secretaria(auth.uid(), v_secretaria_id))) THEN
                RAISE EXCEPTION 'Acesso negado: usuário sem permissão para cadastrar nesta unidade' USING ERRCODE = '42501';
            END IF;
        ELSIF v_secretaria_id IS NOT NULL THEN
            -- Se informou só secretaria, precisa ter acesso à secretaria
            IF NOT public.user_has_secretaria(auth.uid(), v_secretaria_id) THEN
                 RAISE EXCEPTION 'Acesso negado: usuário sem permissão para cadastrar nesta secretaria' USING ERRCODE = '42501';
            END IF;
        ELSE
            -- Se não informou nem unidade nem secretaria, mas não é MASTER, algo está errado no payload
            RAISE EXCEPTION 'Secretaria ou Unidade é obrigatória para validação de acesso' USING ERRCODE = '42501';
        END IF;
    END IF;

    IF v_secretaria_id IS NULL THEN
        RAISE EXCEPTION 'Secretaria é obrigatória';
    END IF;

    -- Upsert na tabela profissionais
    INSERT INTO public.profissionais (
        id, nome_completo, nome_social, cpf, matricula, email, telefone,
        data_nascimento, sexo, data_admissao, carga_horaria_semanal,
        status, observacoes, secretaria_id, unidade_id, setor_id,
        cargo_id, funcao_id, vinculo_id, cep, logradouro, numero,
        bairro, cidade, uf, banco, agencia, conta_corrente,
        proj, h_p, c_h, jorn, conselho_classe, conselho_numero,
        conselho_uf, conselho_validade, gestor_imediato_id,
        situacao_funcional, situacao_data_inicio, situacao_data_fim, foto_url,
        salario_base, salario_liquido, horas_extras, adicional_noturno,
        salario_bruto, gratificacao_incentivo, vencimento_liquido,
        created_at, updated_at, created_by, updated_by
    )
    VALUES (
        COALESCE(v_id, gen_random_uuid()),
        p_payload->>'nome_completo',
        p_payload->>'nome_social',
        v_cpf,
        v_matricula,
        p_payload->>'email',
        p_payload->>'telefone',
        NULLIF(p_payload->>'data_nascimento', '')::DATE,
        p_payload->>'sexo',
        NULLIF(p_payload->>'data_admissao', '')::DATE,
        NULLIF(p_payload->>'carga_horaria_semanal', '')::NUMERIC,
        COALESCE((p_payload->>'status')::public.status_profissional, 'ativo'),
        p_payload->>'observacoes',
        v_secretaria_id,
        v_unidade_id,
        NULLIF(p_payload->>'setor_id', '')::UUID,
        NULLIF(p_payload->>'cargo_id', '')::UUID,
        NULLIF(p_payload->>'funcao_id', '')::UUID,
        NULLIF(p_payload->>'vinculo_id', '')::UUID,
        p_payload->>'cep',
        p_payload->>'logradouro',
        p_payload->>'numero',
        p_payload->>'bairro',
        p_payload->>'cidade',
        p_payload->>'uf',
        p_payload->>'banco',
        p_payload->>'agencia',
        p_payload->>'conta_corrente',
        NULLIF(p_payload->>'proj', '')::NUMERIC,
        NULLIF(p_payload->>'h_p', '')::NUMERIC,
        NULLIF(p_payload->>'c_h', '')::NUMERIC,
        NULLIF(p_payload->>'jorn', '')::NUMERIC,
        p_payload->>'conselho_classe',
        p_payload->>'conselho_numero',
        p_payload->>'conselho_uf',
        NULLIF(p_payload->>'conselho_validade', '')::DATE,
        NULLIF(p_payload->>'gestor_imediato_id', '')::UUID,
        COALESCE((p_payload->>'situacao_funcional')::public.situacao_funcional, 'trabalhando'),
        NULLIF(p_payload->>'situacao_data_inicio', '')::DATE,
        NULLIF(p_payload->>'situacao_data_fim', '')::DATE,
        p_payload->>'foto_url',
        NULLIF(p_payload->>'salario_base', '')::NUMERIC,
        NULLIF(p_payload->>'salario_liquido', '')::NUMERIC,
        NULLIF(p_payload->>'horas_extras', '')::NUMERIC,
        NULLIF(p_payload->>'adicional_noturno', '')::NUMERIC,
        NULLIF(p_payload->>'salario_bruto', '')::NUMERIC,
        NULLIF(p_payload->>'gratificacao_incentivo', '')::NUMERIC,
        NULLIF(p_payload->>'vencimento_liquido', '')::NUMERIC,
        NOW(), NOW(), auth.uid(), auth.uid()
    )
    ON CONFLICT (id) DO UPDATE SET
        nome_completo = EXCLUDED.nome_completo,
        nome_social = EXCLUDED.nome_social,
        cpf = EXCLUDED.cpf,
        matricula = EXCLUDED.matricula,
        email = EXCLUDED.email,
        telefone = EXCLUDED.telefone,
        data_nascimento = EXCLUDED.data_nascimento,
        sexo = EXCLUDED.sexo,
        data_admissao = EXCLUDED.data_admissao,
        carga_horaria_semanal = EXCLUDED.carga_horaria_semanal,
        status = EXCLUDED.status,
        observacoes = EXCLUDED.observacoes,
        secretaria_id = EXCLUDED.secretaria_id,
        unidade_id = EXCLUDED.unidade_id,
        setor_id = EXCLUDED.setor_id,
        cargo_id = EXCLUDED.cargo_id,
        funcao_id = EXCLUDED.funcao_id,
        vinculo_id = EXCLUDED.vinculo_id,
        cep = EXCLUDED.cep,
        logradouro = EXCLUDED.logradouro,
        numero = EXCLUDED.numero,
        bairro = EXCLUDED.bairro,
        cidade = EXCLUDED.cidade,
        uf = EXCLUDED.uf,
        banco = EXCLUDED.banco,
        agencia = EXCLUDED.agencia,
        conta_corrente = EXCLUDED.conta_corrente,
        proj = EXCLUDED.proj,
        h_p = EXCLUDED.h_p,
        c_h = EXCLUDED.c_h,
        jorn = EXCLUDED.jorn,
        conselho_classe = EXCLUDED.conselho_classe,
        conselho_numero = EXCLUDED.conselho_numero,
        conselho_uf = EXCLUDED.conselho_uf,
        conselho_validade = EXCLUDED.conselho_validade,
        gestor_imediato_id = EXCLUDED.gestor_imediato_id,
        situacao_funcional = EXCLUDED.situacao_funcional,
        situacao_data_inicio = EXCLUDED.situacao_data_inicio,
        situacao_data_fim = EXCLUDED.situacao_data_fim,
        foto_url = EXCLUDED.foto_url,
        salario_base = EXCLUDED.salario_base,
        salario_liquido = EXCLUDED.salario_liquido,
        horas_extras = EXCLUDED.horas_extras,
        adicional_noturno = EXCLUDED.adicional_noturno,
        salario_bruto = EXCLUDED.salario_bruto,
        gratificacao_incentivo = EXCLUDED.gratificacao_incentivo,
        vencimento_liquido = EXCLUDED.vencimento_liquido,
        updated_at = NOW(),
        updated_by = auth.uid()
    RETURNING jsonb_build_object('id', id) INTO v_result;

    RETURN v_result;
END;
$function$;
