-- 1) Colunas que o fluxo de emissão/revogação espera
ALTER TABLE public.documentos_assinados
  ADD COLUMN IF NOT EXISTS descricao text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ativo',
  ADD COLUMN IF NOT EXISTS revogado_em timestamptz,
  ADD COLUMN IF NOT EXISTS revogado_por uuid REFERENCES public.usuarios(id),
  ADD COLUMN IF NOT EXISTS motivo_revogacao text,
  ADD COLUMN IF NOT EXISTS pdf_storage_path text;

CREATE INDEX IF NOT EXISTS idx_docs_assinados_assinado_em
  ON public.documentos_assinados (assinado_em DESC);
CREATE INDEX IF NOT EXISTS idx_docs_assinados_status
  ON public.documentos_assinados (status);
CREATE INDEX IF NOT EXISTS idx_docs_assinados_tipo
  ON public.documentos_assinados (documento_tipo);

-- 2) Autor pode complementar o próprio registro (ex.: caminho do PDF guardado)
DROP POLICY IF EXISTS "Autor pode complementar o proprio documento" ON public.documentos_assinados;
CREATE POLICY "Autor pode complementar o proprio documento"
  ON public.documentos_assinados
  FOR UPDATE
  TO authenticated
  USING (assinado_por_id = auth.uid())
  WITH CHECK (assinado_por_id = auth.uid());

-- 3) Rotina oficial de revogação alinhada ao esquema atual
CREATE OR REPLACE FUNCTION public.revogar_documento_assinado(_id uuid, _motivo text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  _caller uuid := auth.uid();
  _autor uuid;
  _status text;
  _existe boolean;
BEGIN
  IF _caller IS NULL THEN
    RAISE EXCEPTION 'Requer autenticação' USING ERRCODE = '42501';
  END IF;
  IF _motivo IS NULL OR length(btrim(_motivo)) < 5 THEN
    RAISE EXCEPTION 'Motivo obrigatório (mínimo 5 caracteres)' USING ERRCODE = '22023';
  END IF;

  SELECT true, assinado_por_id, coalesce(status, 'ativo')
    INTO _existe, _autor, _status
    FROM public.documentos_assinados WHERE id = _id;

  IF NOT coalesce(_existe, false) THEN
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
$function$;

-- 4) Leitura do arquivo original: autor do documento e administradores de documentos
DROP POLICY IF EXISTS "docs_assinados_read_own" ON storage.objects;
CREATE POLICY "docs_assinados_read_own"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'documentos-assinados'
    AND (
      (storage.foldername(name))[1] = (auth.uid())::text
      OR public.is_master(auth.uid())
      OR public.has_permission(auth.uid(), 'documento.gerenciar')
    )
  );
