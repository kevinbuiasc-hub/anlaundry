-- 07_CREATE_STAFF_MHUONG_PHONE.sql
-- Create the employee profile and assign Mỹ Hương to branch CN02.
-- IMPORTANT:
-- 1) First create/invite a phone-based Auth user in Supabase Dashboard > Authentication > Users.
-- 2) Use the E.164 phone format (+84...). Mỹ Hương's number is prefilled below.
-- 3) Ensure the verified Auth phone matches v_phone below.
-- 4) Run as the project database owner in Supabase SQL Editor.
-- 5) This script does not create the Auth user or send the OTP.

DO $$
DECLARE
  v_phone text := '+84708401378'; -- Mỹ Hương's phone in international E.164 format
  v_full_name text := 'Mỹ Hương';
  v_role text := 'staff';
  v_branch_code text := 'CN02';

  v_user_id uuid;
  v_branch_id uuid;
  v_owner_id uuid;
BEGIN
  IF v_phone IS NULL OR v_phone = '' OR v_phone !~ '^\+[1-9][0-9]{7,14}$' THEN
    RAISE EXCEPTION 'Set Mỹ Hương Auth phone in E.164 format, e.g. +8490xxxxxxx.';
  END IF;

  SELECT id INTO v_user_id
  FROM auth.users
  WHERE phone = v_phone
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No Supabase Auth user found for phone %. Create the phone-based Auth user first.', v_phone;
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

  INSERT INTO public.profiles (id, full_name, role, is_active)
  VALUES (v_user_id, v_full_name, v_role, true)
  ON CONFLICT (id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        is_active = true;

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

  RAISE NOTICE 'Mỹ Hương has been assigned as staff to CN02.';
END $$;

-- Verify employee and assignment
SELECT
  p.full_name,
  u.phone,
  p.role,
  b.code AS branch_code,
  b.name AS branch_name
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
JOIN public.staff_branch_assignments a ON a.user_id = p.id
JOIN public.branches b ON b.id = a.branch_id
WHERE u.phone = '+84708401378';
