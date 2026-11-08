-- Shared admission for actual FBS requests. These are application safeguards,
-- not claims about an undocumented provider concurrency ceiling.
-- Provision a random server-only token separately; store only its SHA256 below.
-- The new schema is deliberately NOT added to PostgREST's exposed schemas.
create schema if not exists fsr_mls_private;
revoke all on schema fsr_mls_private from public, anon, authenticated, service_role;
grant usage on schema fsr_mls_private to anon;

create table fsr_mls_private.credentials (
  coordinator_id uuid primary key default gen_random_uuid(),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);
alter table fsr_mls_private.credentials enable row level security;
revoke all on fsr_mls_private.credentials from public, anon, authenticated, service_role;
grant select (coordinator_id) on fsr_mls_private.credentials to anon;

create function fsr_mls_private.request_token_hash()
returns text language plpgsql stable security invoker set search_path = '' as $$
declare token text;
begin
  -- The RPC client always uses the publishable key, never a browser session.
  if current_user <> 'anon' then return null; end if;
  begin
    token := nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-fsr-mls-coordinator';
  exception when invalid_text_representation then
    return null;
  end;
  if token is null or char_length(token) < 32 or char_length(token) > 256 then return null; end if;
  return encode(sha256(convert_to(token, 'UTF8')), 'hex');
end;
$$;
revoke all on function fsr_mls_private.request_token_hash() from public, anon, authenticated, service_role;
grant execute on function fsr_mls_private.request_token_hash() to anon;

create policy credential_header_matches on fsr_mls_private.credentials
for select to anon using (
  enabled and token_hash = (select fsr_mls_private.request_token_hash())
);

create function fsr_mls_private.coordinator_id()
returns uuid language sql stable security invoker set search_path = '' as $$
  select case when current_user = 'anon'
    and fsr_mls_private.request_token_hash() is not null
    then (select c.coordinator_id from fsr_mls_private.credentials c limit 1)
    else null end;
$$;
revoke all on function fsr_mls_private.coordinator_id() from public, anon, authenticated, service_role;
grant execute on function fsr_mls_private.coordinator_id() to anon;

create table fsr_mls_private.scopes (
  coordinator_id uuid not null references fsr_mls_private.credentials(coordinator_id) on delete cascade,
  scope_hash text not null check (scope_hash ~ '^[a-f0-9]{64}$'),
  generation bigint not null default 0 check (generation >= 0),
  consecutive_failures integer not null default 0 check (consecutive_failures >= 0),
  pause_until timestamptz not null default 'epoch',
  pause_reason text not null default 'unavailable' check (pause_reason in ('throttled', 'unavailable')),
  updated_at timestamptz not null default now(),
  primary key (coordinator_id, scope_hash)
);

create table fsr_mls_private.queries (
  coordinator_id uuid not null,
  scope_hash text not null,
  query_hash text not null check (query_hash ~ '^[a-f0-9]{64}$'),
  owner uuid,
  started_generation bigint not null default 0,
  active_until timestamptz not null default 'epoch',
  blocked_until timestamptz not null default 'epoch',
  block_reason text not null default 'duplicate' check (block_reason in ('duplicate', 'throttled', 'unavailable')),
  response jsonb,
  response_bytes integer not null default 0 check (response_bytes between 0 and 2097152),
  cache_until timestamptz not null default 'epoch',
  cache_stored_at timestamptz not null default 'epoch',
  updated_at timestamptz not null default now(),
  primary key (coordinator_id, scope_hash, query_hash),
  foreign key (coordinator_id, scope_hash) references fsr_mls_private.scopes(coordinator_id, scope_hash) on delete cascade
);
create index mls_queries_active on fsr_mls_private.queries(coordinator_id, scope_hash, active_until);
create index mls_queries_cache on fsr_mls_private.queries(coordinator_id, scope_hash, cache_until);

create table fsr_mls_private.starts (
  coordinator_id uuid not null,
  scope_hash text not null,
  owner uuid not null,
  started_at timestamptz not null default now(),
  primary key (coordinator_id, scope_hash, owner),
  foreign key (coordinator_id, scope_hash) references fsr_mls_private.scopes(coordinator_id, scope_hash) on delete cascade
);
create index mls_starts_window on fsr_mls_private.starts(coordinator_id, scope_hash, started_at);

alter table fsr_mls_private.scopes enable row level security;
alter table fsr_mls_private.queries enable row level security;
alter table fsr_mls_private.starts enable row level security;
revoke all on fsr_mls_private.scopes, fsr_mls_private.queries, fsr_mls_private.starts
  from public, anon, authenticated, service_role;
