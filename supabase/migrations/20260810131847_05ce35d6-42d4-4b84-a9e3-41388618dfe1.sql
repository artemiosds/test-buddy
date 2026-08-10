CREATE OR REPLACE FUNCTION public.fn_registrar_historico_profissional()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
    IF (TG_OP = 'UPDATE') THEN
        IF (
            COALESCE(OLD.unidade_id::text, '') <> COALESCE(NEW.unidade_id::text, '') OR
            COALESCE(OLD.setor_id::text, '') <> COALESCE(NEW.setor_id::text, '') OR
            COALESCE(OLD.cargo_id::text, '') <> COALESCE(NEW.cargo_id::text, '') OR
            COALESCE(OLD.funcao_id::text, '') <> COALESCE(NEW.funcao_id::text, '') OR
            COALESCE(OLD.status::text, '') <> COALESCE(NEW.status::text, '')
        ) THEN
            INSERT INTO public.profissional_historico_funcional (
                profissional_id,
                unidade_anterior_id,
                unidade_novo_id,
                setor_anterior_id,
                setor_novo_id,
                cargo_anterior_id,
                cargo_novo_id,
                funcao_anterior_id,
                funcao_novo_id,
                status_anterior,
                status_novo,
                tipo_evento,
                data_inicio,
                created_at
            ) VALUES (
                NEW.id,
                OLD.unidade_id,
                NEW.unidade_id,
                OLD.setor_id,
                NEW.setor_id,
                OLD.cargo_id,
                NEW.cargo_id,
                OLD.funcao_id,
                NEW.funcao_id,
                OLD.status,
                NEW.status,
                (CASE
                    WHEN COALESCE(OLD.unidade_id::text, '') <> COALESCE(NEW.unidade_id::text, '') THEN 'transferencia'
                    WHEN COALESCE(OLD.cargo_id::text, '') <> COALESCE(NEW.cargo_id::text, '') THEN 'mudanca_cargo'
                    WHEN COALESCE(OLD.funcao_id::text, '') <> COALESCE(NEW.funcao_id::text, '') THEN 'mudanca_funcao'
                    ELSE 'outro'
                END)::tipo_evento_funcional,
                NOW(),
                NOW()
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$function$;