-- Run this once in Supabase: Dashboard -> SQL Editor -> New query.
-- The policies make each signed-in email account able to access only its own ledger.

create table if not exists public.orders (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  order_date date not null,
  quantity numeric not null check (quantity > 0),
  buying_price numeric not null check (buying_price >= 0),
  selling_price numeric not null check (selling_price >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.petrol_expenses (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  expense_date date not null,
  amount numeric not null check (amount > 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.manufacturer_payments (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  payment_date date not null,
  amount numeric not null check (amount > 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at before update on public.orders for each row execute function public.set_updated_at();
drop trigger if exists petrol_expenses_set_updated_at on public.petrol_expenses;
create trigger petrol_expenses_set_updated_at before update on public.petrol_expenses for each row execute function public.set_updated_at();
drop trigger if exists manufacturer_payments_set_updated_at on public.manufacturer_payments;
create trigger manufacturer_payments_set_updated_at before update on public.manufacturer_payments for each row execute function public.set_updated_at();

alter table public.orders enable row level security;
alter table public.petrol_expenses enable row level security;
alter table public.manufacturer_payments enable row level security;

drop policy if exists "Ledger owner manages orders" on public.orders;
create policy "Ledger owner manages orders" on public.orders for all to authenticated
using (auth.uid() is not null and auth.uid() = user_id)
with check (auth.uid() is not null and auth.uid() = user_id);

drop policy if exists "Ledger owner manages petrol expenses" on public.petrol_expenses;
create policy "Ledger owner manages petrol expenses" on public.petrol_expenses for all to authenticated
using (auth.uid() is not null and auth.uid() = user_id)
with check (auth.uid() is not null and auth.uid() = user_id);

drop policy if exists "Ledger owner manages manufacturer payments" on public.manufacturer_payments;
create policy "Ledger owner manages manufacturer payments" on public.manufacturer_payments for all to authenticated
using (auth.uid() is not null and auth.uid() = user_id)
with check (auth.uid() is not null and auth.uid() = user_id);

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.orders to authenticated;
grant select, insert, update, delete on public.petrol_expenses to authenticated;
grant select, insert, update, delete on public.manufacturer_payments to authenticated;
