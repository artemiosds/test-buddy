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
    v_caller_id UUID := auth.uid();
BEGIN
    -- 1. Identifica bypass para Master
    v_is_master := public.is_master_db(v_caller_id);

    -- 2. Extração segura de campos chave
    v_id := NULLIF(p_payload->>'id', '')::UUID;
    v_secretaria_id := NULLIF(p_payload->>'secretaria_id', '')::UUID;
    v_unidade_id := NULLIF(p_payload->>'unidade_id', '')::UUID;
    v_cpf := NULLIF(p_payload->>'cpf', '');
    v_matricula := NULLIF(p_payload->>'matricula', '');

    -- 3. Validação de RBAC (Ignora se Master)
    IF NOT COALESCE(v_is_master, false) THEN
        IF NOT public.has_permission_core(v_caller_id, 'profissional.criar') AND v_id IS NULL THEN
             RAISE EXCEPTION 'Acesso negado: sem permissão para cadastrar profissionais' USING ERRCODE = '42501';
        END IF;

        IF NOT public.has_permission_core(v_caller_id, 'profissional.editar') AND v_id IS NOT NULL THEN
             RAISE EXCEPTION 'Acesso negado: sem permissão para editar profissionais' USING ERRCODE = '42501';
        END IF;

        IF v_unidade_id IS NOT NULL THEN
            IF NOT public.user_has_unit(v_caller_id, v_unidade_id) THEN
                RAISE EXCEPTION 'Acesso negado: usuário sem permissão para esta unidade' USING ERRCODE = '42501';
            END IF;
        ELSIF v_secretaria_id IS NOT NULL THEN
            IF NOT public.user_has_secretaria(v_caller_id, v_secretaria_id) THEN
                 RAISE EXCEPTION 'Acesso negado: usuário sem permissão para esta secretaria' USING ERRCODE = '42501';
            END IF;
        ELSE
            RAISE EXCEPTION 'Secretaria ou Unidade é obrigatória para validação de acesso' USING ERRCODE = '42501';
        END IF;
    END IF;

    -- 4. Upsert com casts corretos
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
        (NULLIF(p_payload->>'data_nascimento',''))::DATE,
        p_payload->>'sexo',
        (NULLIF(p_payload->>'data_admissao',''))::DATE,
        (NULLIF(p_payload->>'carga_horaria_semanal',''))::INTEGER,
        COALESCE(NULLIF(p_payload->>'status',''), 'ativo')::public.status_profissional,
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
        (NULLIF(p_payload->>'proj',''))::NUMERIC,
        (NULLIF(p_payload->>'h_p',''))::NUMERIC,
        (NULLIF(p_payload->>'c_h',''))::NUMERIC,
        (NULLIF(p_payload->>'jorn',''))::NUMERIC,
        p_payload->>'conselho_classe',
        p_payload->>'conselho_numero',
        p_payload->>'conselho_uf',
        (NULLIF(p_payload->>'conselho_validade',''))::DATE,
        NULLIF(p_payload->>'gestor_imediato_id', '')::UUID,
        (NULLIF(p_payload->>'situacao_funcional',''))::public.situacao_funcional,
        (NULLIF(p_payload->>'situacao_data_inicio',''))::DATE,
        (NULLIF(p_payload->>'situacao_data_fim',''))::DATE,
        p_payload->>'foto_url',
        (NULLIF(p_payload->>'salario_base',''))::NUMERIC,
        (NULLIF(p_payload->>'salario_liquido',''))::NUMERIC,
        (NULLIF(p_payload->>'horas_extras',''))::NUMERIC,
        (NULLIF(p_payload->>'adicional_noturno',''))::NUMERIC,
        (NULLIF(p_payload->>'salario_bruto',''))::NUMERIC,
        (NULLIF(p_payload->>'gratificacao_incentivo',''))::NUMERIC,
        (NULLIF(p_payload->>'vencimento_liquido',''))::NUMERIC,
        now(), now(), v_caller_id, v_caller_id
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
        updated_at = now(),
        updated_by = v_caller_id
    RETURNING jsonb_build_object('id', id) INTO v_result;

    RETURN v_result;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.save_profissional_complete(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_profissional_complete(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.save_profissional_complete(jsonb) TO anon;
