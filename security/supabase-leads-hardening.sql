-- Supabase lead table hardening checklist.
-- Review column names first, then run in Supabase SQL Editor for project evqmticivailwbocynub.
-- Goal: browser clients may only INSERT valid leads; they must not SELECT/UPDATE/DELETE leads.

alter table public.leads enable row level security;

revoke all on table public.leads from anon;
revoke all on table public.leads from authenticated;
grant insert on table public.leads to anon;

drop policy if exists "anon_can_insert_safe_leads" on public.leads;
create policy "anon_can_insert_safe_leads"
on public.leads
for insert
to anon
with check (
  char_length(coalesce(name, '')) between 1 and 80
  and phone ~ '^\+?[0-9()\-\s]{8,22}$'
  and (
    email is null
    or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  )
  and type in ('консультація', 'бізнес', 'дзвінок')
  and status = 'Новий'
  and char_length(coalesce(comment, '')) <= 1000
);

-- Optional: keep future public-schema tables/functions private unless deliberately exposed.
alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke usage, select on sequences from anon, authenticated, service_role;
