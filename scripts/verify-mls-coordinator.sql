-- Run only after the coordination migration has been installed.
-- All fixtures, header settings, leases and snapshots are rolled back.
-- This script does not make provider requests or use production credentials.
begin;
select set_config('fsr.qa_token', gen_random_uuid()::text || gen_random_uuid()::text, true);
select set_config('fsr.qa_other_token', gen_random_uuid()::text || gen_random_uuid()::text, true);
select set_config('fsr.qa_id', gen_random_uuid()::text, true);
select set_config('fsr.qa_other_id', gen_random_uuid()::text, true);
insert into fsr_mls_private.credentials(coordinator_id, token_hash) values
  (current_setting('fsr.qa_id')::uuid, encode(sha256(convert_to(current_setting('fsr.qa_token'), 'UTF8')), 'hex')),
  (current_setting('fsr.qa_other_id')::uuid, encode(sha256(convert_to(current_setting('fsr.qa_other_token'), 'UTF8')), 'hex'));

set local role anon;
select set_config('request.headers', '{}', true);
do $$
begin
  begin
    perform public.fsr_mls_acquire(repeat('a',64),repeat('1',64),gen_random_uuid());
    raise exception 'Missing coordinator credential was accepted.';
  exception when sqlstate '28000' then null; end;
  perform set_config('request.headers','not-json',true);
  begin
    perform public.fsr_mls_acquire(repeat('a',64),repeat('1',64),gen_random_uuid());
    raise exception 'Malformed coordinator header was accepted.';
  exception when sqlstate '28000' then null; end;
  perform set_config('request.headers',jsonb_build_object('x-fsr-mls-coordinator',repeat('x',64))::text,true);
  begin
    perform public.fsr_mls_acquire(repeat('a',64),repeat('1',64),gen_random_uuid());
    raise exception 'Wrong coordinator credential was accepted.';
  exception when sqlstate '28000' then null; end;
  if (select count(*) from fsr_mls_private.credentials) <> 0 then raise exception 'Credential IDs leaked without matching header.'; end if;
  if (select count(*) from fsr_mls_private.queries) <> 0 then raise exception 'Cached data leaked without matching header.'; end if;
  begin
    insert into fsr_mls_private.scopes(coordinator_id, scope_hash) values(current_setting('fsr.qa_id')::uuid,repeat('a',64));
    raise exception 'Wrong coordinator credential bypassed table RLS.';
  exception when insufficient_privilege then null; end;
end;
$$;
select set_config('request.headers',jsonb_build_object('x-fsr-mls-coordinator',current_setting('fsr.qa_token'))::text,true);
do $$
declare cid uuid := current_setting('fsr.qa_id')::uuid;
begin
  if fsr_mls_private.coordinator_id() is distinct from cid then raise exception 'Matching credential was not resolved.'; end if;
  if (select count(*) from fsr_mls_private.credentials) <> 1 then raise exception 'Credential RLS exposed another coordinator.'; end if;
  begin
    execute 'select token_hash from fsr_mls_private.credentials';
    raise exception 'Hash column was readable to anon.';
  exception when insufficient_privilege then null; end;
  begin
    insert into fsr_mls_private.credentials(token_hash) values(repeat('1',64));
    raise exception 'Anon could provision another credential.';
  exception when insufficient_privilege then null; end;
  begin
    update fsr_mls_private.credentials set enabled = false;
    raise exception 'Anon could change credential authorization.';
  exception when insufficient_privilege then null; end;
  begin
    insert into fsr_mls_private.scopes(coordinator_id,scope_hash) values(current_setting('fsr.qa_other_id')::uuid,repeat('a',64));
    raise exception 'Cross-coordinator state write was accepted.';
  exception when insufficient_privilege then null; end;
end;
$$;

-- Different workers share four slots; duplicate admission consumes no fifth hit.
do $$
declare
  cid uuid := current_setting('fsr.qa_id')::uuid;
  scope text := repeat('1',64);
  owners uuid[] := array[gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid()];
  result jsonb;
  i integer;
