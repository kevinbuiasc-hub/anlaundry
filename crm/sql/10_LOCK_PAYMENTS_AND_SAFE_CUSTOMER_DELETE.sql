-- 10_LOCK_PAYMENTS_AND_SAFE_CUSTOMER_DELETE.sql
-- Apply only after crm/schema.sql on the AnLaundry Supabase development project.
-- Payment records are immutable after creation for Staff and Manager.
-- Only an active Owner may correct a payment, and every correction requires a reason.
-- Customer deletion is allowed only when no order references the customer.

begin;

alter table public.payments
  add column if not exists correction_reason text,
  add column if not exists corrected_by uuid references public.profiles(id),
  add column if not exists corrected_at timestamptz;

drop policy if exists payments_manager_update on public.payments;
drop policy if exists payments_manager_delete on public.payments;
drop policy if exists payments_owner_correct on public.payments;

create policy payments_owner_correct
on public.payments
for update
to authenticated
using (public.current_employee_role() = 'owner')
with check (
  public.current_employee_role() = 'owner'
  and corrected_by = auth.uid()
  and nullif(btrim(correction_reason), '') is not null
);

-- Enforce correction metadata even if a client bypasses the intended UI flow.
create or replace function public.guard_payment_correction()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or public.current_employee_role() <> 'owner' then
    raise exception 'Only an active Owner may correct a saved payment';
  end if;

  if nullif(btrim(coalesce(new.correction_reason, '')), '') is null then
    raise exception 'A correction reason is required';
  end if;

  new.corrected_by := auth.uid();
  new.corrected_at := now();

  insert into public.activity_logs (
    actor_id, branch_id, action, entity_type, entity_id, details
  ) values (
    auth.uid(),
    new.branch_id,
    'payment.corrected',
    'payment',
    new.id,
    jsonb_build_object(
      'reason', new.correction_reason,
      'before', jsonb_build_object(
        'amount', old.amount,
        'method', old.method,
        'status', old.status,
        'paid_at', old.paid_at,
        'note', old.note
      ),
      'after', jsonb_build_object(
        'amount', new.amount,
        'method', new.method,
        'status', new.status,
        'paid_at', new.paid_at,
        'note', new.note
      )
    )
  );

  return new;
end;
$$;

drop trigger if exists payments_guard_correction on public.payments;
create trigger payments_guard_correction
before update on public.payments
for each row execute function public.guard_payment_correction();

-- Remove the previous Manager-only customer delete rule. Any active employee may
-- delete a customer only if no order references that customer, preserving history.
drop policy if exists customers_manager_delete on public.customers;
drop policy if exists customers_employee_delete_without_orders on public.customers;

create policy customers_employee_delete_without_orders
on public.customers
for delete
to authenticated
using (
  public.is_active_employee()
  and not exists (
    select 1 from public.orders o where o.customer_id = customers.id
  )
);

commit;
