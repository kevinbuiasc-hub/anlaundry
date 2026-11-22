-- 06_SETUP_CN02_HOAHUNG.sql
-- Create or update AnLaundry branch CN02 (Hòa Hưng).
-- Run in Supabase SQL Editor as project database owner.
-- Uses the branch address previously supplied for AnLaundry.

INSERT INTO public.branches (code, name, address, is_active)
VALUES (
  'CN02',
  'AnLaundry - Hòa Hưng',
  '463B/84 Cách Mạng Tháng 8, Hòa Hưng, TP. Hồ Chí Minh',
  true
)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    address = EXCLUDED.address,
    is_active = true;

-- Verify branch record
SELECT code, name, address, is_active
FROM public.branches
WHERE code = 'CN02';
