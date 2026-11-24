-- ==============================================================================
-- RUN THIS IN SUPABASE SQL EDITOR TO ENABLE CLOUD SYNC FOR MISCELLANEOUS EXPENSES
-- Dashboard -> SQL Editor -> New Query -> Paste & Run
-- ==============================================================================

create table if not exists public.miscellaneous_expenses (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  expense_date date not null,
  amount numeric not null check (amount > 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists miscellaneous_expenses_set_updated_at on public.miscellaneous_expenses;
create trigger miscellaneous_expenses_set_updated_at before update on public.miscellaneous_expenses for each row execute function public.set_updated_at();

alter table public.miscellaneous_expenses enable row level security;

drop policy if exists "Ledger owner manages miscellaneous expenses" on public.miscellaneous_expenses;
create policy "Ledger owner manages miscellaneous expenses" on public.miscellaneous_expenses for all to authenticated
using (auth.uid() is not null and auth.uid() = user_id)
with check (auth.uid() is not null and auth.uid() = user_id);

grant select, insert, update, delete on public.miscellaneous_expenses to authenticated;
