# Deploy AnLaundry employee-management Edge Function

Function name: `admin-create-employee`

Source of truth in GitHub:
`supabase/functions/admin-create-employee/index.ts`

Supabase project ref: `ropcvgwbwmhbyfsewpqe`

## Recommended first deployment: Supabase Dashboard editor

1. Open the Supabase project.
2. In the left menu, open **Edge Functions**.
3. Click **Deploy a new function** → **Via Editor**.
4. Name the function exactly `admin-create-employee`.
5. Open the source file in GitHub and copy its complete contents into the Dashboard editor.
6. Click **Deploy function**.
7. Confirm the function appears in the Edge Functions list.

Keep JWT verification enabled. The project config also records this in `supabase/config.toml`:

```toml
[functions.admin-create-employee]
verify_jwt = true
```

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
- The browser UI calls the function with the signed-in Owner/Manager JWT. Do not turn off JWT verification.
- The function checks the caller's role and branch authority before creating an Auth invitation, profile and primary branch assignment.
- Managers can create Staff only. Only Owners can create Managers.
