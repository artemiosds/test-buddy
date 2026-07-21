
-- 1) Novas colunas em documentos_assinados
ALTER TABLE public.documentos_assinados
  ADD COLUMN IF NOT EXISTS ip_origem inet,
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS termo_aceite boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ativo',
  ADD COLUMN IF NOT EXISTS revogado_em timestamptz,
  ADD COLUMN IF NOT EXISTS revogado_por uuid REFERENCES public.usuarios(id),
  ADD COLUMN IF NOT EXISTS motivo_revogacao text,
  ADD COLUMN IF NOT EXISTS pdf_storage_path text,
  ADD COLUMN IF NOT EXISTS timestamp_confiavel timestamptz,
  ADD COLUMN IF NOT EXISTS timestamp_fonte text;

ALTER TABLE public.documentos_assinados
  DROP CONSTRAINT IF EXISTS documentos_assinados_status_ck;
ALTER TABLE public.documentos_assinados
  ADD CONSTRAINT documentos_assinados_status_ck CHECK (status IN ('ativo','revogado'));

-- 2) View pública inclui status
DROP VIEW IF EXISTS public.documentos_assinados_publico;
CREATE VIEW public.documentos_assinados_publico
WITH (security_invoker = true) AS
SELECT id, tipo, descricao, hash_conteudo, assinado_por_nome, assinado_em,
       status, revogado_em, motivo_revogacao, timestamp_confiavel
FROM public.documentos_assinados;

GRANT SELECT ON public.documentos_assinados_publico TO anon, authenticated;

-- 3) RPC para revogar
CREATE OR REPLACE FUNCTION public.revogar_documento_assinado(_id uuid, _motivo text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _caller uuid := auth.uid();
  _autor uuid;
  _status text;
BEGIN
  IF _caller IS NULL THEN
    RAISE EXCEPTION 'Requer autenticação' USING ERRCODE = '42501';
  END IF;
  IF _motivo IS NULL OR length(btrim(_motivo)) < 5 THEN
    RAISE EXCEPTION 'Motivo obrigatório (mínimo 5 caracteres)' USING ERRCODE = '22023';
  END IF;

  SELECT assinado_por, status INTO _autor, _status
    FROM public.documentos_assinados WHERE id = _id;
  IF _autor IS NULL AND _status IS NULL THEN
    RAISE EXCEPTION 'Documento não encontrado' USING ERRCODE = '22023';
  END IF;
  IF _status = 'revogado' THEN
    RAISE EXCEPTION 'Documento já revogado' USING ERRCODE = '22023';
  END IF;

  IF NOT (public.is_master(_caller) OR _autor = _caller) THEN
    RAISE EXCEPTION 'Sem permissão para revogar este documento' USING ERRCODE = '42501';
  END IF;

  UPDATE public.documentos_assinados
     SET status = 'revogado',
         revogado_em = now(),
         revogado_por = _caller,
         motivo_revogacao = btrim(_motivo)
   WHERE id = _id;

  INSERT INTO public.audit_log(usuario_id, operacao, tabela, registro_id, contexto)
  VALUES (_caller, 'custom'::public.operacao_auditoria,
          'public.documentos_assinados', _id::text,
          jsonb_build_object('acao','documento.revogar','motivo', btrim(_motivo)));
END;
$$;

REVOKE ALL ON FUNCTION public.revogar_documento_assinado(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.revogar_documento_assinado(uuid, text) TO authenticated;

-- 4) Políticas do bucket documentos-assinados
DROP POLICY IF EXISTS "docs_assinados_upload_own" ON storage.objects;
CREATE POLICY "docs_assinados_upload_own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documentos-assinados'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "docs_assinados_read_own_or_master" ON storage.objects;
CREATE POLICY "docs_assinados_read_own_or_master"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'documentos-assinados'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_master(auth.uid())
    )
  );
