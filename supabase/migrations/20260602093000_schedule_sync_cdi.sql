-- Agenda a sincronização automática do CDI (função edge "sync-cdi")
-- Roda em todo dia útil (seg-sex), duas vezes ao dia:
--   * 09:10 (Brasília) = 12:10 UTC  -> '10 12 * * 1-5'
--   * 14:30 (Brasília) = 17:30 UTC  -> '30 17 * * 1-5'
-- Obs.: pg_cron usa UTC. Brasília é UTC-3 (sem horário de verão desde 2019).

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove agendamentos anteriores com os mesmos nomes (idempotente).
SELECT cron.unschedule('sync-cdi-manha')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-cdi-manha');

SELECT cron.unschedule('sync-cdi-tarde')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-cdi-tarde');

-- 09:10 Brasília (12:10 UTC), seg a sex
SELECT cron.schedule(
  'sync-cdi-manha',
  '10 12 * * 1-5',
  $$
  SELECT net.http_post(
    url     := 'https://zzxnorviwhdxsjlzbxsv.supabase.co/functions/v1/sync-cdi',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6eG5vcnZpd2hkeHNqbHpieHN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4MzU4NzYsImV4cCI6MjA5MzQxMTg3Nn0.aHdFf2sErfTkYJgqZFMrSXnl8bFwhz8vv_y7NaHndRo'
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- 14:30 Brasília (17:30 UTC), seg a sex
SELECT cron.schedule(
  'sync-cdi-tarde',
  '30 17 * * 1-5',
  $$
  SELECT net.http_post(
    url     := 'https://zzxnorviwhdxsjlzbxsv.supabase.co/functions/v1/sync-cdi',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6eG5vcnZpd2hkeHNqbHpieHN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4MzU4NzYsImV4cCI6MjA5MzQxMTg3Nn0.aHdFf2sErfTkYJgqZFMrSXnl8bFwhz8vv_y7NaHndRo'
    ),
    body    := '{}'::jsonb
  );
  $$
);
