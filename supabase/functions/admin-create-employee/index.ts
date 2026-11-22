// Supabase Edge Function: admin-create-employee
// Creates an Auth invitation, employee profile and branch assignment.
// Deploy from Supabase Dashboard > Edge Functions or with the Supabase CLI.
// The secret key is read only in this server-side function, never in browser code.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// New Supabase API key variables are JSON dictionaries (usually keyed by "default").
// Keep legacy support for existing projects still exposing anon/service_role variables.
function readDefaultKey(envName: string): string | null {
  const raw = Deno.env.get(envName);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      const candidate = parsed.default ?? Object.values(parsed)[0];
      return typeof candidate === "string" ? candidate : null;
    }
  } catch {
    // Legacy variables are plain strings, not JSON.
  }
  return raw;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey =
    readDefaultKey("SUPABASE_PUBLISHABLE_KEYS") ??
    Deno.env.get("SUPABASE_ANON_KEY");
  const secretKey =
    readDefaultKey("SUPABASE_SECRET_KEYS") ??
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = req.headers.get("Authorization");

  if (!supabaseUrl || !publishableKey || !secretKey) {
    return jsonResponse({
      error: "Supabase Edge Function environment is incomplete. Check the default Supabase URL, publishable and secret keys.",
    }, 500);
  }
  if (!authorization) return jsonResponse({ error: "Authentication required." }, 401);

  const caller = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const admin = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await caller.auth.getUser();
  if (userError || !userData.user) return jsonResponse({ error: "Invalid or expired session." }, 401);
  const actor = userData.user;

  const { data: actorProfile, error: actorError } = await admin
    .from("profiles")
    .select("role,is_active")
    .eq("id", actor.id)
    .maybeSingle();

  if (actorError || !actorProfile?.is_active || !["owner", "manager"].includes(actorProfile.role)) {
    return jsonResponse({ error: "You are not authorized to create employees." }, 403);
  }

  let input: Record<string, unknown>;
  try {
    input = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body." }, 400);
  }

  const fullName = String(input.full_name ?? "").trim();
  const email = String(input.email ?? "").trim().toLowerCase();
  const phone = String(input.phone ?? "").trim();
  const role = String(input.role ?? "staff");
  const branchId = String(input.branch_id ?? "");

  if (!fullName || fullName.length > 120) return jsonResponse({ error: "Họ tên không hợp lệ." }, 400);
  if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email) || email.length > 254) {
    return jsonResponse({ error: "Email không hợp lệ." }, 400);
  }
  if (phone.length > 20) return jsonResponse({ error: "Số điện thoại không hợp lệ." }, 400);
  if (!["manager", "staff"].includes(role)) return jsonResponse({ error: "Vai trò không hợp lệ." }, 400);
  if (actorProfile.role === "manager" && role !== "staff") {
    return jsonResponse({ error: "Manager chỉ được mời nhân viên Staff." }, 403);
  }
  if (!branchId) return jsonResponse({ error: "Vui lòng chọn chi nhánh." }, 400);

  // This RPC runs with the caller's JWT so auth.uid() reflects the actual Manager/Owner.
  const { data: canManage, error: accessError } = await caller.rpc("can_manage_branch", {
    p_branch_id: branchId,
  });
  if (accessError || canManage !== true) {
    return jsonResponse({ error: "Bạn không có quyền quản lý chi nhánh được chọn." }, 403);
  }

  const { data: branch, error: branchError } = await admin
    .from("branches")
    .select("id,code,name,is_active")
    .eq("id", branchId)
    .maybeSingle();

  if (branchError || !branch || !branch.is_active) {
    return jsonResponse({ error: "Chi nhánh không tồn tại hoặc đã ngừng hoạt động." }, 404);
  }

  const redirectTo = Deno.env.get("EMPLOYEE_INVITE_REDIRECT_URL") || undefined;
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    ...(redirectTo ? { redirectTo } : {}),
  });

  if (inviteError || !invited.user) {
    return jsonResponse({ error: inviteError?.message ?? "Không tạo được lời mời tài khoản." }, 400);
  }

  const newUserId = invited.user.id;
  const { error: profileError } = await admin.from("profiles").insert({
    id: newUserId,
    full_name: fullName,
    role,
    is_active: true,
    phone: phone || null,
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(newUserId);
    return jsonResponse({ error: "Tạo hồ sơ nhân sự thất bại: " + profileError.message }, 500);
  }

  const { error: assignmentError } = await admin.from("staff_branch_assignments").insert({
    user_id: newUserId,
    branch_id: branchId,
    assignment_type: "permanent",
    is_primary: true,
    valid_from: new Date().toISOString(),
    approved_by: actor.id,
  });

  if (assignmentError) {
    await admin.from("profiles").delete().eq("id", newUserId);
    await admin.auth.admin.deleteUser(newUserId);
    return jsonResponse({ error: "Phân công chi nhánh thất bại: " + assignmentError.message }, 500);
  }

  return jsonResponse({
    success: true,
    employee: {
      id: newUserId,
      full_name: fullName,
      email,
      phone: phone || null,
      role,
      branch_code: branch.code,
      branch_name: branch.name,
    },
    message: "Đã tạo lời mời và phân công nhân viên.",
  }, 201);
});
