-- 07_CREATE_STAFF_MHUONG_EMAIL.sql
-- AnLaundry CRM Development: create Mỹ Hương's staff profile using email/password Auth.
-- This path avoids SMS/Twilio during development.
--
-- Login email: buingockhuong89@gmail.com
-- Staff contact phone: 0839649049
-- Branch: CN02 — AnLaundry Hòa Hưng
--
-- PRECONDITION:
-- 1) Create this Auth user first in Supabase Dashboard > Authentication > Users.
-- 2) Use the login email above and set a secure password.
-- 3) If email confirmation is required, confirm the alias email from the owner's Gmail inbox.
-- 4) Make sure branch CN02 exists (run 06_SETUP_CN02_HOAHUNG.sql).
-- 5) Run this query as the project database owner in Supabase SQL Editor.
--
-- No SMS provider or Twilio credentials are required for this email/password test.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text;

DO $$
DECLARE
  v_email text := 'buingockhuong89@gmail.com';
  v_phone text := '0839649049';
  v_full_name text := 'Mỹ Hương';
  v_role text := 'staff';
  v_branch_code text := 'CN02';

  v_user_id uuid;
  v_branch_id uuid;
  v_owner_id uuid;
BEGIN
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(email) = lower(v_email)
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Auth user % not found. Create the email/password Auth user first.', v_email;
  END IF;

  SELECT id INTO v_branch_id
  FROM public.branches
  WHERE code = v_branch_code AND is_active = true
  LIMIT 1;

  IF v_branch_id IS NULL THEN
    RAISE EXCEPTION 'Active branch % not found. Run 06_SETUP_CN02_HOAHUNG.sql first.', v_branch_code;
  END IF;

  SELECT id INTO v_owner_id
  FROM public.profiles
  WHERE role = 'owner' AND is_active = true
  ORDER BY created_at
  LIMIT 1;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'No active Owner profile found.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_user_id AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'This Auth user already belongs to an Owner profile.';
  END IF;

  INSERT INTO public.profiles (id, full_name, role, is_active, phone)
  VALUES (v_user_id, v_full_name, v_role, true, v_phone)
  ON CONFLICT (id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        is_active = true,
        phone = EXCLUDED.phone;

  -- Set CN02 as the primary permanent branch for this employee.
  UPDATE public.staff_branch_assignments
  SET is_primary = false
  WHERE user_id = v_user_id AND is_primary = true;

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

  RAISE NOTICE 'Mỹ Hương has been assigned as Staff to CN02 using email/password Auth.';
END $$;

-- Verify profile, login email, staff contact phone and branch assignment.
SELECT
  p.full_name,
  u.email AS login_email,
  p.phone AS staff_contact_phone,
  p.role,
  b.code AS branch_code,
  b.name AS branch_name
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
JOIN public.staff_branch_assignments a ON a.user_id = p.id
JOIN public.branches b ON b.id = a.branch_id
WHERE lower(u.email) = lower('buingockhuong89@gmail.com');
