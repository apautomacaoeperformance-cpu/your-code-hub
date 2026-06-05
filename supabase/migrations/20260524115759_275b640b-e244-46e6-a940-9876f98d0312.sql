CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

SELECT cron.unschedule('cleanup-access-logs-zero-duration')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-access-logs-zero-duration');

SELECT cron.schedule(
  'cleanup-access-logs-zero-duration',
  '0 3 * * *',
  $$DELETE FROM public.access_logs WHERE duration_seconds = 0 AND login_at < now() - interval '1 hour'$$
);