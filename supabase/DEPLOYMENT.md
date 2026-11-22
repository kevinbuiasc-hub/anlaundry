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

## Password recovery and Auth URL configuration
Before requesting another password reset:
1. Deploy the CRM frontend to a stable preview origin.
2. In Supabase Dashboard → Authentication → URL Configuration, set **Site URL** to the stable preview base URL (not `http://localhost:3000`).
3. Add the exact CRM URL/path used by the deployed preview to **Redirect URLs**. For temporary local work, allow-list `http://localhost:3000/**` only when a local server is running.
4. The CRM forgot-password screen calls `resetPasswordForEmail(email, { redirectTo: current CRM page URL })`; that exact destination must be allowed.
5. Supabase will return the user to the CRM with a recovery session. The app listens for `PASSWORD_RECOVERY` and calls `auth.updateUser({ password })` after the user confirms a new password.
6. After correcting redirect configuration, request a new reset email. Previously expired/used one-time links cannot be reused.


## Temporary one-time Owner password reset (Development only)
Use this only when email recovery cannot be completed and the Owner needs to regain access to the development CRM.

1. In Supabase Dashboard → Edge Functions → Secrets, add:
   - `OWNER_PASSWORD_BOOTSTRAP_TOKEN`: a newly generated random secret with at least 32 characters. Do not share it or commit it.
   - `OWNER_PASSWORD_TO_SET`: the new password. Do not put it in GitHub or chat.
2. Deploy `supabase/functions/one-time-owner-password-reset/index.ts` as function `one-time-owner-password-reset`.
3. Keep its Dashboard JWT toggle OFF (this one-time endpoint uses the private custom header instead). The function itself checks the random token, hard-codes the Owner email, verifies the active Owner profile, and marks the action as used.
4. In Test, send POST with header `x-owner-bootstrap-token: <the exact token from Secrets>` and body `{}`.
5. Confirm the response says `success: true`.
6. Immediately delete the temporary function and delete both Function Secrets. The function refuses a second successful reset after it marks the Owner app_metadata.
7. Sign in to CRM with the new password. Rotate it again later because credentials placed in chat should not be retained as a long-term secret.

This function source contains no password or token. Never use this pattern for production; use the normal recovery flow or a tightly controlled admin process.
