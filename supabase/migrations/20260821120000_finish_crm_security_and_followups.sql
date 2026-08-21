create schema if not exists crm_private;
revoke all on schema crm_private from public;

create table if not exists crm_private.crm_admins (
  email text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);

insert into crm_private.crm_admins (email)
values ('roque@floridasoutheastrealty.com')
on conflict (email) do nothing;

alter table crm_private.crm_admins enable row level security;
revoke all on crm_private.crm_admins from public, anon, authenticated;

create or replace function crm_private.is_crm_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from crm_private.crm_admins
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function crm_private.is_crm_admin() from public;
grant usage on schema crm_private to authenticated;
grant execute on function crm_private.is_crm_admin() to authenticated;

grant select, insert, update on public.crm_leads to authenticated;
grant select, insert on public.crm_activities to authenticated;
grant select, insert, update on public.crm_tasks to authenticated;
grant select, update on public.saved_searches to authenticated;
grant usage, select on sequence public.crm_leads_id_seq, public.crm_activities_id_seq, public.crm_tasks_id_seq to authenticated;

drop policy if exists "crm admins manage leads" on public.crm_leads;
create policy "crm admins manage leads"
on public.crm_leads for all to authenticated
using ((select crm_private.is_crm_admin()))
with check ((select crm_private.is_crm_admin()));

drop policy if exists "crm admins manage activities" on public.crm_activities;
create policy "crm admins manage activities"
on public.crm_activities for all to authenticated
using ((select crm_private.is_crm_admin()))
with check ((select crm_private.is_crm_admin()));

drop policy if exists "crm admins manage tasks" on public.crm_tasks;
create policy "crm admins manage tasks"
on public.crm_tasks for all to authenticated
using ((select crm_private.is_crm_admin()))
with check ((select crm_private.is_crm_admin()));

drop policy if exists "crm admins manage saved searches" on public.saved_searches;
create policy "crm admins manage saved searches"
on public.saved_searches for all to authenticated
using ((select crm_private.is_crm_admin()))
with check ((select crm_private.is_crm_admin()));

alter table public.crm_tasks add column if not exists automation_key text;
create unique index if not exists crm_tasks_open_automation_idx
on public.crm_tasks (lead_id, automation_key)
where completed_at is null and automation_key is not null;

create or replace function crm_private.prepare_crm_lead()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.assigned_to := coalesce(nullif(btrim(new.assigned_to), ''), 'roque@floridasoutheastrealty.com');
  new.updated_at := now();

  if new.status in ('closed', 'lost') then
    new.next_follow_up_at := null;
  elsif tg_op = 'INSERT' and new.next_follow_up_at is null then
    new.next_follow_up_at := now() + interval '15 minutes';
  end if;

  return new;
end;
$$;

create or replace function crm_private.sync_crm_follow_up()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  follow_up_title text;
begin
  if new.status in ('closed', 'lost') or new.next_follow_up_at is null then
    update public.crm_tasks
    set completed_at = coalesce(completed_at, now())
    where lead_id = new.id
      and automation_key = 'lead_follow_up'
      and completed_at is null;
    return new;
  end if;

  follow_up_title := case
    when new.form_name in ('home-valuation', 'sellers-page')
      then 'Review valuation request with ' || new.full_name
    when new.form_name = 'property-inquiry'
      then 'Respond to property inquiry from ' || new.full_name
    when new.form_name = 'saved-search-alert'
      then 'Confirm saved-search alerts with ' || new.full_name
    else 'Contact ' || new.full_name || ' about their website request'
  end;

  insert into public.crm_tasks (
    lead_id,
    title,
    due_at,
    assigned_to,
    created_by,
    automation_key
  ) values (
    new.id,
    follow_up_title,
    new.next_follow_up_at,
    new.assigned_to,
    'crm-automation',
    'lead_follow_up'
  )
  on conflict (lead_id, automation_key) where completed_at is null and automation_key is not null
  do update set
    title = excluded.title,
    due_at = excluded.due_at,
    assigned_to = excluded.assigned_to;

  if tg_op = 'INSERT' then
    insert into public.crm_activities (lead_id, kind, body, created_by)
    values (new.id, 'system', 'Automatic follow-up scheduled for 15 minutes after submission.', 'crm-automation');
  elsif new.next_follow_up_at is distinct from old.next_follow_up_at then
    insert into public.crm_activities (lead_id, kind, body, created_by)
    values (new.id, 'system', 'Automatic follow-up schedule updated.', 'crm-automation');
  end if;

  return new;
