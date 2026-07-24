
CREATE TABLE IF NOT EXISTS public.perfil_permissoes_unidade (
  perfil_id uuid NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  permissao_id uuid NOT NULL REFERENCES public.permissoes(id) ON DELETE CASCADE,
  unidade_id uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  concedida boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  PRIMARY KEY (perfil_id, permissao_id, unidade_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.perfil_permissoes_unidade TO authenticated;
GRANT ALL ON public.perfil_permissoes_unidade TO service_role;

ALTER TABLE public.perfil_permissoes_unidade ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pol_ppu_master_all"
  ON public.perfil_permissoes_unidade
  FOR ALL
  TO authenticated
  USING (public.is_master(auth.uid()))
  WITH CHECK (public.is_master(auth.uid()));

CREATE TRIGGER trg_ppu_updated_at
  BEFORE UPDATE ON public.perfil_permissoes_unidade
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TRIGGER trg_ppu_updated_by
  BEFORE INSERT OR UPDATE ON public.perfil_permissoes_unidade
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_by();

CREATE TRIGGER trg_ppu_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.perfil_permissoes_unidade
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();

CREATE INDEX IF NOT EXISTS idx_ppu_perfil_unidade
  ON public.perfil_permissoes_unidade(perfil_id, unidade_id);

-- ---------------------------------------------------------------------------
-- Atualiza has_permission para aplicar override por unidade do perfil
-- Prioridade (maior -> menor):
--   1. usuario_permissoes revogada  -> false
--   2. usuario_permissoes concedida -> true
--   3. perfil_permissoes_unidade (se _unidade_id informado) -> concedida
--   4. perfil_permissoes (padrão do perfil)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_permission(
  _user_id uuid,
  _codigo text,
  _unidade_id uuid DEFAULT NULL,
  _secretaria_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  _caller uuid := auth.uid();
  _perm_id UUID;
  _perfil_id UUID;
  _revogada BOOLEAN;
  _concedida_individual BOOLEAN;
  _override_unidade BOOLEAN;
  _concedida_perfil BOOLEAN;
  _usuario_ativo BOOLEAN;
BEGIN
  IF _caller IS NOT NULL AND _user_id IS DISTINCT FROM _caller
     AND NOT public.is_master(_caller) THEN
    RAISE EXCEPTION 'Não autorizado a consultar permissões de outro usuário'
      USING ERRCODE = '42501';
  END IF;

  IF _user_id IS NULL OR _codigo IS NULL THEN
    RETURN false;
  END IF;

  SELECT (deleted_at IS NULL AND status = 'ativo'), perfil_id
    INTO _usuario_ativo, _perfil_id
  FROM public.usuarios WHERE id = _user_id;

  IF _usuario_ativo IS NOT TRUE THEN
    RETURN false;
  END IF;

  IF public.is_master(_user_id) THEN
    RETURN true;
  END IF;

  SELECT id INTO _perm_id
  FROM public.permissoes
  WHERE codigo = _codigo AND ativa = true AND deleted_at IS NULL;

  IF _perm_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.usuario_permissoes
    WHERE usuario_id = _user_id AND permissao_id = _perm_id
      AND tipo = 'revogada' AND deleted_at IS NULL
      AND valido_de <= now() AND (valido_ate IS NULL OR valido_ate > now())
      AND (unidade_id IS NULL OR unidade_id = _unidade_id)
      AND (secretaria_id IS NULL OR secretaria_id = _secretaria_id)
  ) INTO _revogada;
  IF _revogada THEN RETURN false; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.usuario_permissoes
    WHERE usuario_id = _user_id AND permissao_id = _perm_id
      AND tipo = 'concedida' AND deleted_at IS NULL
      AND valido_de <= now() AND (valido_ate IS NULL OR valido_ate > now())
      AND (unidade_id IS NULL OR unidade_id = _unidade_id)
      AND (secretaria_id IS NULL OR secretaria_id = _secretaria_id)
  ) INTO _concedida_individual;
  IF _concedida_individual THEN RETURN true; END IF;

  IF _perfil_id IS NOT NULL AND _unidade_id IS NOT NULL THEN
    SELECT concedida INTO _override_unidade
      FROM public.perfil_permissoes_unidade
     WHERE perfil_id = _perfil_id
       AND permissao_id = _perm_id
       AND unidade_id = _unidade_id;
    IF _override_unidade IS NOT NULL THEN
      RETURN _override_unidade;
    END IF;
  END IF;

  IF _perfil_id IS NOT NULL THEN
    SELECT COALESCE(concedida, false) INTO _concedida_perfil
    FROM public.perfil_permissoes
    WHERE perfil_id = _perfil_id AND permissao_id = _perm_id;
    RETURN COALESCE(_concedida_perfil, false);
  END IF;

  RETURN false;
END;
$function$;
