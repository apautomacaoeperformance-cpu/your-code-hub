// Edge function: backup-database
// Returns a ZIP archive containing one CSV per table in the public schema.
// Auth: requires a valid JWT belonging to a user with the "admin" role.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  let str: string;
  if (typeof value === "object") {
    try { str = JSON.stringify(value); } catch { str = String(value); }
  } else {
    str = String(value);
  }
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows || rows.length === 0) return "";
  const headers = Array.from(
    rows.reduce<Set<string>>((acc, r) => {
      Object.keys(r).forEach((k) => acc.add(k));
      return acc;
    }, new Set<string>())
  );
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(","));
  }
  return lines.join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_KEY =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEYS")!;

    // Auth: validate JWT and require admin role
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData?.user?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: roleRows, error: roleErr } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (roleErr) {
      return new Response(JSON.stringify({ error: roleErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const isAdmin = (roleRows ?? []).some((r: { role: string }) => r.role === "admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden: admin required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Discover public tables. Try exec_sql RPC if available, fallback to a known list via REST OpenAPI.
    let tables: string[] = [];
    try {
      const { data } = await admin.rpc("exec_sql", {
        sql_query:
          "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
      });
      if (Array.isArray(data)) {
        tables = data.map((r: { tablename: string }) => r.tablename).filter(Boolean);
      }
    } catch (_) { /* ignore */ }

    if (tables.length === 0) {
      // Fallback: use PostgREST OpenAPI spec to discover exposed tables
      const specRes = await fetch(`${SUPABASE_URL}/rest/v1/`, {
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
      });
      if (specRes.ok) {
        const spec = await specRes.json();
        if (spec?.definitions) tables = Object.keys(spec.definitions);
        else if (spec?.paths) {
          tables = Object.keys(spec.paths)
            .filter((p) => /^\/[A-Za-z0-9_]+$/.test(p))
            .map((p) => p.slice(1));
        }
      }
    }

    if (tables.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhuma tabela encontrada para backup" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const zip = new JSZip();
    const manifest: { table: string; rows: number; error?: string }[] = [];

    for (const table of tables) {
      try {
        // Paginate to avoid limits
        const pageSize = 1000;
        let from = 0;
        const all: Record<string, unknown>[] = [];
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { data, error } = await admin
            .from(table)
            .select("*")
            .range(from, from + pageSize - 1);
          if (error) throw error;
          if (!data || data.length === 0) break;
          all.push(...data);
          if (data.length < pageSize) break;
          from += pageSize;
        }
        zip.file(`${table}.csv`, toCsv(all));
        manifest.push({ table, rows: all.length });
      } catch (e) {
        const msg = (e as Error).message;
        zip.file(`${table}.error.txt`, msg);
        manifest.push({ table, rows: 0, error: msg });
      }
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    zip.file(
      "manifest.json",
      JSON.stringify(
        { generated_at: new Date().toISOString(), tables: manifest },
        null,
        2,
      ),
    );

    const buf = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });

    return new Response(buf, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="backup-${stamp}.zip"`,
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
