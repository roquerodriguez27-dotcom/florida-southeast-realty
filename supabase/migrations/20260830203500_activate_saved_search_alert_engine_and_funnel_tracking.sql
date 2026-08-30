create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

alter table public.saved_searches
  add column if not exists last_snapshot jsonb not null default '[]'::jsonb,
  add column if not exists processing_started_at timestamptz,
  add column if not exists unsubscribe_token uuid not null default gen_random_uuid();

create unique index if not exists saved_searches_unsubscribe_token_idx on public.saved_searches (unsubscribe_token);
create index if not exists saved_searches_due_idx on public.saved_searches (status, frequency, last_evaluated_at);
create index if not exists site_analytics_visitor_time_idx on private.site_analytics_events (visitor_id, occurred_at desc);
create index if not exists site_analytics_event_time_idx on private.site_analytics_events (event_name, occurred_at desc);

create or replace function private.saved_search_cron_token_valid(p_token text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select decrypted_secret = p_token from vault.decrypted_secrets where name = 'fsr_saved_search_cron_token' order by created_at desc limit 1), false);
$$;
revoke all on function private.saved_search_cron_token_valid(text) from public, anon, authenticated;
grant execute on function private.saved_search_cron_token_valid(text) to service_role;

create or replace function public.claim_due_saved_searches(p_token text, p_limit integer default 6)
returns table (
  search_id uuid, full_name text, email text, frequency text, criteria jsonb,
  alert_new_matches boolean, alert_price_changes boolean, alert_back_on_market boolean,
  last_snapshot jsonb, unsubscribe_token uuid, first_run boolean
)
language plpgsql security definer set search_path = '' as $$
declare claim_limit integer := greatest(1, least(coalesce(p_limit, 6), 12));
begin
  if not private.saved_search_cron_token_valid(p_token) then raise exception 'Invalid saved-search worker token.' using errcode = '28000'; end if;
  return query
  with due as (
    select s.id from public.saved_searches s
    where s.status = 'active'
      and (s.processing_started_at is null or s.processing_started_at < now() - interval '10 minutes')
      and (s.last_evaluated_at is null
        or (s.frequency = 'instant' and s.last_evaluated_at <= now() - interval '15 minutes')
        or (s.frequency = 'daily' and s.last_evaluated_at <= now() - interval '23 hours')
        or (s.frequency = 'weekly' and s.last_evaluated_at <= now() - interval '6 days 23 hours'))
    order by s.last_evaluated_at nulls first, s.created_at
    for update skip locked limit claim_limit
  ), claimed as (
    update public.saved_searches s set processing_started_at = now(), updated_at = now()
    from due where s.id = due.id
    returning s.id, s.full_name, s.email, s.frequency, s.criteria, s.alert_new_matches,
      s.alert_price_changes, s.alert_back_on_market, s.last_snapshot, s.unsubscribe_token, s.last_evaluated_at
  )
  select c.id, c.full_name, c.email, c.frequency, c.criteria, c.alert_new_matches,
    c.alert_price_changes, c.alert_back_on_market, c.last_snapshot, c.unsubscribe_token, c.last_evaluated_at is null
  from claimed c;
end; $$;
revoke all on function public.claim_due_saved_searches(text, integer) from public, authenticated;
grant execute on function public.claim_due_saved_searches(text, integer) to anon, service_role;

create or replace function public.complete_saved_search_evaluation(p_token text, p_search_id uuid, p_snapshot jsonb, p_sent boolean default false)
returns boolean language plpgsql security definer set search_path = '' as $$
declare clean_snapshot jsonb := coalesce(p_snapshot, '[]'::jsonb);
begin
  if not private.saved_search_cron_token_valid(p_token) then raise exception 'Invalid saved-search worker token.' using errcode = '28000'; end if;
  if jsonb_typeof(clean_snapshot) <> 'array' or jsonb_array_length(clean_snapshot) > 24 or octet_length(clean_snapshot::text) > 196608 then raise exception 'Invalid saved-search snapshot.' using errcode = '22023'; end if;
  update public.saved_searches set last_snapshot = clean_snapshot, last_evaluated_at = now(),
    last_sent_at = case when coalesce(p_sent, false) then now() else last_sent_at end,
    processing_started_at = null, updated_at = now()
  where id = p_search_id and status = 'active';
  return found;
end; $$;
revoke all on function public.complete_saved_search_evaluation(text, uuid, jsonb, boolean) from public, authenticated;
grant execute on function public.complete_saved_search_evaluation(text, uuid, jsonb, boolean) to anon, service_role;

create or replace function public.release_saved_search_claim(p_token text, p_search_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not private.saved_search_cron_token_valid(p_token) then raise exception 'Invalid saved-search worker token.' using errcode = '28000'; end if;
  update public.saved_searches set processing_started_at = null, updated_at = now() where id = p_search_id;
  return found;
end; $$;
revoke all on function public.release_saved_search_claim(text, uuid) from public, authenticated;
grant execute on function public.release_saved_search_claim(text, uuid) to anon, service_role;

create or replace function public.unsubscribe_saved_search(p_token uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.saved_searches set status = 'unsubscribed', processing_started_at = null, updated_at = now()
  where unsubscribe_token = p_token and status <> 'unsubscribed';
  return found;
end; $$;
revoke all on function public.unsubscribe_saved_search(uuid) from public, authenticated;
grant execute on function public.unsubscribe_saved_search(uuid) to anon, service_role;

create or replace function public.capture_site_analytics_event(
  p_visitor_id uuid, p_session_id uuid, p_event_name text, p_path text,
  p_referrer_host text default null, p_metadata jsonb default '{}'::jsonb
)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if p_event_name is null or p_event_name <> all (array['page_view','property_search','property_view','home_valuation_view','lead_submit','phone_click','email_click','saved_search_submit','compare_change','buyer_tool_use']::text[]) then return false; end if;
  if p_path is null or char_length(p_path) < 1 or char_length(p_path) > 600 or left(p_path,1) <> '/' then return false; end if;
  if p_referrer_host is not null and char_length(p_referrer_host) > 253 then return false; end if;
  if p_metadata is null or pg_catalog.jsonb_typeof(p_metadata) <> 'object' or pg_catalog.octet_length(p_metadata::text) > 4096 then return false; end if;
  if exists (select 1 from private.site_analytics_events e where e.visitor_id = p_visitor_id and e.event_name = p_event_name and e.path = p_path and e.occurred_at > now() - interval '1 second') then return true; end if;
  if (select count(*) from private.site_analytics_events e where e.visitor_id = p_visitor_id and e.occurred_at > now() - interval '1 minute') >= 120 then return true; end if;
  insert into private.site_analytics_events(visitor_id, session_id, event_name, path, referrer_host, metadata)
  values(p_visitor_id, p_session_id, p_event_name, p_path, nullif(lower(trim(p_referrer_host)), ''), p_metadata);
  return true;
end; $$;
revoke all on function public.capture_site_analytics_event(uuid, uuid, text, text, text, jsonb) from public, authenticated;
grant execute on function public.capture_site_analytics_event(uuid, uuid, text, text, text, jsonb) to anon, service_role;
