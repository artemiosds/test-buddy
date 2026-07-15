CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  _nome TEXT;
  _telefone TEXT;
  _is_first BOOLEAN;
BEGIN
  _nome := COALESCE(
    NEW.raw_user_meta_data->>'nome_completo',
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );
  _telefone := NEW.raw_user_meta_data->>'telefone';

  SELECT NOT EXISTS (SELECT 1 FROM public.usuarios) INTO _is_first;

  INSERT INTO public.usuarios (
    id,
    nome_completo,
    email,
    telefone,
    status,
    acesso_todas_unidades,
    acesso_todas_secretarias
  ) VALUES (
    NEW.id,
    _nome,
    NEW.email,
    _telefone,
    CASE WHEN _is_first THEN 'ativo'::public.status_usuario ELSE 'pendente'::public.status_usuario END,
    _is_first,
    _is_first
  )
  ON CONFLICT (id) DO UPDATE SET
    nome_completo = EXCLUDED.nome_completo,
    email = EXCLUDED.email,
    telefone = EXCLUDED.telefone,
    updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();