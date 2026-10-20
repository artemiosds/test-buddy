CREATE OR REPLACE FUNCTION public.tg_profissionais_caixa_alta()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.nome_completo := upper(NEW.nome_completo);
  NEW.nome_social := upper(NEW.nome_social);
  NEW.logradouro := upper(NEW.logradouro);
  NEW.numero := upper(NEW.numero);
  NEW.bairro := upper(NEW.bairro);
  NEW.cidade := upper(NEW.cidade);
  NEW.endereco_completo := upper(NEW.endereco_completo);
  NEW.uf := upper(NEW.uf);
  NEW.rg_orgao := upper(NEW.rg_orgao);
  NEW.rg_uf := upper(NEW.rg_uf);
  NEW.conselho_classe := upper(NEW.conselho_classe);
  NEW.conselho_uf := upper(NEW.conselho_uf);
  NEW.banco := upper(NEW.banco);
  NEW.projeto := upper(NEW.projeto);
  NEW.jornada := upper(NEW.jornada);
  NEW.observacoes := upper(NEW.observacoes);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_profissionais_caixa_alta ON public.profissionais;
CREATE TRIGGER trg_profissionais_caixa_alta BEFORE INSERT OR UPDATE ON public.profissionais
FOR EACH ROW EXECUTE FUNCTION public.tg_profissionais_caixa_alta();

UPDATE public.profissionais SET nome_completo = nome_completo
WHERE nome_completo <> upper(nome_completo) OR logradouro <> upper(logradouro) OR bairro <> upper(bairro)
 OR cidade <> upper(cidade) OR endereco_completo <> upper(endereco_completo) OR numero <> upper(numero)
 OR observacoes <> upper(observacoes);