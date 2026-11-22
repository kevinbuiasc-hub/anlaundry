// TEMPORARY, ONE-TIME OWNER PASSWORD RESET
// Target is intentionally hard-coded to kevinbuiasc@gmail.com.
// Password and bootstrap token are read only from Supabase Function Secrets.
// Delete this function and its two secrets immediately after a successful run.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-owner-bootstrap-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function readDefaultKey(envName: string): string | null {
  const raw = Deno.env.get(envName);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      const value = parsed.default ?? Object.values(parsed)[0];
      return typeof value === "string" ? value : null;
    }
  } catch {
    // Older Supabase projects expose plain-string variables.
  }
  return raw;
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  // Supabase custom Function Secrets are exposed through Deno.env.
  // Do not trim secrets silently: whitespace is part of a secret and must match exactly.
  const configuredToken = Deno.env.get("OWNER_PASSWORD_BOOTSTRAP_TOKEN") ?? "";
  const password = Deno.env.get("OWNER_PASSWORD_TO_SET") ?? "";
  const providedToken = req.headers.get("x-owner-bootstrap-token") ?? "";

  if (!configuredToken) {
    return json({
      error: "Secret OWNER_PASSWORD_BOOTSTRAP_TOKEN is missing from this deployed Function environment.",
      action: "Open Edge Functions → Secrets, confirm the exact secret name/value, save it, then redeploy this Function so its runtime loads the updated environment.",
    }, 500);
  }
  if (configuredToken.length < 32) {
    return json({
      error: "Secret OWNER_PASSWORD_BOOTSTRAP_TOKEN is present but shorter than 32 characters.",
      configured_length: configuredToken.length,
      action: "Replace the secret with a new random value of at least 32 characters, save, then redeploy this Function.",
    }, 500);
  }
  if (!providedToken) {
    return json({
      error: "Missing header x-owner-bootstrap-token.",
      action: "In Test → Headers, add the exact header name and paste the original token value (not its SHA256 digest).",
    }, 400);
  }
  if (!constantTimeEqual(providedToken, configuredToken)) {
    return json({ error: "The supplied bootstrap token does not match the Function Secret." }, 401);
  }
  if (!password) {
    return json({
      error: "Secret OWNER_PASSWORD_TO_SET is missing from this deployed Function environment.",
      action: "Add or correct OWNER_PASSWORD_TO_SET in Edge Functions → Secrets, save, then redeploy this Function.",
    }, 500);
  }
  if (password.length < 12) {
    return json({
      error: "Secret OWNER_PASSWORD_TO_SET is present but shorter than 12 characters.",
      configured_length: password.length,
      action: "Set a password of at least 12 characters, save, then redeploy this Function.",
    }, 500);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const secretKey =
    readDefaultKey("SUPABASE_SECRET_KEYS") ??
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !secretKey) {
    return json({ error: "Supabase server secret is unavailable." }, 500);
  }

  const admin = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Find only the fixed Owner email. No email or user ID can be supplied by a caller.
  const targetEmail = "kevinbuiasc@gmail.com";
  const { data: usersPage, error: listError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listError) return json({ error: "Could not look up the Owner account." }, 500);

  const owner = usersPage.users.find(
    user => (user.email ?? "").toLowerCase() === targetEmail,
  );
  if (!owner) return json({ error: "Owner account was not found." }, 404);

  if (owner.app_metadata?.owner_password_bootstrap_done === true) {
    return json({ error: "This one-time reset has already been used. Delete the function and its secrets." }, 409);
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("role,is_active")
    .eq("id", owner.id)
    .maybeSingle();

  if (profileError || profile?.role !== "owner" || profile?.is_active !== true) {
    return json({ error: "Target account is not an active AnLaundry Owner." }, 403);
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(owner.id, {
    password,
    app_metadata: {
      ...(owner.app_metadata ?? {}),
      owner_password_bootstrap_done: true,
      owner_password_bootstrap_at: new Date().toISOString(),
    },
  });

  if (updateError) {
    return json({ error: "Supabase Auth could not update the Owner password." }, 400);
  }

  return json({
    success: true,
    message: "Owner password updated successfully. Delete this temporary function and its secrets now.",
    target: targetEmail,
  }, 200);
});
