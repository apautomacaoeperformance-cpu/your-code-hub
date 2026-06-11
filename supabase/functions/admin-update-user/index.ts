// Admin-only edge function to update user info / reset password
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Payload {
  user_id: string;
  full_name?: string;
  email?: string;
  password?: string;
  must_change_password?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isAdmin } = await userClient.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Apenas administradores" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as Payload;
    if (!body.user_id) {
      return new Response(JSON.stringify({ error: "user_id obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (body.password && body.password.length < 8) {
      return new Response(JSON.stringify({ error: "Senha precisa ter ao menos 8 caracteres" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const attrs: Record<string, unknown> = {};
    if (body.email) attrs.email = body.email;
    if (body.password) attrs.password = body.password;
    if (body.full_name !== undefined) attrs.user_metadata = { full_name: body.full_name };

    if (Object.keys(attrs).length > 0) {
      const { error: updErr } = await admin.auth.admin.updateUserById(body.user_id, attrs);
      if (updErr) {
        let msg = updErr.message;
        const lower = msg.toLowerCase();
        if (lower.includes("weak") || lower.includes("known to be") || lower.includes("easy to guess")) {
          msg = "Senha fora dos padrões de segurança. Escolha uma senha mais forte com letras, números e símbolos.";
        }
        return new Response(JSON.stringify({ error: msg }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const profileUpdate: Record<string, unknown> = {};
    if (body.full_name !== undefined) profileUpdate.full_name = body.full_name;
    if (body.email) profileUpdate.email = body.email;
    if (body.must_change_password !== undefined) profileUpdate.must_change_password = body.must_change_password;
    if (Object.keys(profileUpdate).length > 0) {
      await admin.from("profiles").update(profileUpdate).eq("id", body.user_id);
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
