-- Criar trigger para bloquear edições em frequências de competências não abertas
CREATE OR REPLACE FUNCTION public.check_competencia_aberta()
RETURNS TRIGGER AS $$
DECLARE
    v_status text;
BEGIN
    -- Busca o status da competência associada à frequência (via competencia_unidades)
    SELECT c.status INTO v_status
    FROM public.competencias c
    JOIN public.competencia_unidades cu ON cu.competencia_id = c.id
    WHERE cu.id = COALESCE(NEW.competencia_unidade_id, OLD.competencia_unidade_id);

    IF v_status IS NULL OR v_status <> 'aberta' THEN
        RAISE EXCEPTION 'Operação rejeitada: A competência associada não está aberta (Status: %).', COALESCE(v_status, 'Desconhecido');
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar o trigger para INSERT, UPDATE e DELETE na tabela frequencias
DROP TRIGGER IF EXISTS trg_check_frequencia_lock ON public.frequencias;
CREATE TRIGGER trg_check_frequencia_lock
BEFORE INSERT OR UPDATE OR DELETE ON public.frequencias
FOR EACH ROW
EXECUTE FUNCTION public.check_competencia_aberta();