grant select, insert, update, delete on fsr_mls_private.scopes, fsr_mls_private.queries, fsr_mls_private.starts to anon;

create policy coordinator_scopes on fsr_mls_private.scopes for all to anon
  using (coordinator_id = (select fsr_mls_private.coordinator_id()))
  with check (coordinator_id = (select fsr_mls_private.coordinator_id()));
create policy coordinator_queries on fsr_mls_private.queries for all to anon
  using (coordinator_id = (select fsr_mls_private.coordinator_id()))
  with check (coordinator_id = (select fsr_mls_private.coordinator_id()));
create policy coordinator_starts on fsr_mls_private.starts for all to anon
  using (coordinator_id = (select fsr_mls_private.coordinator_id()))
  with check (coordinator_id = (select fsr_mls_private.coordinator_id()));

create function fsr_mls_private.valid_snapshot(p_response jsonb)
returns boolean language plpgsql immutable security invoker set search_path = '' as $$
declare h jsonb; seen text[] := '{}'::text[]; decoded bytea;
begin
  if p_response is null then return true; end if;
  if jsonb_typeof(p_response) <> 'object' or octet_length(p_response::text) > 2097152
    or not (p_response ?& array['body', 'status', 'headers'])
    or p_response - 'body' - 'status' - 'headers' <> '{}'::jsonb
    or jsonb_typeof(p_response -> 'body') <> 'string'
    or jsonb_typeof(p_response -> 'status') <> 'number'
    or (p_response ->> 'status') !~ '^2[0-9]{2}$'
    or jsonb_typeof(p_response -> 'headers') <> 'array'
    then return false; end if;
  if jsonb_array_length(p_response -> 'headers') > 8 then return false; end if;
  begin
    decoded := decode(p_response ->> 'body', 'base64');
  exception when others then return false;
  end;
  if (p_response ->> 'status') in ('204', '205') and octet_length(decoded) > 0 then return false; end if;
  for h in select value from jsonb_array_elements(p_response -> 'headers') loop
    if jsonb_typeof(h) <> 'array' then return false; end if;
    if jsonb_array_length(h) <> 2 or jsonb_typeof(h -> 0) <> 'string' or jsonb_typeof(h -> 1) <> 'string'
      then return false; end if;
    if (h ->> 0) <> all(array['content-type','cache-control','etag','last-modified','expires','date','vary'])
      or (h ->> 0) = any(seen) or char_length(h ->> 1) > 2048 or (h ->> 1) ~ E'[\r\n]'
      then return false; end if;
    seen := array_append(seen, h ->> 0);
  end loop;
  return true;
end;
$$;
revoke all on function fsr_mls_private.valid_snapshot(jsonb) from public, anon, authenticated, service_role;
grant execute on function fsr_mls_private.valid_snapshot(jsonb) to anon;

create function public.fsr_mls_acquire(p_scope_hash text, p_query_hash text, p_owner uuid)
returns jsonb language plpgsql security invoker set search_path = '' set lock_timeout = '500ms' as $$
declare
  cid uuid := fsr_mls_private.coordinator_id();
  s fsr_mls_private.scopes%rowtype;
  q fsr_mls_private.queries%rowtype;
  t timestamptz;
  active_count integer;
  start_count integer;
  next_time timestamptz;
