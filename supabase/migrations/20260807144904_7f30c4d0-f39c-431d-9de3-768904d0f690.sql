ALTER TABLE public.profissionais 
ADD COLUMN IF NOT EXISTS cep VARCHAR(10),
ADD COLUMN IF NOT EXISTS logradouro TEXT,
ADD COLUMN IF NOT EXISTS numero VARCHAR(20),
ADD COLUMN IF NOT EXISTS bairro VARCHAR(100),
ADD COLUMN IF NOT EXISTS cidade VARCHAR(100),
ADD COLUMN IF NOT EXISTS uf VARCHAR(2);

CREATE OR REPLACE FUNCTION public.save_profissional_complete(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id UUID;
    v_nome_completo TEXT;
    v_cpf TEXT;
    v_matricula TEXT;
BEGIN
    v_id := (p_payload->>'id')::UUID;
    v_nome_completo := trim(p_payload->>'nome_completo');
    v_cpf := regexp_replace(p_payload->>'cpf', '\D', '', 'g');
    v_matricula := trim(p_payload->>'matricula');

    IF v_nome_completo IS NULL OR v_nome_completo = '' THEN
        RAISE EXCEPTION 'Nome completo é obrigatório';
    END IF;

    IF v_id IS NOT NULL THEN
        UPDATE public.profissionais
        SET
            nome_completo = v_nome_completo,
            nome_social = NULLIF(trim(p_payload->>'nome_social'), ''),
            cpf = NULLIF(v_cpf, ''),
            matricula = NULLIF(v_matricula, ''),
            email = NULLIF(trim(p_payload->>'email'), ''),
            telefone = NULLIF(trim(p_payload->>'telefone'), ''),
            data_nascimento = (p_payload->>'data_nascimento')::DATE,
            sexo = p_payload->>'sexo',
            data_admissao = (p_payload->>'data_admissao')::DATE,
            carga_horaria_semanal = (p_payload->>'carga_horaria_semanal')::SMALLINT,
            status = (p_payload->>'status')::status_profissional,
            observacoes = NULLIF(trim(p_payload->>'observacoes'), ''),
            secretaria_id = (p_payload->>'secretaria_id')::UUID,
            unidade_id = (p_payload->>'unidade_id')::UUID,
            setor_id = (p_payload->>'setor_id')::UUID,
            cargo_id = (p_payload->>'cargo_id')::UUID,
            funcao_id = (p_payload->>'funcao_id')::UUID,
            vinculo_id = (p_payload->>'vinculo_id')::UUID,
            conselho_classe = NULLIF(trim(p_payload->>'conselho_classe'), ''),
            conselho_numero = NULLIF(trim(p_payload->>'conselho_numero'), ''),
            conselho_uf = p_payload->>'conselho_uf',
            conselho_validade = (p_payload->>'conselho_validade')::DATE,
            gestor_imediato_id = (p_payload->>'gestor_imediato_id')::UUID,
            situacao_funcional = (p_payload->>'situacao_funcional')::situacao_funcional,
            situacao_data_inicio = (p_payload->>'situacao_data_inicio')::DATE,
            situacao_data_fim = (p_payload->>'situacao_data_fim')::DATE,
            foto_url = NULLIF(trim(p_payload->>'foto_url'), ''),
            cep = p_payload->>'cep',
            logradouro = p_payload->>'logradouro',
            numero = p_payload->>'numero',
            bairro = p_payload->>'bairro',
            cidade = p_payload->>'cidade',
            uf = p_payload->>'uf',
            banco = p_payload->>'banco',
            agencia = p_payload->>'agencia',
            conta_corrente = p_payload->>'conta_corrente',
            updated_at = now()
        WHERE id = v_id;
    ELSE
        INSERT INTO public.profissionais (
            nome_completo, nome_social, cpf, matricula, email, telefone,
            data_nascimento, sexo, data_admissao, carga_horaria_semanal,
            status, observacoes, secretaria_id, unidade_id, setor_id,
            cargo_id, funcao_id, vinculo_id, conselho_classe, conselho_numero,
            conselho_uf, conselho_validade, gestor_imediato_id,
            situacao_funcional, situacao_data_inicio, situacao_data_fim,
            foto_url, cep, logradouro, numero, bairro, cidade, uf,
            banco, agencia, conta_corrente
        )
        VALUES (
            v_nome_completo, NULLIF(trim(p_payload->>'nome_social'), ''), NULLIF(v_cpf, ''), NULLIF(v_matricula, ''),
            NULLIF(trim(p_payload->>'email'), ''), NULLIF(trim(p_payload->>'telefone'), ''),
            (p_payload->>'data_nascimento')::DATE, p_payload->>'sexo',
            (p_payload->>'data_admissao')::DATE, (p_payload->>'carga_horaria_semanal')::SMALLINT,
            COALESCE((p_payload->>'status')::status_profissional, 'ativo'),
            NULLIF(trim(p_payload->>'observacoes'), ''), (p_payload->>'secretaria_id')::UUID,
            (p_payload->>'unidade_id')::UUID, (p_payload->>'setor_id')::UUID,
            (p_payload->>'cargo_id')::UUID, (p_payload->>'funcao_id')::UUID,
            (p_payload->>'vinculo_id')::UUID, NULLIF(trim(p_payload->>'conselho_classe'), ''),
            NULLIF(trim(p_payload->>'conselho_numero'), ''), p_payload->>'conselho_uf',
            (p_payload->>'conselho_validade')::DATE, (p_payload->>'gestor_imediato_id')::UUID,
            (p_payload->>'situacao_funcional')::situacao_funcional,
            (p_payload->>'situacao_data_inicio')::DATE, (p_payload->>'situacao_data_fim')::DATE,
            NULLIF(trim(p_payload->>'foto_url'), ''), p_payload->>'cep', p_payload->>'logradouro',
            p_payload->>'numero', p_payload->>'bairro', p_payload->>'cidade', p_payload->>'uf',
            p_payload->>'banco', p_payload->>'agencia', p_payload->>'conta_corrente'
        )
        RETURNING id INTO v_id;
    END IF;

    RETURN jsonb_build_object('success', true, 'id', v_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_profissional_complete(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_profissional_complete(JSONB) TO service_role;