begin
  for i in 1..4 loop
    result := public.fsr_mls_acquire(scope,lpad(to_hex(i),64,'0'),owners[i]);
    if result->>'decision' <> 'granted' then raise exception 'Expected initial grant %: %',i,result; end if;
  end loop;
  result := public.fsr_mls_acquire(scope,repeat('f',64),gen_random_uuid());
  if result->>'reason' <> 'capacity' or (result->>'retry_after_ms')::bigint < 328000 then raise exception 'Shared concurrency/orphan lease incorrect: %',result; end if;
  result := public.fsr_mls_acquire(scope,lpad('1',64,'0'),gen_random_uuid());
  if result->>'decision' <> 'waiting' or result->>'reason' <> 'duplicate' then raise exception 'Concurrent duplicate was admitted: %',result; end if;
  if (select count(*) from fsr_mls_private.starts where coordinator_id=cid and scope_hash=scope) <> 4 then raise exception 'Local rejections consumed provider hits.'; end if;
  if not public.fsr_mls_finish(scope,lpad('1',64,'0'),owners[1],'cancelled') then raise exception 'Cancellation completion rejected.'; end if;
  result := public.fsr_mls_acquire(scope,lpad('1',64,'0'),gen_random_uuid());
  if result->>'decision' <> 'waiting' or (result->>'retry_after_ms')::bigint < 29000 then raise exception 'Interrupted duplicate hold missing: %',result; end if;
  result := public.fsr_mls_acquire(scope,repeat('f',64),gen_random_uuid());
  if result->>'reason' <> 'capacity' then raise exception 'Interrupted work released a possibly active slot.'; end if;
  if (select consecutive_failures from fsr_mls_private.scopes where coordinator_id=cid and scope_hash=scope) <> 0 then raise exception 'Caller cancellation became a provider outage.'; end if;
  if not public.fsr_mls_finish(scope,lpad('2',64,'0'),owners[2],'not_sent') then raise exception 'Pre-dispatch release rejected.'; end if;
  if (select count(*) from fsr_mls_private.starts where coordinator_id=cid and scope_hash=scope) <> 3 then raise exception 'Definite unsent reservation was not refunded.'; end if;
  result := public.fsr_mls_acquire(scope,repeat('f',64),gen_random_uuid());
  if result->>'decision' <> 'granted' then raise exception 'Released capacity was not available: %',result; end if;
end;
$$;

-- Successful results can be reused by a second worker without another API hit.
do $$
declare
  cid uuid := current_setting('fsr.qa_id')::uuid;
  scope text := repeat('2',64);
  owner_id uuid := gen_random_uuid();
  fixture_response jsonb := jsonb_build_object('status',200,'body','eyJ2YWx1ZSI6W119','headers',jsonb_build_array(jsonb_build_array('content-type','application/json')));
  result jsonb;
  i integer;
begin
  result := public.fsr_mls_acquire(scope,repeat('a',64),owner_id);
  if result->>'decision' <> 'granted' then raise exception 'Cache fixture was not granted.'; end if;
  if not public.fsr_mls_finish(scope,repeat('a',64),owner_id,'success',0,fixture_response) then raise exception 'Success completion rejected.'; end if;
  result := public.fsr_mls_acquire(scope,repeat('a',64),gen_random_uuid());
  if result->>'decision' <> 'cached' or result->'snapshot' <> fixture_response then raise exception 'Shared response was not reused: %',result; end if;
  if (select count(*) from fsr_mls_private.starts where coordinator_id=cid and scope_hash=scope) <> 1 then raise exception 'Cache reuse consumed a provider hit.'; end if;
  if public.fsr_mls_finish(scope,repeat('a',64),owner_id,'throttled') then raise exception 'Duplicate finish was not fenced.'; end if;
  result := public.fsr_mls_acquire(scope,repeat('b',64),owner_id);
  if result->>'decision' = 'granted' then raise exception 'Replayed owner authorized a second request.'; end if;

  for i in 1..40 loop
    owner_id := gen_random_uuid();
    result := public.fsr_mls_acquire(scope,lpad(to_hex(i),64,'0'),owner_id);
    if result->>'decision' <> 'granted' then raise exception 'Cache capacity fixture was not granted: %',result; end if;
    perform public.fsr_mls_finish(scope,lpad(to_hex(i),64,'0'),owner_id,'success',0,fixture_response);
  end loop;
  if (select count(*) from fsr_mls_private.queries where coordinator_id=cid and scope_hash=scope and response is not null) <> 32 then raise exception 'Cache snapshot count was not bounded.'; end if;
  if (select sum(response_bytes) from fsr_mls_private.queries where coordinator_id=cid and scope_hash=scope) > 33554432 then raise exception 'Cache byte budget exceeded.'; end if;
  perform set_config('request.headers',jsonb_build_object('x-fsr-mls-coordinator',current_setting('fsr.qa_other_token'))::text,true);
  result := public.fsr_mls_acquire(scope,repeat('a',64),gen_random_uuid());
  if result->>'decision' <> 'granted' then raise exception 'Separate coordinator received another credential cache: %',result; end if;
  if (select count(*) from fsr_mls_private.queries where coordinator_id=cid) <> 0 then raise exception 'Cross-coordinator cache was visible.'; end if;
  perform set_config('request.headers',jsonb_build_object('x-fsr-mls-coordinator',current_setting('fsr.qa_token'))::text,true);