begin
  if cid is null then raise exception 'MLS coordinator authentication required.' using errcode = '28000'; end if;
  if p_scope_hash is null or p_scope_hash !~ '^[a-f0-9]{64}$'
    or p_query_hash is null or p_query_hash !~ '^[a-f0-9]{64}$' or p_owner is null
    then raise exception 'Invalid MLS coordinator request.' using errcode = '22023'; end if;

  insert into fsr_mls_private.scopes(coordinator_id, scope_hash) values(cid, p_scope_hash) on conflict do nothing;
  -- One short transaction serializes every decision for this application/feed.
  -- No database transaction remains open while the application contacts FBS.
  select * into strict s from fsr_mls_private.scopes
    where coordinator_id = cid and scope_hash = p_scope_hash for update;
  t := clock_timestamp();

  delete from fsr_mls_private.starts where coordinator_id = cid and scope_hash = p_scope_hash
    and started_at <= t - interval '5 minutes';
  update fsr_mls_private.queries set response = null, response_bytes = 0
    where coordinator_id = cid and scope_hash = p_scope_hash and cache_until <= t and response is not null;
  delete from fsr_mls_private.queries where coordinator_id = cid and scope_hash = p_scope_hash
    and active_until <= t and blocked_until <= t and cache_until <= t and updated_at < t - interval '330 seconds';

  select * into q from fsr_mls_private.queries
    where coordinator_id = cid and scope_hash = p_scope_hash and query_hash = p_query_hash;
  if found and q.cache_until > t and q.response is not null then
    return jsonb_build_object('decision','cached','snapshot',q.response);
  end if;
  if s.pause_until > t then
    return jsonb_build_object('decision','paused','reason',s.pause_reason,
      'retry_after_ms', greatest(1, ceil(extract(epoch from (s.pause_until - t)) * 1000)::bigint));
  end if;
  if q.active_until > t or q.blocked_until > t then
    next_time := greatest(q.active_until, q.blocked_until);
    return jsonb_build_object('decision','waiting','reason',q.block_reason,
      'retry_after_ms', greatest(1, ceil(extract(epoch from (next_time - t)) * 1000)::bigint));
  end if;

  select count(*), min(active_until) into active_count, next_time from fsr_mls_private.queries
    where coordinator_id = cid and scope_hash = p_scope_hash and active_until > t;
  if active_count >= 4 or (s.consecutive_failures > 0 and active_count > 0) then
    return jsonb_build_object('decision','paused','reason','capacity',
      'retry_after_ms', greatest(1, ceil(extract(epoch from (next_time - t)) * 1000)::bigint));
  end if;

  select count(*), min(started_at) + interval '5 minutes' into start_count, next_time
    from fsr_mls_private.starts where coordinator_id = cid and scope_hash = p_scope_hash;
  if start_count >= 1200 then
    return jsonb_build_object('decision','paused','reason','budget',
      'retry_after_ms', greatest(1, ceil(extract(epoch from (next_time - t)) * 1000)::bigint));
  end if;
  -- A replayed reservation UUID must never authorize a second network call.
  if exists(select 1 from fsr_mls_private.starts where coordinator_id = cid and scope_hash = p_scope_hash and owner = p_owner) then
    return jsonb_build_object('decision','paused','reason','unavailable','retry_after_ms',30000);
  end if;

  insert into fsr_mls_private.starts(coordinator_id, scope_hash, owner, started_at)
    values(cid, p_scope_hash, p_owner, t);
  insert into fsr_mls_private.queries(coordinator_id, scope_hash, query_hash, owner, started_generation,
    active_until, blocked_until, block_reason, updated_at)
    values(cid, p_scope_hash, p_query_hash, p_owner, s.generation, t + interval '330 seconds', 'epoch', 'duplicate', t)
    on conflict (coordinator_id, scope_hash, query_hash) do update set owner = excluded.owner,
      started_generation = excluded.started_generation, active_until = excluded.active_until,
      blocked_until = 'epoch', block_reason = 'duplicate', updated_at = excluded.updated_at;
  return jsonb_build_object('decision','granted');
end;
$$;
revoke all on function public.fsr_mls_acquire(text, text, uuid) from public, anon, authenticated, service_role;
grant execute on function public.fsr_mls_acquire(text, text, uuid) to anon;

create function public.fsr_mls_finish(
  p_scope_hash text, p_query_hash text, p_owner uuid, p_outcome text,
  p_retry_after_ms bigint default 0, p_response jsonb default null
) returns boolean language plpgsql security invoker set search_path = '' set lock_timeout = '500ms' as $$
declare
  cid uuid := fsr_mls_private.coordinator_id();
  s fsr_mls_private.scopes%rowtype;
  q fsr_mls_private.queries%rowtype;
  t timestamptz;
  delay_ms bigint;
  failures integer;
  next_generation bigint;
  v_pause_reason text;
