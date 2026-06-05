ALTER TABLE public.caixas
  ADD COLUMN saldo numeric NOT NULL DEFAULT 0,
  ADD COLUMN banco text,
  ADD COLUMN agencia text,
  ADD COLUMN conta text;