end;
$$;

-- Invalid snapshots cannot persist headers, errors or oversized response bodies.
do $$
declare scope text := repeat('3',64); owner_id uuid := gen_random_uuid(); bad jsonb;
begin
  perform public.fsr_mls_acquire(scope,repeat('a',64),owner_id);
  foreach bad in array array[
    '{"status":500,"body":"","headers":[]}'::jsonb,
    '{"status":200,"body":"","headers":[["set-cookie","secret=value"]]}'::jsonb,
    '{"status":200,"body":"","headers":[["authorization","Bearer secret"]]}'::jsonb,
    '{"status":200,"body":"invalid-base64!","headers":[]}'::jsonb,
    jsonb_build_object('status',200,'body',repeat('a',2097152),'headers','[]'::jsonb)
  ] loop
    begin
      perform public.fsr_mls_finish(scope,repeat('a',64),owner_id,'success',0,bad);
      raise exception 'Invalid response snapshot was accepted.';
    exception when invalid_parameter_value then null; end;
  end loop;
  if not public.fsr_mls_finish(scope,repeat('a',64),owner_id,'success') then raise exception 'Invalid snapshot changed lease ownership.'; end if;
end;
$$;

-- Real429 starts a full cooldown; an older success or repeated finish cannot erase/extend it.
do $$
declare
  cid uuid := current_setting('fsr.qa_id')::uuid;
  scope text := repeat('4',64);
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); probe uuid := gen_random_uuid();
  result jsonb; pause_time timestamptz;
begin
  perform public.fsr_mls_acquire(scope,repeat('a',64),a);
  perform public.fsr_mls_acquire(scope,repeat('b',64),b);
  perform public.fsr_mls_finish(scope,repeat('a',64),a,'throttled',60000);
  select pause_until into pause_time from fsr_mls_private.scopes where coordinator_id=cid and scope_hash=scope;
  perform public.fsr_mls_finish(scope,repeat('b',64),b,'success');
  result := public.fsr_mls_acquire(scope,repeat('c',64),probe);
  if result->>'reason' <> 'throttled' or (result->>'retry_after_ms')::bigint < 298000 then raise exception '429 floor/late success guard failed: %',result; end if;
  if public.fsr_mls_finish(scope,repeat('a',64),a,'throttled') then raise exception 'Completed failure was accepted twice.'; end if;
  if (select pause_until from fsr_mls_private.scopes where coordinator_id=cid and scope_hash=scope) <> pause_time then raise exception 'Local/replayed completion extended cooldown.'; end if;

  update fsr_mls_private.scopes set pause_until=clock_timestamp()-interval '1 second' where coordinator_id=cid and scope_hash=scope;
  update fsr_mls_private.queries set blocked_until='epoch',active_until='epoch' where coordinator_id=cid and scope_hash=scope;
  result := public.fsr_mls_acquire(scope,repeat('c',64),probe);
  if result->>'decision' <> 'granted' then raise exception 'Recovery probe not granted: %',result; end if;
  result := public.fsr_mls_acquire(scope,repeat('d',64),gen_random_uuid());
  if result->>'reason' <> 'capacity' then raise exception 'Concurrent recovery probes were admitted: %',result; end if;
  perform public.fsr_mls_finish(scope,repeat('c',64),probe,'throttled',900000);
  result := public.fsr_mls_acquire(scope,repeat('d',64),gen_random_uuid());
  if result->>'reason' <> 'throttled' or (result->>'retry_after_ms')::bigint < 898000 then raise exception 'Long Retry-After was truncated: %',result; end if;
end;
$$;

