create table if not exists public.crm_users (
  email text primary key,
  display_name text not null,
  role text not null default 'agent' check (role in ('broker', 'agent')),
  active boolean not null default true,
  invited_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (email = lower(email)),
  check (email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  check (char_length(display_name) between 1 and 120)
);

insert into public.crm_users (email, display_name, role, active)
select email, split_part(email, '@', 1), 'broker', true
from crm_private.crm_admins
on conflict (email) do update set role = 'broker', active = true;

insert into public.crm_users (email, display_name, role, active)
values ('roque@floridasoutheastrealty.com', 'Roque Rodriguez', 'broker', true)
on conflict (email) do update set display_name = excluded.display_name, role = 'broker', active = true;

alter table public.crm_users enable row level security;
revoke all on public.crm_users from public, anon, authenticated;
grant select, insert, update on public.crm_users to authenticated;

create index if not exists crm_users_active_role_idx
on public.crm_users (role, email)
where active = true;

create index if not exists crm_leads_assigned_to_idx
on public.crm_leads (lower(assigned_to), created_at desc)
where assigned_to is not null;

create index if not exists crm_tasks_assigned_to_open_idx
on public.crm_tasks (lower(assigned_to), due_at)
where assigned_to is not null and completed_at is null;

create or replace function crm_private.current_crm_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role
  from public.crm_users
  where email = lower(coalesce((select auth.jwt()) ->> 'email', ''))
    and active = true;
$$;

create or replace function crm_private.is_crm_broker()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select crm_private.current_crm_role()) = 'broker', false);
$$;

create or replace function crm_private.can_access_crm_lead(assigned_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case (select crm_private.current_crm_role())
    when 'broker' then true
    when 'agent' then lower(coalesce(assigned_email, '')) = lower(coalesce((select auth.jwt()) ->> 'email', ''))
    else false
  end;
$$;

create or replace function crm_private.can_access_crm_lead_id(requested_lead_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.crm_leads
    where id = requested_lead_id
      and (select crm_private.can_access_crm_lead(assigned_to))
  );
$$;

create or replace function public.crm_login_allowed(p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.crm_users
    where email = lower(btrim(coalesce(p_email, '')))
      and active = true
  );
$$;

revoke all on function crm_private.current_crm_role() from public, anon, authenticated;
revoke all on function crm_private.is_crm_broker() from public, anon, authenticated;
revoke all on function crm_private.can_access_crm_lead(text) from public, anon, authenticated;
revoke all on function crm_private.can_access_crm_lead_id(bigint) from public, anon, authenticated;
grant execute on function crm_private.current_crm_role() to authenticated;
grant execute on function crm_private.is_crm_broker() to authenticated;
grant execute on function crm_private.can_access_crm_lead(text) to authenticated;
grant execute on function crm_private.can_access_crm_lead_id(bigint) to authenticated;

revoke all on function public.crm_login_allowed(text) from public;
grant execute on function public.crm_login_allowed(text) to anon, authenticated;

drop policy if exists "crm users read own profile" on public.crm_users;
create policy "crm users read own profile"
on public.crm_users for select to authenticated
using (
  (select crm_private.is_crm_broker())
  or email = lower(coalesce((select auth.jwt()) ->> 'email', ''))
);

drop policy if exists "crm brokers add team members" on public.crm_users;
create policy "crm brokers add team members"
on public.crm_users for insert to authenticated
with check ((select crm_private.is_crm_broker()));

drop policy if exists "crm brokers update team members" on public.crm_users;
create policy "crm brokers update team members"
on public.crm_users for update to authenticated
using ((select crm_private.is_crm_broker()))
with check ((select crm_private.is_crm_broker()));

drop policy if exists "crm admins manage leads" on public.crm_leads;
drop policy if exists "crm users read assigned leads" on public.crm_leads;
drop policy if exists "crm users update assigned leads" on public.crm_leads;
create policy "crm users read assigned leads"
on public.crm_leads for select to authenticated
using ((select crm_private.can_access_crm_lead(assigned_to)));
create policy "crm users update assigned leads"
on public.crm_leads for update to authenticated
using ((select crm_private.can_access_crm_lead(assigned_to)))
with check ((select crm_private.can_access_crm_lead(assigned_to)));

drop policy if exists "crm admins manage activities" on public.crm_activities;
drop policy if exists "crm users read assigned activities" on public.crm_activities;
drop policy if exists "crm users add assigned activities" on public.crm_activities;
create policy "crm users read assigned activities"
on public.crm_activities for select to authenticated
using ((select crm_private.can_access_crm_lead_id(lead_id)));
create policy "crm users add assigned activities"
on public.crm_activities for insert to authenticated
with check ((select crm_private.can_access_crm_lead_id(lead_id)));

drop policy if exists "crm admins manage tasks" on public.crm_tasks;
drop policy if exists "crm users read assigned tasks" on public.crm_tasks;
drop policy if exists "crm users add assigned tasks" on public.crm_tasks;
drop policy if exists "crm users update assigned tasks" on public.crm_tasks;
create policy "crm users read assigned tasks"
on public.crm_tasks for select to authenticated
using (
  (select crm_private.is_crm_broker())
  or lower(coalesce(assigned_to, '')) = lower(coalesce((select auth.jwt()) ->> 'email', ''))
  or (lead_id is not null and (select crm_private.can_access_crm_lead_id(lead_id)))
);
create policy "crm users add assigned tasks"
on public.crm_tasks for insert to authenticated
with check (
  (select crm_private.is_crm_broker())
  or (
    lower(coalesce(assigned_to, '')) = lower(coalesce((select auth.jwt()) ->> 'email', ''))
    and (lead_id is null or (select crm_private.can_access_crm_lead_id(lead_id)))
  )
);
create policy "crm users update assigned tasks"
on public.crm_tasks for update to authenticated
using (
  (select crm_private.is_crm_broker())
  or lower(coalesce(assigned_to, '')) = lower(coalesce((select auth.jwt()) ->> 'email', ''))
  or (lead_id is not null and (select crm_private.can_access_crm_lead_id(lead_id)))
)
with check (
  (select crm_private.is_crm_broker())
  or lower(coalesce(assigned_to, '')) = lower(coalesce((select auth.jwt()) ->> 'email', ''))
);

drop policy if exists "crm admins manage saved searches" on public.saved_searches;
drop policy if exists "crm users read assigned saved searches" on public.saved_searches;
drop policy if exists "crm users update assigned saved searches" on public.saved_searches;
create policy "crm users read assigned saved searches"
on public.saved_searches for select to authenticated
using ((select crm_private.can_access_crm_lead_id(lead_id)));
create policy "crm users update assigned saved searches"
on public.saved_searches for update to authenticated
using ((select crm_private.can_access_crm_lead_id(lead_id)))
with check ((select crm_private.can_access_crm_lead_id(lead_id)));

create or replace function crm_private.touch_crm_user()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.email := lower(btrim(new.email));
  new.display_name := btrim(new.display_name);
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists touch_crm_user on public.crm_users;
create trigger touch_crm_user
before insert or update on public.crm_users
for each row execute function crm_private.touch_crm_user();

comment on table public.crm_users is 'Authorized CRM team members. Brokers can access all leads; agents can access only leads assigned to their email.';
comment on function public.crm_login_allowed(text) is 'Returns whether one exact email is active in the CRM allowlist; used only before passwordless sign-in.';
