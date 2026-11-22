-- 09_ADD_PROFILE_PHONE.sql
-- Add the employee contact phone field used by the CRM staff-management screen.
-- Required for an already initialized AnLaundry development database.
-- Safe to run repeatedly.

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text;

COMMENT ON COLUMN public.profiles.phone IS
  'Employee contact phone number; separate from the Supabase Auth login identity.';

COMMIT;

-- Verification
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name = 'phone';
