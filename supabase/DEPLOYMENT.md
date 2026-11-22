# Deploy AnLaundry employee-management Edge Function

Function name: `admin-create-employee`

Source of truth in GitHub:
`supabase/functions/admin-create-employee/index.ts`

Supabase project ref: `ropcvgwbwmhbyfsewpqe`

## Database preparation

Before deploying the function, run `crm/sql/09_ADD_PROFILE_PHONE.sql` in the Supabase SQL Editor. The development database was initialized before the `profiles.phone` field was added to the source schema; this migration adds it without deleting existing profiles.

## Recommended first deployment: Supabase Dashboard editor

1. Open the Supabase project.
2. In the left menu, open **Edge Functions**.
3. Click **Deploy a new function** → **Via Editor**.
4. Name the function exactly `admin-create-employee`.
5. Open the source file in GitHub and copy its complete contents into the Dashboard editor.
6. Click **Deploy function**.
7. Confirm the function appears in the Edge Functions list.

The project uses the new `sb_publishable` API key. Supabase's legacy gateway JWT verifier may reject user tokens signed with asymmetric signing keys. For this function, turn **Verify JWT with legacy secret OFF** in the Dashboard and keep the configuration in `supabase/config.toml` as:

```toml
[functions.admin-create-employee]
verify_jwt = false
```

This does **not** make the endpoint public: the function requires an Authorization bearer token, validates it with `caller.auth.getUser()`, checks the caller's active Owner/Manager profile, and checks branch-management permission before any admin operation. Do not remove these checks or allow anonymous execution.

## Environment variables

The code uses Supabase's default server-side variables:
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEYS` (new key format) or `SUPABASE_ANON_KEY` (legacy)
- `SUPABASE_SECRET_KEYS` (new key format) or `SUPABASE_SERVICE_ROLE_KEY` (legacy)

Supabase supplies these default variables to hosted Edge Functions. The secret/service-role key must stay server-side and must never be copied to GitHub frontend files, browser code, or shared in chat.

Optional:
- `EMPLOYEE_INVITE_REDIRECT_URL`: set to the final CRM password-setup/recovery URL once that page exists. Until then, configure the project's Auth Site URL and allowed redirect URLs appropriately.

## Important before production

- Supabase Dashboard editor deployments are not version-controlled by GitHub. GitHub remains the maintained source. When changing the function later, update GitHub and redeploy the same code in the Dashboard, or use the Supabase CLI.
- Email invitations require Supabase Email Auth and deliverability/SMTP settings. The current function does not bypass email confirmation.
- The browser UI calls the function with the signed-in Owner/Manager JWT. The gateway's legacy verifier is off for compatibility with new API keys; application-level JWT and role checks inside the function are mandatory.
- The function checks the caller's role and branch authority before creating an Auth invitation, profile and primary branch assignment.
- Managers can create Staff only. Only Owners can create Managers.
