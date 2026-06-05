
CREATE TABLE public.access_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  user_email text,
  user_name text,
  login_at timestamp with time zone NOT NULL DEFAULT now(),
  last_activity_at timestamp with time zone NOT NULL DEFAULT now(),
  duration_seconds integer NOT NULL DEFAULT 0,
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_access_logs_user_id ON public.access_logs(user_id);
CREATE INDEX idx_access_logs_login_at ON public.access_logs(login_at DESC);

ALTER TABLE public.access_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view all access logs"
ON public.access_logs FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users view own access logs"
ON public.access_logs FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users insert own access logs"
ON public.access_logs FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own access logs"
ON public.access_logs FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE TRIGGER trg_access_logs_updated_at
BEFORE UPDATE ON public.access_logs
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