begin
  if cid is null then raise exception 'MLS coordinator authentication required.' using errcode = '28000'; end if;
  if p_scope_hash is null or p_scope_hash !~ '^[a-f0-9]{64}$'
    or p_query_hash is null or p_query_hash !~ '^[a-f0-9]{64}$' or p_owner is null
    or p_outcome is null or p_outcome <> all(array['success','http_error','throttled','interrupted','cancelled','not_sent'])
    or p_retry_after_ms is null or p_retry_after_ms < 0 or p_retry_after_ms > 9007199254740991
    then raise exception 'Invalid MLS coordinator completion.' using errcode = '22023'; end if;
  if (p_outcome <> 'success' and p_response is not null) or not fsr_mls_private.valid_snapshot(p_response) then
    raise exception 'Invalid MLS response snapshot.' using errcode = '22023';
  end if;

  select * into s from fsr_mls_private.scopes where coordinator_id = cid and scope_hash = p_scope_hash for update;
  if not found then return false; end if;
  t := clock_timestamp();
  select * into q from fsr_mls_private.queries where coordinator_id = cid and scope_hash = p_scope_hash and query_hash = p_query_hash;
  if not found or q.owner is distinct from p_owner then return false; end if;

  if p_outcome = 'success' then
    update fsr_mls_private.queries set owner = null, active_until = 'epoch', blocked_until = 'epoch',
      response = p_response, response_bytes = case when p_response is null then 0 else octet_length(p_response::text) end,
      cache_until = case when p_response is null then 'epoch'::timestamptz else t + interval '30 seconds' end,
      cache_stored_at = t, updated_at = t
      where coordinator_id = cid and scope_hash = p_scope_hash and query_hash = p_query_hash;
    -- A response started before another failure cannot cancel its newer pause.
    if q.started_generation = s.generation then
      update fsr_mls_private.scopes set consecutive_failures = 0, pause_until = 'epoch', updated_at = t
        where coordinator_id = cid and scope_hash = p_scope_hash;
    end if;
    -- Bound private transient results to 32 snapshots / 32 MiB per scope.
    with ranked as (
      select query_hash,
        row_number() over(order by cache_stored_at desc, query_hash) as row_n,
        sum(response_bytes) over(order by cache_stored_at desc, query_hash rows unbounded preceding) as byte_n
      from fsr_mls_private.queries where coordinator_id = cid and scope_hash = p_scope_hash
        and response is not null and cache_until > t
    ) update fsr_mls_private.queries target set response = null, response_bytes = 0, cache_until = 'epoch'
      from ranked where target.coordinator_id = cid and target.scope_hash = p_scope_hash
        and target.query_hash = ranked.query_hash and (ranked.row_n > 32 or ranked.byte_n > 33554432);
    return true;
  end if;

  if p_outcome = 'not_sent' then
    update fsr_mls_private.queries set owner = null, active_until = 'epoch', blocked_until = 'epoch', updated_at = t
      where coordinator_id = cid and scope_hash = p_scope_hash and query_hash = p_query_hash;
    -- Only a definite pre-dispatch rejection refunds the reserved provider hit.
    delete from fsr_mls_private.starts where coordinator_id = cid and scope_hash = p_scope_hash and owner = p_owner;
    return true;
  end if;

  if p_outcome = 'cancelled' then
    update fsr_mls_private.queries set owner = null, active_until = t + interval '30 seconds',
      blocked_until = t + interval '30 seconds', block_reason = 'duplicate', updated_at = t
      where coordinator_id = cid and scope_hash = p_scope_hash and query_hash = p_query_hash;
    return true;
  end if;

  failures := s.consecutive_failures;
  next_generation := s.generation;
  if q.started_generation = s.generation then
    failures := least(1000000, failures + 1);
    next_generation := s.generation + 1;
  end if;
  delay_ms := greatest(p_retry_after_ms, case when p_outcome = 'throttled' then 300000::bigint
    else least(300000::bigint, 30000::bigint * (2::bigint ^ least(4, greatest(0, failures - 1)))::bigint) end);
  v_pause_reason := case when p_outcome = 'throttled' or (s.pause_until > t and s.pause_reason = 'throttled')
    then 'throttled' else 'unavailable' end;
  update fsr_mls_private.scopes set generation = next_generation, consecutive_failures = failures,
    pause_until = greatest(pause_until, t + delay_ms * interval '1 millisecond'),
    pause_reason = v_pause_reason, updated_at = t
    where coordinator_id = cid and scope_hash = p_scope_hash;
  update fsr_mls_private.queries set owner = null,
    active_until = case when p_outcome = 'interrupted' then t + interval '30 seconds' else 'epoch'::timestamptz end,
    blocked_until = t + delay_ms * interval '1 millisecond',
    block_reason = case when p_outcome = 'throttled' then 'throttled' else 'unavailable' end,
    updated_at = t where coordinator_id = cid and scope_hash = p_scope_hash and query_hash = p_query_hash;
  return true;
end;
$$;
revoke all on function public.fsr_mls_finish(text, text, uuid, text, bigint, jsonb) from public, anon, authenticated, service_role;
grant execute on function public.fsr_mls_finish(text, text, uuid, text, bigint, jsonb) to anon;

comment on schema fsr_mls_private is 'Internal MLS request coordination. Access requires a server-only custom header; do not expose this schema through the Data API.';
comment on table fsr_mls_private.credentials is 'Only SHA256 fingerprints of independently generated server credentials. Never place a Spark token here.';
comment on function public.fsr_mls_acquire(text, text, uuid) is 'Atomic application-wide MLS request reservation, cache and rolling budget. Four concurrency / 1200 per five minutes are application settings.';
comment on function public.fsr_mls_finish(text, text, uuid, text, bigint, jsonb) is 'Fenced completion; actual429 gets at least300s, interrupted work retains30s, abandoned reservations expire after330s.';

notify pgrst, 'reload schema';
