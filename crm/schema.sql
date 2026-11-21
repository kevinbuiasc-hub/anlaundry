-- AnLaundry CRM — multi-branch foundation
-- Fresh Supabase project only. Do not run on a database containing production data.
-- PostgreSQL + Supabase Auth + Row Level Security.

begin;
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Identity and organization
-- ---------------------------------------------------------------------------
create table public.branches (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  address text,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Employee accounts only. Customer identities are linked separately below.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null check (role in ('owner','manager','staff')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.staff_branch_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete restrict,
  assignment_type text not null default 'permanent'
    check (assignment_type in ('permanent','temporary')),
  is_primary boolean not null default false,
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  approved_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  check (valid_until is null or valid_until > valid_from)
);
create index staff_assignments_user_idx on public.staff_branch_assignments(user_id, valid_from, valid_until);
create index staff_assignments_branch_idx on public.staff_branch_assignments(branch_id);

create table public.branch_switch_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id),
  from_branch_id uuid references public.branches(id),
  to_branch_id uuid not null references public.branches(id),
  requested_from timestamptz not null default now(),
  requested_until timestamptz not null,
  reason text not null,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','cancelled')),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  check (requested_until > requested_from)
);

-- Shared customer master record. A customer may place orders at any branch.
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  customer_code text not null unique,
  full_name text not null,
  phone text not null,
  phone_normalized text not null unique,
  email text,
  address text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index customers_name_idx on public.customers using gin (to_tsvector('simple', full_name));

-- A customer Auth user is linked to exactly one shared customer record.
-- Link accounts through a trusted admin workflow; never accept arbitrary customer_id from public signup.
create table public.customer_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  customer_id uuid not null unique references public.customers(id) on delete cascade,
  linked_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Services and branch-specific price books
-- ---------------------------------------------------------------------------
create table public.services (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  unit text not null default 'kg',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.branch_service_prices (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete restrict,
  unit_price numeric(14,2) not null check (unit_price >= 0),
  is_active boolean not null default true,
  effective_from timestamptz not null default now(),
  effective_until timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  check (effective_until is null or effective_until > effective_from)
);
create index branch_prices_lookup_idx
  on public.branch_service_prices(branch_id, service_id, effective_from desc);

-- ---------------------------------------------------------------------------
-- Orders, immutable price snapshots, payments, expenses and audit trail
-- ---------------------------------------------------------------------------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_code text not null unique,
  branch_id uuid not null references public.branches(id) on delete restrict,
  customer_id uuid references public.customers(id) on delete set null,
  status text not null default 'received'
    check (status in ('received','checking','washing','drying','ready','delivered','cancelled')),
  received_at timestamptz not null default now(),
  promised_at timestamptz,
  delivered_at timestamptz,
  total_weight numeric(10,2) not null default 0 check (total_weight >= 0),
  subtotal numeric(14,2) not null default 0 check (subtotal >= 0),
  discount numeric(14,2) not null default 0 check (discount >= 0),
  total_amount numeric(14,2) not null default 0 check (total_amount >= 0),
  note text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_branch_date_idx on public.orders(branch_id, received_at desc);
create index orders_customer_date_idx on public.orders(customer_id, received_at desc);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  service_id uuid references public.services(id) on delete set null,
  service_name_snapshot text not null,
  description text,
  quantity numeric(10,2) not null default 1 check (quantity >= 0),
  unit text not null default 'kg',
  unit_price_snapshot numeric(14,2) not null check (unit_price_snapshot >= 0),
  line_total numeric(14,2) not null check (line_total >= 0)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  method text not null check (method in ('cash','bank_transfer')),
  status text not null default 'completed' check (status in ('completed','refunded','voided')),
  paid_at timestamptz not null default now(),
  received_by uuid not null references public.profiles(id),
  note text
);
create index payments_branch_date_idx on public.payments(branch_id, paid_at desc);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete restrict,
  category text not null,
  description text not null,
  amount numeric(14,2) not null check (amount > 0),
  spent_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create index expenses_branch_date_idx on public.expenses(branch_id, spent_at desc);

create table public.activity_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id),
  branch_id uuid references public.branches(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Authorization helpers. These are SECURITY DEFINER to avoid RLS recursion.
-- ---------------------------------------------------------------------------
create or replace function public.current_employee_role()
returns text language sql stable security definer set search_path = public, pg_temp
as $$
  select role from public.profiles
  where id = auth.uid() and is_active = true
$$;

create or replace function public.is_active_employee()
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and is_active = true)
$$;

