ALTER TABLE public.profissionais ADD COLUMN IF NOT EXISTS cep VARCHAR;
ALTER TABLE public.profissionais ADD COLUMN IF NOT EXISTS logradouro TEXT;
ALTER TABLE public.profissionais ADD COLUMN IF NOT EXISTS numero VARCHAR;
ALTER TABLE public.profissionais ADD COLUMN IF NOT EXISTS bairro VARCHAR;
ALTER TABLE public.profissionais ADD COLUMN IF NOT EXISTS cidade VARCHAR;
ALTER TABLE public.profissionais ADD COLUMN IF NOT EXISTS uf VARCHAR;

CREATE OR REPLACE FUNCTION public.save_profissional_complete(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id UUID;
    v_data RECORD;
    v_cpf TEXT;
    v_matricula TEXT;
    v_secretaria_id UUID;
    v_result JSONB;
BEGIN
    -- Extrair dados básicos para validação
    v_id := (p_payload->>'id')::UUID;
    v_cpf := p_payload->>'cpf';
    v_matricula := p_payload->>'matricula';
    v_secretaria_id := (p_payload->>'secretaria_id')::UUID;

    IF v_secretaria_id IS NULL THEN
        RAISE EXCEPTION 'Secretaria é obrigatória';
    END IF;

    -- Upsert na tabela profissionais
    INSERT INTO public.profissionais (
        id,
        nome_completo,
        nome_social,
        cpf,
        matricula,
        email,
        telefone,
        data_nascimento,
        sexo,
        data_admissao,
        carga_horaria_semanal,
        status,
        observacoes,
        secretaria_id,
        unidade_id,
        setor_id,
        cargo_id,
        funcao_id,
        vinculo_id,
        cep,
        logradouro,
        numero,
        bairro,
        cidade,
        uf,
        banco,
        agencia,
        conta_corrente,
        proj,
        h_p,
        c_h,
        jorn,
        conselho_classe,
        conselho_numero,
        conselho_uf,
        conselho_validade,
        gestor_imediato_id,
        situacao_funcional,
        situacao_data_inicio,
        situacao_data_fim,
        foto_url
    )
    VALUES (
        COALESCE(v_id, gen_random_uuid()),
        p_payload->>'nome_completo',
        p_payload->>'nome_social',
        v_cpf,
        v_matricula,
        p_payload->>'email',
        p_payload->>'telefone',
        (p_payload->>'data_nascimento')::DATE,
        p_payload->>'sexo',
        (p_payload->>'data_admissao')::DATE,
        (p_payload->>'carga_horaria_semanal')::NUMERIC,
        (p_payload->>'status')::public.status_profissional,
        p_payload->>'observacoes',
        v_secretaria_id,
        (p_payload->>'unidade_id')::UUID,
        (p_payload->>'setor_id')::UUID,
        (p_payload->>'cargo_id')::UUID,
        (p_payload->>'funcao_id')::UUID,
        (p_payload->>'vinculo_id')::UUID,
        p_payload->>'cep',
        p_payload->>'logradouro',
        p_payload->>'numero',
        p_payload->>'bairro',
        p_payload->>'cidade',
        p_payload->>'uf',
        p_payload->>'banco',
        p_payload->>'agencia',
        p_payload->>'conta_corrente',
        (p_payload->>'proj')::NUMERIC,
        (p_payload->>'h_p')::NUMERIC,
        (p_payload->>'c_h')::NUMERIC,
        (p_payload->>'jorn')::NUMERIC,
        p_payload->>'conselho_classe',
        p_payload->>'conselho_numero',
        p_payload->>'conselho_uf',
        (p_payload->>'conselho_validade')::DATE,
        (p_payload->>'gestor_imediato_id')::UUID,
        (p_payload->>'situacao_funcional')::public.situacao_funcional,
        (p_payload->>'situacao_data_inicio')::DATE,
        (p_payload->>'situacao_data_fim')::DATE,
        p_payload->>'foto_url'
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
        updated_at = NOW()
    RETURNING id INTO v_id;

    SELECT jsonb_build_object('id', v_id, 'success', true) INTO v_result;
    RETURN v_result;
END;
$$;