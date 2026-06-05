import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const SYSTEM_VARS = new Set([
  "PATH", "HOME", "DENO_DIR", "HOSTNAME", "PORT", "TMPDIR", "USER",
  "LANG", "TERM", "_", "DENO_REGION", "DENO_DEPLOYMENT_ID",
]);

const KNOWN_FUNCTIONS = [
  "admin-create-user",
  "admin-delete-user",
  "admin-update-user",
  "efetivar-retirada-juros",
  "gerar-informe-anual",
  "gerar-rendimentos-mensais",
  "notify-debenture-acquired",
  "sync-cdi",
  "validar-rendimentos",
  "migrate-sql",
  "painel-migracao",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    const env = Deno.env.toObject();
    const SUPABASE_URL = env.SUPABASE_URL ?? "";
    const ANON = env.SUPABASE_ANON_KEY ?? env.SUPABASE_PUBLISHABLE_KEY ?? "";
    const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SECRET_KEYS ?? "";

    // Filtra secrets para retornar dinamicamente
    const secrets: Record<string, string> = {};
    for (const [k, v] of Object.entries(env)) {
      if (SYSTEM_VARS.has(k)) continue;
      if (k.startsWith("XDG_")) continue;
      secrets[k] = v;
    }

    // Probe edge functions
    const probes = await Promise.allSettled(
      KNOWN_FUNCTIONS.map(async (name) => {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
          method: "OPTIONS",
        });
        return { name, status: res.status };
      }),
    );
    const edge_functions = probes
      .filter((p) => p.status === "fulfilled" && (p as PromiseFulfilledResult<{ name: string; status: number }>).value.status < 500)
      .map((p) => (p as PromiseFulfilledResult<{ name: string; status: number }>).value.name);

    // Descobre tabelas via exec_sql
    let database_tables: unknown[] = [];
    try {
      const supabase = createClient(SUPABASE_URL, SERVICE);
      const tablesQuery = `
        SELECT
          t.tablename,
          (SELECT reltuples::bigint FROM pg_class WHERE oid = (t.schemaname || '.' || t.tablename)::regclass) AS row_count,
          (SELECT count(*) FROM information_schema.columns c WHERE c.table_schema = t.schemaname AND c.table_name = t.tablename) AS column_count,
          0 AS encrypted_columns,
          EXISTS(SELECT 1 FROM information_schema.columns c WHERE c.table_schema = t.schemaname AND c.table_name = t.tablename AND c.column_name = 'user_id') AS has_user_id
        FROM pg_tables t
        WHERE t.schemaname = 'public'
        ORDER BY t.tablename
      `;
      const { data } = await supabase.rpc("exec_sql", { sql_query: tablesQuery });
      if (Array.isArray(data)) database_tables = data;
    } catch (_) { /* ignore */ }

    const payload = {
      project_url: SUPABASE_URL,
      anon_key: ANON,
      service_role_key: SERVICE,
      secrets,
      edge_functions,
      edge_functions_count: edge_functions.length,
      database_tables,
    };

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