create or replace function public.has_branch_access(p_branch_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$
  select
    public.current_employee_role() = 'owner'
    or exists (
      select 1
      from public.staff_branch_assignments a
      join public.profiles p on p.id = a.user_id and p.is_active = true
      join public.branches b on b.id = a.branch_id and b.is_active = true
      where a.user_id = auth.uid()
        and a.branch_id = p_branch_id
        and a.valid_from <= now()
        and (a.valid_until is null or a.valid_until > now())
    )
$$;

create or replace function public.can_manage_branch(p_branch_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$
  select public.current_employee_role() = 'owner'
    or (
      public.current_employee_role() = 'manager'
      and public.has_branch_access(p_branch_id)
    )
$$;

create or replace function public.current_customer_id()
returns uuid language sql stable security definer set search_path = public, pg_temp
as $$
  select customer_id from public.customer_accounts where user_id = auth.uid()
$$;

-- Only managers assigned to the destination branch or owners can approve.
-- Approval creates a time-limited assignment; branch-switch requests never grant access by themselves.
create or replace function public.review_branch_switch_request(
  p_request_id uuid,
  p_approve boolean,
  p_review_note text default null
)
returns void language plpgsql security definer set search_path = public, pg_temp
as $$
declare r public.branch_switch_requests%rowtype;
begin
  select * into r
  from public.branch_switch_requests
  where id = p_request_id and status = 'pending'
  for update;

  if not found then raise exception 'Request not found or already reviewed'; end if;
  if not public.can_manage_branch(r.to_branch_id) then
    raise exception 'Not authorized to review this branch request';
  end if;
  if r.requester_id = auth.uid() then
    raise exception 'Requester cannot approve their own request';
  end if;

  update public.branch_switch_requests
  set status = case when p_approve then 'approved' else 'rejected' end,
      reviewed_by = auth.uid(), reviewed_at = now(), review_note = p_review_note
  where id = p_request_id;

  if p_approve then
    insert into public.staff_branch_assignments
      (user_id, branch_id, assignment_type, is_primary, valid_from, valid_until, approved_by)
    values
      (r.requester_id, r.to_branch_id, 'temporary', false,
       greatest(r.requested_from, now()), r.requested_until, auth.uid());
  end if;
end;
$$;
revoke all on function public.review_branch_switch_request(uuid, boolean, text) from public;
grant execute on function public.review_branch_switch_request(uuid, boolean, text) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.branches enable row level security;
alter table public.profiles enable row level security;
alter table public.staff_branch_assignments enable row level security;
alter table public.branch_switch_requests enable row level security;
alter table public.customers enable row level security;
alter table public.customer_accounts enable row level security;
alter table public.services enable row level security;
alter table public.branch_service_prices enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.expenses enable row level security;
alter table public.activity_logs enable row level security;

-- Organization and staff directory
create policy branches_read_authorized on public.branches for select to authenticated
  using (public.is_active_employee() and (public.current_employee_role() = 'owner' or public.has_branch_access(id)));
create policy branches_owner_manage on public.branches for all to authenticated
  using (public.current_employee_role() = 'owner')
  with check (public.current_employee_role() = 'owner');

create policy profiles_read_self_or_manager on public.profiles for select to authenticated
  using (id = auth.uid() or public.current_employee_role() in ('owner','manager'));
create policy profiles_owner_manage on public.profiles for all to authenticated
  using (public.current_employee_role() = 'owner')
  with check (public.current_employee_role() = 'owner');

create policy assignments_read_self_or_manager on public.staff_branch_assignments for select to authenticated
  using (user_id = auth.uid() or public.current_employee_role() = 'owner'
    or public.can_manage_branch(branch_id));
create policy assignments_owner_manage on public.staff_branch_assignments for all to authenticated
  using (public.current_employee_role() = 'owner')
  with check (public.current_employee_role() = 'owner');

create policy switch_requests_read_parties_or_manager on public.branch_switch_requests for select to authenticated
  using (requester_id = auth.uid() or public.current_employee_role() = 'owner'
    or public.can_manage_branch(to_branch_id));
create policy switch_requests_staff_submit on public.branch_switch_requests for insert to authenticated
  with check (requester_id = auth.uid() and public.is_active_employee()
    and status = 'pending' and reviewed_by is null);
create policy switch_requests_requester_cancel on public.branch_switch_requests for update to authenticated
  using (requester_id = auth.uid() and status = 'pending')
  with check (requester_id = auth.uid() and status = 'cancelled');

-- Shared customer directory: employees can see it across branches; customers see only their own row.
create policy customers_employee_read on public.customers for select to authenticated
  using (public.is_active_employee());
create policy customers_employee_insert on public.customers for insert to authenticated
  with check (public.is_active_employee());
create policy customers_employee_update on public.customers for update to authenticated
  using (public.is_active_employee()) with check (public.is_active_employee());
create policy customers_customer_read_self on public.customers for select to authenticated
  using (id = public.current_customer_id());
create policy customers_manager_delete on public.customers for delete to authenticated
  using (public.current_employee_role() in ('owner','manager'));

create policy customer_account_self_read on public.customer_accounts for select to authenticated
  using (user_id = auth.uid());
create policy customer_account_owner_manage on public.customer_accounts for all to authenticated
  using (public.current_employee_role() = 'owner')
  with check (public.current_employee_role() = 'owner');

-- Service catalog is common; price books are branch-specific.
create policy services_employee_read on public.services for select to authenticated
  using (public.is_active_employee());
create policy services_owner_manage on public.services for all to authenticated
  using (public.current_employee_role() = 'owner')
  with check (public.current_employee_role() = 'owner');

create policy branch_prices_read_access on public.branch_service_prices for select to authenticated
  using (public.has_branch_access(branch_id) or public.current_employee_role() = 'owner');
create policy branch_prices_manager_manage on public.branch_service_prices for all to authenticated
  using (public.can_manage_branch(branch_id))
  with check (public.can_manage_branch(branch_id));

-- Orders are branch-scoped for employees and customer-scoped for customer portal.
create policy orders_employee_read on public.orders for select to authenticated
  using (public.has_branch_access(branch_id));
create policy orders_customer_read_own on public.orders for select to authenticated
  using (customer_id = public.current_customer_id());
create policy orders_staff_create on public.orders for insert to authenticated
  with check (public.is_active_employee() and public.has_branch_access(branch_id)
    and created_by = auth.uid());
create policy orders_staff_update on public.orders for update to authenticated
  using (public.has_branch_access(branch_id))
  with check (public.has_branch_access(branch_id));
create policy orders_manager_delete on public.orders for delete to authenticated
  using (public.can_manage_branch(branch_id));

create policy order_items_employee_read on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and public.has_branch_access(o.branch_id)));
create policy order_items_customer_read_own on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and o.customer_id = public.current_customer_id()));
create policy order_items_employee_insert on public.order_items for insert to authenticated
  with check (exists (select 1 from public.orders o where o.id = order_id and public.has_branch_access(o.branch_id)));