end;
$$;

drop trigger if exists prepare_crm_lead on public.crm_leads;
create trigger prepare_crm_lead
before insert or update on public.crm_leads
for each row execute function crm_private.prepare_crm_lead();

drop trigger if exists sync_crm_follow_up on public.crm_leads;
create trigger sync_crm_follow_up
after insert or update on public.crm_leads
for each row execute function crm_private.sync_crm_follow_up();

create or replace function public.capture_crm_lead(
  p_full_name text,
  p_email text,
  p_phone text,
  p_form_name text,
  p_property_interest text,
  p_message text,
  p_fields jsonb,
  p_consent boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_name text := btrim(coalesce(p_full_name, ''));
  clean_email text := lower(btrim(coalesce(p_email, '')));
  clean_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  clean_form_name text := btrim(coalesce(p_form_name, ''));
  clean_fields jsonb := coalesce(p_fields, '{}'::jsonb);
  existing_lead_id bigint;
begin
  if clean_name = '' or char_length(clean_name) > 120 then
    raise exception 'Invalid lead name.' using errcode = '22023';
  end if;
  if clean_email = '' or char_length(clean_email) > 254
    or clean_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Invalid lead email.' using errcode = '22023';
  end if;
  if clean_phone is not null and char_length(clean_phone) > 40 then
    raise exception 'Invalid lead phone.' using errcode = '22023';
  end if;
  if clean_form_name = '' or char_length(clean_form_name) > 100 then
    raise exception 'Invalid form name.' using errcode = '22023';
  end if;
  if not coalesce(p_consent, false) then
    raise exception 'Contact consent is required.' using errcode = '22023';
  end if;
  if jsonb_typeof(clean_fields) <> 'object'
    or octet_length(clean_fields::text) > 32768
    or (select count(*) from jsonb_object_keys(clean_fields)) > 40
    or exists (select 1 from jsonb_each(clean_fields) where jsonb_typeof(value) <> 'string') then
    raise exception 'Invalid lead fields.' using errcode = '22023';
  end if;
  if char_length(coalesce(p_property_interest, '')) > 5000
    or char_length(coalesce(p_message, '')) > 5000 then
    raise exception 'Lead details are too long.' using errcode = '22023';
  end if;

  select id into existing_lead_id
  from public.crm_leads
  where lower(email) = clean_email
    and form_name = clean_form_name
    and fields = clean_fields
    and created_at > now() - interval '2 minutes'
  order by created_at desc
  limit 1;

  if existing_lead_id is not null then
    return true;
  end if;

  insert into public.crm_leads (
    full_name,
    email,
    phone,
    source,
    form_name,
    property_interest,
    message,
    consent,
    fields
  ) values (
    clean_name,
    clean_email,
    clean_phone,
    'website',
    clean_form_name,
    nullif(btrim(coalesce(p_property_interest, '')), ''),
    nullif(btrim(coalesce(p_message, '')), ''),
    true,
    clean_fields
  );

  return true;
end;
$$;

create or replace function public.capture_saved_search(
  p_full_name text,
  p_email text,
  p_phone text,
  p_frequency text,
  p_sms_consent boolean,
  p_criteria jsonb,
  p_idx_active boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_name text := btrim(coalesce(p_full_name, ''));
  clean_email text := lower(btrim(coalesce(p_email, '')));
  clean_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  clean_criteria jsonb := coalesce(p_criteria, '{}'::jsonb);
  lead_id_value bigint;
  duplicate_status text;
  saved_status text := case when coalesce(p_idx_active, false) then 'active' else 'pending_idx' end;
  created_lead boolean := false;
begin
  if clean_name = '' or char_length(clean_name) > 120 then
    raise exception 'Invalid saved-search name.' using errcode = '22023';
  end if;
  if clean_email = '' or char_length(clean_email) > 254
    or clean_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Invalid saved-search email.' using errcode = '22023';
  end if;
  if clean_phone is not null and char_length(clean_phone) > 40 then
    raise exception 'Invalid saved-search phone.' using errcode = '22023';
  end if;
  if p_frequency not in ('instant', 'daily', 'weekly') then
    raise exception 'Invalid alert frequency.' using errcode = '22023';
  end if;
  if coalesce(p_sms_consent, false) and clean_phone is null then
    raise exception 'A phone number is required for text alerts.' using errcode = '22023';
  end if;
  if jsonb_typeof(clean_criteria) <> 'object'
    or octet_length(clean_criteria::text) > 16384
    or (select count(*) from jsonb_object_keys(clean_criteria)) > 20
    or exists (select 1 from jsonb_each(clean_criteria) where jsonb_typeof(value) not in ('string', 'boolean')) then
    raise exception 'Invalid search criteria.' using errcode = '22023';
  end if;

  select status into duplicate_status
  from public.saved_searches
  where lower(email) = clean_email
    and criteria = clean_criteria
    and frequency = p_frequency
    and created_at > now() - interval '2 minutes'
  order by created_at desc
  limit 1;

  if duplicate_status is not null then
    return duplicate_status <> 'active';
  end if;

  select id into lead_id_value
  from public.crm_leads
  where lower(email) = clean_email
  order by created_at desc
  limit 1;

  if lead_id_value is null then
    insert into public.crm_leads (
      full_name,
      email,
      phone,
      source,
      form_name,
      property_interest,
      message,
      consent,
      fields
    ) values (
      clean_name,
      clean_email,
      clean_phone,
      'saved-search',
      'saved-search-alert',
      'Saved property search alerts',
      'Requested ' || p_frequency || ' property alerts.',
      true,
      jsonb_build_object('criteria', clean_criteria, 'frequency', p_frequency, 'smsConsent', coalesce(p_sms_consent, false))
    ) returning id into lead_id_value;
    created_lead := true;
  else
    update public.crm_leads
    set full_name = clean_name,
        phone = coalesce(clean_phone, phone),
        next_follow_up_at = case
          when next_follow_up_at is null or next_follow_up_at > now() + interval '1 hour'
            then now() + interval '1 hour'
          else next_follow_up_at
        end
    where id = lead_id_value;
  end if;

  insert into public.saved_searches (
    lead_id,
    full_name,
    email,
    phone,
    criteria,
    frequency,
    sms_consent_at,
    status
  ) values (
    lead_id_value,
    clean_name,
    clean_email,
    clean_phone,
    clean_criteria,
    p_frequency,
    case when coalesce(p_sms_consent, false) then now() else null end,
    saved_status
  );

  insert into public.crm_activities (lead_id, kind, body, created_by)
  values (
    lead_id_value,
    'system',
    case
      when saved_status = 'active' then 'Saved a ' || p_frequency || ' property alert against the live MLS feed.'
      else 'Saved a ' || p_frequency || ' property alert pending the live MLS connection.'
    end,
    'website'
  );

  if created_lead then
    update public.crm_leads set updated_at = now() where id = lead_id_value;
  end if;

  return saved_status <> 'active';
end;
$$;

revoke all on function public.capture_crm_lead(text, text, text, text, text, text, jsonb, boolean) from public;
revoke all on function public.capture_saved_search(text, text, text, text, boolean, jsonb, boolean) from public;
grant execute on function public.capture_crm_lead(text, text, text, text, text, text, jsonb, boolean) to anon, authenticated;
grant execute on function public.capture_saved_search(text, text, text, text, boolean, jsonb, boolean) to anon, authenticated;

update public.crm_leads
set next_follow_up_at = coalesce(next_follow_up_at, created_at + interval '15 minutes')
where status not in ('closed', 'lost')
  and next_follow_up_at is null;

comment on function public.capture_crm_lead(text, text, text, text, text, text, jsonb, boolean)
is 'Validated, write-only website lead capture. Returns success without exposing CRM rows.';

comment on function public.capture_saved_search(text, text, text, text, boolean, jsonb, boolean)
is 'Validated, write-only saved-search capture. Returns only whether IDX activation remains pending.';
