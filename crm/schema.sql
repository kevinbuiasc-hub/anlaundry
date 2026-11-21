-- AnLaundry CRM: initial schema for one store, multiple staff accounts.
-- Run in Supabase Dashboard > SQL Editor. Review before production use.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'staff' check (role in ('owner','manager','staff')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create or replace function public.create_profile_for_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''), 'staff')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute procedure public.create_profile_for_new_user();

create or replace function public.current_user_role()
returns text language sql stable security definer set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and active = true
$$;

create or replace function public.is_active_staff()
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active = true)
$$;

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  customer_code text unique not null,
  full_name text not null,
  phone text not null,
  email text,
  address text,
  notes text,
  total_orders integer not null default 0,
  total_spent numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit text not null default 'kg',
  price numeric(14,2) not null check (price >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_code text unique not null,
  customer_id uuid references public.customers(id) on delete set null,
  status text not null default 'received' check (status in ('received','checking','washing','drying','ready','delivered','cancelled')),
  received_at timestamptz not null default now(),
  promised_at timestamptz,
  delivered_at timestamptz,
  total_weight numeric(10,2) not null default 0 check (total_weight >= 0),
  subtotal numeric(14,2) not null default 0 check (subtotal >= 0),
  discount numeric(14,2) not null default 0 check (discount >= 0),
  total_amount numeric(14,2) not null default 0 check (total_amount >= 0),
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  service_id uuid references public.services(id) on delete set null,
  description text not null,
  quantity numeric(10,2) not null default 1 check (quantity >= 0),
  unit text not null default 'kg',
  unit_price numeric(14,2) not null default 0 check (unit_price >= 0),
  line_total numeric(14,2) not null default 0 check (line_total >= 0)
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  method text not null check (method in ('cash','bank_transfer')),
  paid_at timestamptz not null default now(),
  received_by uuid references auth.users(id),
  note text
);

create table if not exists public.activity_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.services enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.activity_logs enable row level security;

-- Authenticated active staff can access operational data.
create policy "profiles_read_active_staff" on public.profiles for select to authenticated using (public.is_active_staff());
create policy "profiles_update_owner_manager" on public.profiles for update to authenticated using (public.current_user_role() in ('owner','manager')) with check (public.current_user_role() in ('owner','manager'));
create policy "customers_staff_all" on public.customers for all to authenticated using (public.is_active_staff()) with check (public.is_active_staff());
create policy "services_staff_read" on public.services for select to authenticated using (public.is_active_staff());
create policy "services_manager_write" on public.services for all to authenticated using (public.current_user_role() in ('owner','manager')) with check (public.current_user_role() in ('owner','manager'));
create policy "orders_staff_all" on public.orders for all to authenticated using (public.is_active_staff()) with check (public.is_active_staff());
create policy "order_items_staff_all" on public.order_items for all to authenticated using (public.is_active_staff()) with check (public.is_active_staff());
create policy "payments_staff_read" on public.payments for select to authenticated using (public.is_active_staff());
create policy "payments_staff_insert" on public.payments for insert to authenticated with check (public.is_active_staff());
create policy "payments_manager_update" on public.payments for update to authenticated using (public.current_user_role() in ('owner','manager')) with check (public.current_user_role() in ('owner','manager'));
create policy "activity_logs_staff_read" on public.activity_logs for select to authenticated using (public.current_user_role() in ('owner','manager'));
create policy "activity_logs_staff_insert" on public.activity_logs for insert to authenticated with check (public.is_active_staff());

insert into public.services (name, unit, price)
select 'Giặt sấy thường', 'kg', 15000
where not exists (select 1 from public.services where name = 'Giặt sấy thường');

-- Bootstrap the first owner safely:
-- 1) Create the first user in Supabase Auth.
-- 2) Replace EMAIL_HERE and run the following statement in SQL Editor:
-- update public.profiles p set role = 'owner'
-- from auth.users u where p.id = u.id and u.email = 'EMAIL_HERE';
-- Do not allow users to choose their own role from the public sign-up form.