create policy order_items_employee_update on public.order_items for update to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and public.has_branch_access(o.branch_id)))
  with check (exists (select 1 from public.orders o where o.id = order_id and public.has_branch_access(o.branch_id)));
create policy order_items_manager_delete on public.order_items for delete to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and public.can_manage_branch(o.branch_id)));

create policy payments_employee_read on public.payments for select to authenticated
  using (public.has_branch_access(branch_id));
create policy payments_customer_read_own on public.payments for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and o.customer_id = public.current_customer_id()));
create policy payments_staff_insert on public.payments for insert to authenticated
  with check (public.has_branch_access(branch_id) and received_by = auth.uid()
    and exists (select 1 from public.orders o where o.id = order_id and o.branch_id = branch_id));
create policy payments_manager_update on public.payments for update to authenticated
  using (public.can_manage_branch(branch_id)) with check (public.can_manage_branch(branch_id));
create policy payments_manager_delete on public.payments for delete to authenticated
  using (public.can_manage_branch(branch_id));

create policy expenses_branch_read on public.expenses for select to authenticated
  using (public.has_branch_access(branch_id));
create policy expenses_manager_insert on public.expenses for insert to authenticated
  with check (public.can_manage_branch(branch_id) and created_by = auth.uid());
create policy expenses_manager_update on public.expenses for update to authenticated
  using (public.can_manage_branch(branch_id)) with check (public.can_manage_branch(branch_id));
create policy expenses_manager_delete on public.expenses for delete to authenticated
  using (public.can_manage_branch(branch_id));

create policy activity_logs_branch_read on public.activity_logs for select to authenticated
  using (public.current_employee_role() = 'owner' or (branch_id is not null and public.has_branch_access(branch_id)));
create policy activity_logs_employee_insert on public.activity_logs for insert to authenticated
  with check (actor_id = auth.uid() and public.is_active_employee());

-- Seed catalog only; branch-specific prices are added after branches are created.
insert into public.services (code, name, unit)
values ('WASH_DRY_KG', 'Giặt sấy thường', 'kg')
on conflict (code) do nothing;

-- IMPORTANT: Create employee Auth users, then insert their profiles with an explicit role.
-- First owner bootstrap (run once, replacing the email):
-- insert into public.profiles (id, full_name, role)
-- select id, 'Tên chủ hệ thống', 'owner' from auth.users where email = 'OWNER_EMAIL';
--
-- Create a branch, then assign the owner/staff:
-- insert into public.branches (code, name, address) values ('CN01', 'AnLaundry - Chi nhánh 1', 'Địa chỉ');
-- insert into public.staff_branch_assignments (user_id, branch_id, is_primary)
-- select p.id, b.id, true from public.profiles p cross join public.branches b
-- where p.role = 'owner' and b.code = 'CN01';

commit;