-- Parallel failures are one failure wave; interrupted work keeps an uncertainty hold.
do $$
declare
  cid uuid := current_setting('fsr.qa_id')::uuid;
  scope text := repeat('5',64);
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); result jsonb;
begin
  perform public.fsr_mls_acquire(scope,repeat('a',64),a);
  perform public.fsr_mls_acquire(scope,repeat('b',64),b);
  perform public.fsr_mls_finish(scope,repeat('a',64),a,'http_error');
  perform public.fsr_mls_finish(scope,repeat('b',64),b,'interrupted');
  if (select consecutive_failures from fsr_mls_private.scopes where coordinator_id=cid and scope_hash=scope) <> 1 then raise exception 'Parallel failures multiplied backoff.'; end if;
  result := public.fsr_mls_acquire(scope,repeat('c',64),gen_random_uuid());
  if result->>'reason' <> 'unavailable' or (result->>'retry_after_ms')::bigint < 29000 then raise exception 'Failure pause missing: %',result; end if;
  if (select active_until from fsr_mls_private.queries where coordinator_id=cid and scope_hash=scope and query_hash=repeat('b',64)) < clock_timestamp()+interval '29 seconds' then raise exception 'Interrupted work released uncertain active slot.'; end if;
  update fsr_mls_private.scopes set pause_until='epoch' where coordinator_id=cid and scope_hash=scope;
  result := public.fsr_mls_acquire(scope,repeat('c',64),gen_random_uuid());
  if result->>'reason' <> 'capacity' then raise exception 'Probe overlapped uncertain upstream work: %',result; end if;
end;
$$;

-- Replaced owners cannot complete or cache results for a newer reservation.
do $$
declare
  cid uuid := current_setting('fsr.qa_id')::uuid;
  scope text := repeat('6',64);
  old_owner uuid := gen_random_uuid(); new_owner uuid := gen_random_uuid(); result jsonb;
begin
  perform public.fsr_mls_acquire(scope,repeat('a',64),old_owner);
  update fsr_mls_private.queries set active_until='epoch' where coordinator_id=cid and scope_hash=scope;
  result := public.fsr_mls_acquire(scope,repeat('a',64),new_owner);
  if result->>'decision' <> 'granted' then raise exception 'Expired lease could not be replaced: %',result; end if;
  if public.fsr_mls_finish(scope,repeat('a',64),old_owner,'throttled') then raise exception 'Stale owner changed new reservation.'; end if;
  if not public.fsr_mls_finish(scope,repeat('a',64),new_owner,'success') then raise exception 'Current owner could not finish.'; end if;
  if (select consecutive_failures from fsr_mls_private.scopes where coordinator_id=cid and scope_hash=scope) <> 0 then raise exception 'Fenced completion mutated provider state.'; end if;
end;
$$;

-- The request budget is a rolling window and cached/local calls do not replenish it.
do $$
declare
  cid uuid := current_setting('fsr.qa_id')::uuid;
  scope text := repeat('7',64); initial_owner uuid := gen_random_uuid(); result jsonb;
begin
  perform public.fsr_mls_acquire(scope,repeat('a',64),initial_owner);
  perform public.fsr_mls_finish(scope,repeat('a',64),initial_owner,'not_sent');
  insert into fsr_mls_private.starts(coordinator_id,scope_hash,owner,started_at)
    select cid,scope,gen_random_uuid(),clock_timestamp()-interval '1 second' from generate_series(1,1200);
  result := public.fsr_mls_acquire(scope,repeat('b',64),gen_random_uuid());
  if result->>'reason' <> 'budget' then raise exception 'Shared request budget failed: %',result; end if;
  if (select count(*) from fsr_mls_private.starts where coordinator_id=cid and scope_hash=scope) <> 1200 then raise exception 'Budget rejection counted as upstream call.'; end if;
  update fsr_mls_private.starts set started_at=clock_timestamp()-interval '301 seconds' where coordinator_id=cid and scope_hash=scope;
  result := public.fsr_mls_acquire(scope,repeat('b',64),gen_random_uuid());
  if result->>'decision' <> 'granted' then raise exception 'Rolling budget did not replenish: %',result; end if;
  if (select count(*) from fsr_mls_private.starts where coordinator_id=cid and scope_hash=scope) <> 1 then raise exception 'Expired request reservations were not pruned.'; end if;
end;
$$;

reset role;
do $$
begin
  if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','fsr_mls_private') and p.proname in ('fsr_mls_acquire','fsr_mls_finish','coordinator_id','request_token_hash','valid_snapshot') and p.prosecdef) then raise exception 'Coordinator function bypasses RLS.'; end if;
  if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='fsr_mls_private' and c.relkind='r' and not c.relrowsecurity) then raise exception 'Coordinator table missing RLS.'; end if;
  if has_function_privilege('authenticated','public.fsr_mls_acquire(text,text,uuid)','EXECUTE') or has_function_privilege('service_role','public.fsr_mls_acquire(text,text,uuid)','EXECUTE') then raise exception 'Unexpected coordinator RPC privilege.'; end if;
end;
$$;
select 'MLS coordinator verification passed: auth, RLS, four slots, duplicate holds, fencing, cache limits, cooldowns, probe and rolling quota.' as result;
rollback;
