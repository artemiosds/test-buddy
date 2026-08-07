ALTER TABLE public.sistema_config REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'sistema_config'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sistema_config;
  END IF;
END $$;