-- 08_RESTRICT_MANAGER_STAFF_VISIBILITY.sql
-- Restrict Manager profile visibility to staff with an active assignment
-- in a branch that the current Manager is authorized to manage.
-- Owner continues to see all employee profiles.
-- Safe to run more than once.

BEGIN;

DROP POLICY IF EXISTS profiles_read_self_or_manager ON public.profiles;
DROP POLICY IF EXISTS profiles_read_self_owner_or_manager_branch ON public.profiles;

CREATE POLICY profiles_read_self_owner_or_manager_branch
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR public.current_employee_role() = 'owner'
  OR (
    public.current_employee_role() = 'manager'
    AND EXISTS (
      SELECT 1
      FROM public.staff_branch_assignments a
      WHERE a.user_id = profiles.id
        AND a.valid_from <= now()
        AND (a.valid_until IS NULL OR a.valid_until > now())
        AND public.can_manage_branch(a.branch_id)
    )
  )
);

COMMIT;

-- Verification query (run as a signed-in Owner/Manager using the CRM session,
-- not as the postgres SQL Editor session):
-- SELECT id, full_name, role, phone
-- FROM public.profiles
-- ORDER BY full_name;
