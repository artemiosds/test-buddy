-- Garante que a extensão pgcrypto existe no schema extensions (padrão Supabase)
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;

-- Garante permissões básicas de uso
GRANT USAGE ON SCHEMA extensions TO public;
GRANT EXECUTE ON FUNCTION extensions.digest(text, text) TO public;
GRANT EXECUTE ON FUNCTION extensions.digest(bytea, text) TO public;

-- Recria a função track_uso com o search_path correto e referência explícita ao digest
CREATE OR REPLACE FUNCTION public.track_uso(
  _evento text, 
  _rota text DEFAULT NULL::text, 
  _contexto jsonb DEFAULT '{}'::jsonb
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  _uid UUID := auth.uid();
  _perfil TEXT;
  _hash TEXT;
  _ctx JSONB;
BEGIN
  -- Ignora chamadas anônimas
  IF _uid IS NULL THEN
    RETURN;
  END IF;

  -- Validações de tamanho
  IF _evento IS NULL OR length(_evento) = 0 OR length(_evento) > 64 THEN
    RAISE EXCEPTION 'evento inválido (1..64 chars)' USING ERRCODE = '22023';
  END IF;

  IF octet_length(coalesce(_contexto::text, '')) > 4096 THEN
    RAISE EXCEPTION 'contexto excede 4KB' USING ERRCODE = '22023';
  END IF;

  -- Busca o perfil do usuário para métricas agregadas
  SELECT p.codigo INTO _perfil
    FROM public.usuarios u
    LEFT JOIN public.perfis p ON p.id = u.perfil_id
   WHERE u.id = _uid AND u.deleted_at IS NULL;

  -- Gera um hash anônimo diário para a sessão (privacidade por design)
  -- Usamos a referência explícita para evitar qualquer ambiguidade de search_path
  _hash := encode(extensions.digest(_uid::text || to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD'), 'sha256'), 'hex');

  _ctx := coalesce(_contexto, '{}'::jsonb);

  -- Registra o evento
  INSERT INTO public.uso_eventos(evento, rota, perfil_codigo, sessao_hash, contexto)
  VALUES (_evento, NULLIF(left(coalesce(_rota,''), 256), ''), _perfil, left(_hash, 32), _ctx);
END;
$function$;