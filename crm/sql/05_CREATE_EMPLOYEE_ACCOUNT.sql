-- 05_CREATE_EMPLOYEE_ACCOUNT.sql
-- AnLaundry CRM | Provision one employee account into an existing branch.
-- IMPORTANT:
-- 1) First create/invite the user in Supabase Dashboard > Authentication > Users.
-- 2) Replace all template values below before running this query.
-- 3) Run as the project database owner in the Supabase SQL Editor.
-- 4) This query creates/updates the employee profile and permanent branch assignment.
--    It does NOT create the Auth user or send an invitation.

DO $$
DECLARE
  v_email text := 'EMPLOYEE_EMAIL';
  v_full_name text := 'EMPLOYEE_FULL_NAME';
  v_role text := 'staff';       -- Allowed: 'manager' or 'staff'. Do not use 'owner'.
  v_branch_code text := 'CN01';

  v_user_id uuid;
  v_branch_id uuid;
  v_owner_id uuid;
BEGIN
  IF v_email = 'EMPLOYEE_EMAIL'
     OR v_full_name = 'EMPLOYEE_FULL_NAME'
     OR v_email = ''
     OR v_full_name = '' THEN
    RAISE EXCEPTION 'Replace EMPLOYEE_EMAIL and EMPLOYEE_FULL_NAME before running.';
  END IF;

  IF v_role NOT IN ('manager', 'staff') THEN
    RAISE EXCEPTION 'Employee role must be manager or staff.';
  END IF;

  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(email) = lower(v_email)
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Auth user % not found. Create/invite the user in Supabase Auth first.', v_email;
  END IF;

  SELECT id INTO v_branch_id
  FROM public.branches
  WHERE code = v_branch_code
    AND is_active = true
  LIMIT 1;

  IF v_branch_id IS NULL THEN
    RAISE EXCEPTION 'Active branch % not found.', v_branch_code;
  END IF;

  SELECT id INTO v_owner_id
  FROM public.profiles
  WHERE role = 'owner'
    AND is_active = true
  ORDER BY created_at
  LIMIT 1;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'No active Owner profile found to approve the assignment.';
  END IF;

  -- Prevent this staff provisioning script from downgrading an Owner account.
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_user_id AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'This Auth user already belongs to an Owner profile.';
  END IF;

  INSERT INTO public.profiles (id, full_name, role, is_active)
  VALUES (v_user_id, v_full_name, v_role, true)
  ON CONFLICT (id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        is_active = true;

  -- Keep one primary permanent branch assignment for this employee.
  UPDATE public.staff_branch_assignments
  SET is_primary = false
  WHERE user_id = v_user_id
    AND is_primary = true;

  IF EXISTS (
    SELECT 1
    FROM public.staff_branch_assignments
    WHERE user_id = v_user_id
      AND branch_id = v_branch_id
      AND assignment_type = 'permanent'
      AND valid_until IS NULL
  ) THEN
    UPDATE public.staff_branch_assignments
    SET is_primary = true,
        valid_from = LEAST(valid_from, now()),
        approved_by = v_owner_id
    WHERE user_id = v_user_id
      AND branch_id = v_branch_id
      AND assignment_type = 'permanent'
      AND valid_until IS NULL;
  ELSE
    INSERT INTO public.staff_branch_assignments
      (user_id, branch_id, assignment_type, is_primary,
       valid_from, valid_until, approved_by)
    VALUES
      (v_user_id, v_branch_id, 'permanent', true,
       now(), NULL, v_owner_id);
  END IF;

  RAISE NOTICE 'Employee % (%), role %, assigned to branch %.',
    v_full_name, v_email, v_role, v_branch_code;
END $$;
