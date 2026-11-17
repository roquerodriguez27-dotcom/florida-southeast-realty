-- Initial inquiry replies only. Generation may run in the background; sending
-- requires an active broker's explicit, version-checked approval. No backfill
-- and no scheduler registration are performed by this migration.

create table public.crm_followups (
  id uuid primary key default gen_random_uuid(),
  lead_id bigint not null references public.crm_leads(id),
  purpose text not null default 'initial_response' check (purpose = 'initial_response'),
  recipient_email text not null check (recipient_email = lower(btrim(recipient_email))),
  state text not null default 'queued' check (state in (
    'queued','drafting','review','draft_failed','sending','accepted',
    'send_failed','delivery_unknown','paused','stopped'
  )),
  test_mode boolean not null default false,
  source_snapshot jsonb not null check (jsonb_typeof(source_snapshot) = 'object'),
  draft_subject text check (char_length(draft_subject) <= 160),
  draft_body text check (char_length(draft_body) <= 6000),
  draft_mode text check (draft_mode in ('ai','template','manual')),
  model text check (char_length(model) <= 160),
  draft_version integer not null default 0 check (draft_version >= 0),
  generation_token uuid,
  generation_attempts integer not null default 0 check (generation_attempts between 0 and 3),
  lease_expires_at timestamptz,
  next_attempt_at timestamptz not null default now(),
  approved_by text,
  approved_at timestamptz,
  approved_version integer,
  approved_payload jsonb,
  send_attempt_number integer not null default 0 check (send_attempt_number >= 0),
  send_attempt_token uuid,
  idempotency_key text unique,
  send_attempt_at timestamptz,
  provider_message_id text check (char_length(provider_message_id) <= 200),
  accepted_at timestamptz,
  stop_reason text,
  last_error text check (char_length(last_error) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lead_id, purpose)
);
create index crm_followups_pending_idx on public.crm_followups(next_attempt_at, created_at)
  where state = 'queued';
create index crm_followups_recipient_idx on public.crm_followups(recipient_email, created_at);

create table crm_private.followup_events (
  id bigint generated always as identity primary key,
  followup_id uuid not null references public.crm_followups(id),
  event text not null check (char_length(event) between 1 and 80),
  actor text not null,
  previous_state text,
  next_state text,
  draft_version integer,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index followup_events_job_idx on crm_private.followup_events(followup_id, created_at);
create table crm_private.followup_email_suppressions (
  email text primary key check (email = lower(btrim(email))),
  reason text not null,
  actor text not null,
  created_at timestamptz not null default now()
);
create table crm_private.followup_optout_tokens (
  token_hash text primary key,
  followup_id uuid not null references public.crm_followups(id),
  created_at timestamptz not null default now()
);
create table crm_private.followup_daily_budget (
  day date primary key,
  claims integer not null check (claims between 0 and 25)
);

alter table public.crm_followups enable row level security;
alter table crm_private.followup_events enable row level security;
alter table crm_private.followup_email_suppressions enable row level security;
alter table crm_private.followup_optout_tokens enable row level security;
alter table crm_private.followup_daily_budget enable row level security;
revoke all on public.crm_followups from public, anon, authenticated;
revoke all on crm_private.followup_events, crm_private.followup_email_suppressions,
  crm_private.followup_optout_tokens, crm_private.followup_daily_budget from public, anon, authenticated;
revoke all on sequence crm_private.followup_events_id_seq from public, anon, authenticated;
grant select on public.crm_followups to authenticated;
create policy "brokers read initial followups" on public.crm_followups
  for select to authenticated using ((select crm_private.is_crm_broker()));

create function crm_private.followup_audit_immutable()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Follow-up audit events are immutable.' using errcode = '42501';
end; $$;
create trigger followup_events_immutable before update or delete on crm_private.followup_events
  for each row execute function crm_private.followup_audit_immutable();

create function crm_private.followup_broker()
returns text language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not crm_private.is_crm_broker() then
    raise exception 'An active CRM broker is required.' using errcode = '42501';
  end if;
  return lower(btrim(coalesce(auth.jwt()->>'email', '')));
end; $$;

-- The raw worker credential never leaves Vault through these functions.
do $token$
begin
  if not exists(select 1 from vault.secrets where name = 'fsr_followup_worker_token') then
    perform vault.create_secret(gen_random_uuid()::text || gen_random_uuid()::text,
      'fsr_followup_worker_token', 'FSR initial-response draft worker only');
  end if;
end;
$token$;
create function crm_private.followup_worker_token_valid(p_token text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select decrypted_secret = p_token from vault.decrypted_secrets
    where name = 'fsr_followup_worker_token' order by created_at desc limit 1), false);
$$;

create function crm_private.followup_snapshot(p_lead public.crm_leads)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'full_name', p_lead.full_name, 'form_name', p_lead.form_name,
    'property_interest', p_lead.property_interest, 'message', p_lead.message,
    'fields', p_lead.fields - 'email' - 'phone' - 'telephone',
    'created_at', p_lead.created_at
  );
$$;

-- NULL means eligible. Caller decides whether to enqueue or stop an existing row.
create function crm_private.followup_ineligible_reason(p_lead public.crm_leads, p_test_mode boolean default false)
returns text language plpgsql stable security definer set search_path = '' as $$
declare recipient text := lower(btrim(coalesce(p_lead.email, '')));
begin
  if p_lead.id is null then return 'lead_missing'; end if;
  if p_lead.consent is not true or p_lead.fields->>'contact_consent' is distinct from 'yes' then return 'consent_missing'; end if;
  if recipient = '' or char_length(recipient) > 254
    or recipient !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then return 'invalid_email'; end if;
  if p_lead.last_contacted_at is not null then return 'reply_recorded'; end if;
  if p_lead.status in ('closed','lost') then return 'lead_resolved'; end if;
  if exists(select 1 from crm_private.followup_email_suppressions s where s.email = recipient) then return 'recipient_suppressed'; end if;
  if lower(coalesce(p_lead.fields->>'preferred_contact', '')) in ('phone','call','text','sms') then return 'different_contact_preference'; end if;
  if p_test_mode then
    if p_lead.source <> 'qa-followup' or p_lead.fields->>'followup_test' is distinct from 'yes'
      or not exists(select 1 from public.crm_users u where u.email = recipient and u.active and u.role = 'broker') then
      return 'invalid_owner_test';
    end if;
  else
    if p_lead.source <> 'website' or p_lead.form_name not in (
      'contact','property-inquiry','buyer-inquiry','home-valuation','sellers-page',
      'planning-seller-proceeds','planning-seller-timing','planning-seller-preparation',
      'planning-seller-offers','planning-seller-report'
    ) then return 'unsupported_source'; end if;
    if p_lead.fields ? 'qaRun' or p_lead.fields ? 'qaCase'
      or lower(coalesce(p_lead.fields->>'testOnly', '')) in ('true','yes','1')
      or lower(coalesce(p_lead.fields->>'test_only', '')) in ('true','yes','1')
      or p_lead.fields->>'followup_test' = 'yes'
      or coalesce(p_lead.message, '') ~* '(^|[^[:alnum:]])(TEST[[:space:]]+ONLY|FSR[-[:space:]]+QA)([^[:alnum:]]|$)'
      or coalesce(p_lead.full_name, '') ~* '(^|[^[:alnum:]])(TEST[[:space:]]+ONLY|FSR[-[:space:]]+QA)([^[:alnum:]]|$)'
      or recipient ~ '[.](invalid|test|example)$'
      or split_part(recipient, '@', 2) in ('example.com','example.org','example.net') then return 'test_only'; end if;
    if exists(select 1 from public.crm_users u where u.email = recipient) then return 'internal_recipient'; end if;
  end if;
  return null;
end; $$;

create function crm_private.followup_event(p_id uuid, p_event text, p_actor text,
  p_previous text, p_next text, p_version integer, p_details jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into crm_private.followup_events(followup_id,event,actor,previous_state,next_state,draft_version,details)
  values(p_id,p_event,p_actor,p_previous,p_next,p_version,coalesce(p_details,'{}'::jsonb));
$$;

create function crm_private.enqueue_initial_followup()
returns trigger language plpgsql security definer set search_path = '' as $$
declare job_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('fsr-followup-recipient:'||lower(btrim(coalesce(new.email,''))),0));
  if crm_private.followup_ineligible_reason(new, false) is not null then return new; end if;
  insert into public.crm_followups(lead_id,recipient_email,source_snapshot)
  values(new.id,lower(btrim(new.email)),crm_private.followup_snapshot(new))
  on conflict(lead_id,purpose) do nothing returning id into job_id;
  if job_id is not null then perform crm_private.followup_event(job_id,'queued','website',null,'queued',0); end if;
  return new;
end; $$;
create trigger enqueue_initial_followup after insert on public.crm_leads
  for each row execute function crm_private.enqueue_initial_followup();

create function crm_private.stop_changed_followups()
returns trigger language plpgsql security definer set search_path = '' as $$
declare job public.crm_followups%rowtype; reason text;
begin
  for job in select * from public.crm_followups where lead_id = new.id
    and state not in ('accepted','stopped') for update
  loop
    reason := crm_private.followup_ineligible_reason(new, job.test_mode);
    if reason is null and lower(btrim(coalesce(new.email,''))) <> job.recipient_email then reason := 'recipient_changed'; end if;
    if reason is null and crm_private.followup_snapshot(new) is distinct from job.source_snapshot then reason := 'inquiry_changed'; end if;
    if reason='reply_recorded' and job.state='paused' and job.stop_reason='reply_received' then continue; end if;
    if reason is not null then
      update public.crm_followups set state='stopped',stop_reason=reason,generation_token=null,
        lease_expires_at=null,updated_at=now() where id=job.id;
      perform crm_private.followup_event(job.id,'eligibility_stopped','crm',job.state,'stopped',job.draft_version,jsonb_build_object('reason',reason));
    end if;
  end loop;
  return new;
end; $$;
create trigger stop_changed_followups after update on public.crm_leads
  for each row execute function crm_private.stop_changed_followups();

create function public.claim_followup_draft(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare job public.crm_followups%rowtype; lead public.crm_leads%rowtype;
  reason text; next_state text; claim_token uuid; budget integer;
begin
  if not crm_private.followup_worker_token_valid(p_token) then raise exception 'Invalid follow-up worker token.' using errcode='28000'; end if;
  -- A lost send acknowledgment never returns to the sending queue.
  for job in select * from public.crm_followups where state='sending'
    and send_attempt_at < now()-interval '10 minutes' for update skip locked
  loop
    update public.crm_followups set state='delivery_unknown',last_error='Send result was not recorded.',updated_at=now() where id=job.id;
    perform crm_private.followup_event(job.id,'send_result_missing','worker','sending','delivery_unknown',job.draft_version);
  end loop;
  for job in select * from public.crm_followups where state='drafting' and lease_expires_at <= now() for update skip locked
  loop
    next_state := case when job.generation_attempts < 3 then 'queued' else 'draft_failed' end;
    update public.crm_followups set state=next_state,generation_token=null,lease_expires_at=null,
      last_error='Draft generation lease expired.',updated_at=now() where id=job.id;
    perform crm_private.followup_event(job.id,'draft_lease_expired','worker','drafting',next_state,job.draft_version);
  end loop;
  select * into job from public.crm_followups where state='queued' and generation_attempts<3
    and next_attempt_at<=now() order by created_at,id for update skip locked limit 1;
  if not found then return jsonb_build_object('claimed',false,'reason','empty'); end if;
  select * into lead from public.crm_leads where id=job.lead_id;
  reason := crm_private.followup_ineligible_reason(lead,job.test_mode);
  if reason is null and lower(btrim(coalesce(lead.email,''))) <> job.recipient_email then reason := 'recipient_changed'; end if;
  if reason is not null then
    update public.crm_followups set state='stopped',stop_reason=reason,updated_at=now() where id=job.id;
    perform crm_private.followup_event(job.id,'eligibility_stopped','worker',job.state,'stopped',job.draft_version,jsonb_build_object('reason',reason));
    return jsonb_build_object('claimed',false,'reason','ineligible');
  end if;
  insert into crm_private.followup_daily_budget(day,claims) values((now() at time zone 'UTC')::date,1)
  on conflict(day) do update set claims=crm_private.followup_daily_budget.claims+1
    where crm_private.followup_daily_budget.claims<25 returning claims into budget;
  if not found then return jsonb_build_object('claimed',false,'reason','daily_limit'); end if;
  claim_token := gen_random_uuid();
  update public.crm_followups set state='drafting',generation_token=claim_token,
    generation_attempts=generation_attempts+1,lease_expires_at=now()+interval '10 minutes',
    source_snapshot=crm_private.followup_snapshot(lead),last_error=null,updated_at=now()
    where id=job.id returning * into job;
  perform crm_private.followup_event(job.id,'draft_claimed','worker','queued','drafting',job.draft_version,
    jsonb_build_object('attempt',job.generation_attempts));
  return jsonb_build_object('claimed',true,'id',job.id,'generation_token',claim_token,
    'source_snapshot',job.source_snapshot,'test_mode',job.test_mode,'attempt',job.generation_attempts);
end; $$;

create function public.complete_followup_draft(p_token text,p_id uuid,p_generation_token uuid,
  p_subject text,p_body text,p_mode text,p_model text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare job public.crm_followups%rowtype; lead public.crm_leads%rowtype; reason text;
  subject text:=btrim(coalesce(p_subject,'')); body text:=btrim(coalesce(p_body,''));
begin
  if not crm_private.followup_worker_token_valid(p_token) then raise exception 'Invalid follow-up worker token.' using errcode='28000'; end if;
  select * into job from public.crm_followups where id=p_id for update;
  if not found or job.state<>'drafting' or job.generation_token is distinct from p_generation_token
    or job.lease_expires_at<=now() then return jsonb_build_object('ok',false,'reason','stale_claim'); end if;
  if char_length(subject) not between 1 and 160 or subject ~ E'[\r\n]'
    or char_length(body) not between 1 and 6000 or p_mode not in ('ai','template')
    or p_mode is null or char_length(coalesce(p_model,''))>160 then raise exception 'Invalid follow-up draft.' using errcode='22023'; end if;
  if job.test_mode and subject not like 'TEST ONLY:%' then subject:=left('TEST ONLY: '||subject,160); end if;
  select * into lead from public.crm_leads where id=job.lead_id;
  reason:=crm_private.followup_ineligible_reason(lead,job.test_mode);
  if reason is null and (lower(btrim(coalesce(lead.email,'')))<>job.recipient_email
    or crm_private.followup_snapshot(lead) is distinct from job.source_snapshot) then reason:='inquiry_changed'; end if;
  if reason is not null then
    update public.crm_followups set state='stopped',stop_reason=reason,generation_token=null,lease_expires_at=null,updated_at=now() where id=job.id;
    perform crm_private.followup_event(job.id,'eligibility_stopped','worker',job.state,'stopped',job.draft_version,jsonb_build_object('reason',reason));
    return jsonb_build_object('ok',false,'reason',reason);
  end if;
  update public.crm_followups set state='review',draft_subject=subject,draft_body=body,draft_mode=p_mode,
    model=nullif(p_model,''),draft_version=draft_version+1,generation_token=null,lease_expires_at=null,updated_at=now()
    where id=job.id returning * into job;
  perform crm_private.followup_event(job.id,'draft_ready','worker','drafting','review',job.draft_version,
    jsonb_build_object('mode',p_mode,'model',p_model));
  return jsonb_build_object('ok',true,'version',job.draft_version);
end; $$;

create function public.fail_followup_draft(p_token text,p_id uuid,p_generation_token uuid,p_error text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare job public.crm_followups%rowtype; next_state text;
begin
  if not crm_private.followup_worker_token_valid(p_token) then raise exception 'Invalid follow-up worker token.' using errcode='28000'; end if;
  select * into job from public.crm_followups where id=p_id for update;
  if not found or job.state<>'drafting' or job.generation_token is distinct from p_generation_token
    or job.lease_expires_at<=now() then return jsonb_build_object('ok',false,'reason','stale_claim'); end if;
  next_state:=case when job.generation_attempts<3 then 'queued' else 'draft_failed' end;
  update public.crm_followups set state=next_state,generation_token=null,lease_expires_at=null,
    next_attempt_at=now()+interval '2 minutes',last_error=left(coalesce(p_error,'Draft generation failed.'),500),updated_at=now() where id=job.id;
  perform crm_private.followup_event(job.id,'draft_failed','worker','drafting',next_state,job.draft_version);
  return jsonb_build_object('ok',true,'state',next_state);
end; $$;

create function public.edit_followup(p_id uuid,p_expected_version integer,p_subject text,p_body text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor text:=crm_private.followup_broker(); job public.crm_followups%rowtype;
  subject text:=btrim(coalesce(p_subject,'')); body text:=btrim(coalesce(p_body,''));
begin
  select * into job from public.crm_followups where id=p_id for update;
  if not found then return jsonb_build_object('ok',false,'reason','not_found'); end if;
  if job.state not in ('review','send_failed') then return jsonb_build_object('ok',false,'reason','state'); end if;
  if job.draft_version is distinct from p_expected_version then return jsonb_build_object('ok',false,'reason','stale_version'); end if;
  if char_length(subject) not between 1 and 160 or subject ~ E'[\r\n]' or char_length(body) not between 1 and 6000 then
    raise exception 'Invalid follow-up draft.' using errcode='22023';
  end if;
  if job.test_mode and subject not like 'TEST ONLY:%' then subject:=left('TEST ONLY: '||subject,160); end if;
  update public.crm_followups set state='review',draft_subject=subject,draft_body=body,draft_mode='manual',
    draft_version=draft_version+1,approved_by=null,approved_at=null,approved_version=null,approved_payload=null,
    send_attempt_token=null,idempotency_key=null,send_attempt_at=null,last_error=null,updated_at=now() where id=job.id;
  perform crm_private.followup_event(job.id,'draft_edited',actor,job.state,'review',job.draft_version+1,
    jsonb_build_object('subject_sha256',encode(sha256(convert_to(subject,'UTF8')),'hex'),
      'body_sha256',encode(sha256(convert_to(body,'UTF8')),'hex')));
  return jsonb_build_object('ok',true,'version',job.draft_version+1);
end; $$;

create function public.prepare_followup_send(p_id uuid,p_expected_version integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor text:=crm_private.followup_broker(); job public.crm_followups%rowtype;
  lead public.crm_leads%rowtype; lead_key bigint; reason text; attempt uuid:=gen_random_uuid();
  optout uuid:=gen_random_uuid(); send_key text;
begin
  -- Lead first, then queue: this matches lead-update trigger locking order.
  select lead_id into lead_key from public.crm_followups where id=p_id;
  if not found then return jsonb_build_object('ok',false,'reason','not_found'); end if;
  select * into lead from public.crm_leads where id=lead_key for share;
  select * into job from public.crm_followups where id=p_id for update;
  if job.state<>'review' then return jsonb_build_object('ok',false,'reason','state'); end if;
  if job.draft_version is distinct from p_expected_version then return jsonb_build_object('ok',false,'reason','stale_version'); end if;
  reason:=crm_private.followup_ineligible_reason(lead,job.test_mode);
  if reason is null and lower(btrim(coalesce(lead.email,'')))<>job.recipient_email then reason:='recipient_changed'; end if;
  if reason is null and crm_private.followup_snapshot(lead) is distinct from job.source_snapshot then reason:='inquiry_changed'; end if;
  if reason is not null then
    update public.crm_followups set state='stopped',stop_reason=reason,updated_at=now() where id=job.id;
    perform crm_private.followup_event(job.id,'eligibility_stopped',actor,'review','stopped',job.draft_version,jsonb_build_object('reason',reason));
    return jsonb_build_object('ok',false,'reason',reason);
  end if;
  if job.draft_subject is null or job.draft_body is null then return jsonb_build_object('ok',false,'reason','draft_missing'); end if;
  send_key:='fsr-initial/'||job.id::text||'/'||(job.send_attempt_number+1)::text;
  insert into crm_private.followup_optout_tokens(token_hash,followup_id)
    values(encode(sha256(convert_to(optout::text,'UTF8')),'hex'),job.id);
  update public.crm_followups set state='sending',approved_by=actor,approved_at=now(),approved_version=draft_version,
    approved_payload=jsonb_build_object('recipient',recipient_email,'subject',draft_subject,'body',draft_body,'test_mode',test_mode),
    send_attempt_number=send_attempt_number+1,send_attempt_token=attempt,idempotency_key=send_key,send_attempt_at=now(),updated_at=now()
    where id=job.id;
  perform crm_private.followup_event(job.id,'approved_and_send_reserved',actor,'review','sending',job.draft_version,
    jsonb_build_object('attempt',job.send_attempt_number+1,'payload_sha256',
      encode(sha256(convert_to(jsonb_build_object('recipient',job.recipient_email,'subject',job.draft_subject,'body',job.draft_body)::text,'UTF8')),'hex')));
  -- The caller uses its fixed configured sender and deterministic footer. No
  -- second prepare or automatic retry reconstructs this one-time send payload.
  return jsonb_build_object('ok',true,'id',job.id,'send_attempt_token',attempt,'idempotency_key',send_key,
    'recipient',job.recipient_email,'subject',job.draft_subject,'body',job.draft_body,
    'unsubscribe_token',optout,'test_mode',job.test_mode);
end; $$;

create function public.record_followup_send_result(p_id uuid,p_send_attempt_token uuid,p_outcome text,
  p_provider_message_id text default null,p_error text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor text:=crm_private.followup_broker(); job public.crm_followups%rowtype; next_state text;
begin
  if p_outcome is null or p_outcome not in ('accepted','rejected','unknown') then raise exception 'Invalid send outcome.' using errcode='22023'; end if;
  if p_outcome='accepted' and (nullif(btrim(p_provider_message_id),'') is null or char_length(p_provider_message_id)>200) then
    raise exception 'Accepted sends require the provider message ID.' using errcode='22023';
  end if;
  select * into job from public.crm_followups where id=p_id for update;
  if not found or job.send_attempt_token is distinct from p_send_attempt_token or p_send_attempt_token is null then
    return jsonb_build_object('ok',false,'reason','stale_attempt');
  end if;
  if job.accepted_at is not null then return jsonb_build_object('ok',true,'state',job.state); end if;
  if job.state not in ('sending','delivery_unknown','paused','stopped') then return jsonb_build_object('ok',false,'reason','state'); end if;
  -- Ambiguity cannot be downgraded to a safely retryable rejection later.
  if job.state='delivery_unknown' and p_outcome='rejected' then return jsonb_build_object('ok',false,'reason','uncertain_attempt'); end if;
  next_state:=case when job.state in ('paused','stopped') then job.state
    when p_outcome='accepted' then 'accepted' when p_outcome='rejected' then 'send_failed' else 'delivery_unknown' end;
  update public.crm_followups set state=next_state,
    provider_message_id=case when p_outcome='accepted' then p_provider_message_id else provider_message_id end,
    accepted_at=case when p_outcome='accepted' then now() else accepted_at end,
    last_error=case when p_outcome='accepted' then null else left(coalesce(p_error,'Provider result unconfirmed.'),500) end,
    updated_at=now() where id=job.id;
  perform crm_private.followup_event(job.id,'send_'||p_outcome,actor,job.state,next_state,job.draft_version,
    case when p_outcome='accepted' then jsonb_build_object('provider_message_id',p_provider_message_id) else '{}'::jsonb end);
  return jsonb_build_object('ok',true,'state',next_state);
end; $$;

create function crm_private.suppress_followup_recipient(p_email text,p_reason text,p_actor text)
returns void language plpgsql security definer set search_path = '' as $$
declare job public.crm_followups%rowtype; recipient text:=lower(btrim(p_email));
begin
  perform pg_advisory_xact_lock(hashtextextended('fsr-followup-recipient:'||recipient,0));
  insert into crm_private.followup_email_suppressions(email,reason,actor) values(recipient,p_reason,p_actor)
    on conflict(email) do nothing;
  for job in select * from public.crm_followups where recipient_email=recipient
    and state not in ('accepted','stopped') for update
  loop
    update public.crm_followups set state='stopped',stop_reason=p_reason,generation_token=null,lease_expires_at=null,updated_at=now() where id=job.id;
    perform crm_private.followup_event(job.id,'recipient_suppressed',p_actor,job.state,'stopped',job.draft_version,jsonb_build_object('reason',p_reason));
  end loop;
end; $$;

create function public.pause_or_stop_followup(p_id uuid,p_reason text,p_stop boolean default true)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor text:=crm_private.followup_broker(); job public.crm_followups%rowtype; next_state text;
begin
  if p_reason is null or p_reason not in ('reply_received','do_not_contact','not_relevant')
    or p_stop is null or (p_reason='reply_received' and p_stop) or (p_reason<>'reply_received' and not p_stop) then
    raise exception 'Invalid follow-up stop reason.' using errcode='22023';
  end if;
  if p_reason='reply_received' then
    select * into job from public.crm_followups where id=p_id;
    if not found then return jsonb_build_object('ok',false,'reason','not_found'); end if;
    -- Outcome handling locks the lead before queue rows, including when the
    -- original response was already accepted. Do not pre-lock this queue row.
    perform public.record_followup_outcome(job.lead_id,'conversation','email','Email reply recorded from the initial-response review queue.');
    select * into job from public.crm_followups where id=p_id;
    return jsonb_build_object('ok',true,'state',job.state,'reply_recorded',true);
  end if;
  if p_reason='do_not_contact' then
    select * into job from public.crm_followups where id=p_id;
    if not found then return jsonb_build_object('ok',false,'reason','not_found'); end if;
    perform pg_advisory_xact_lock(hashtextextended('fsr-followup-recipient:'||job.recipient_email,0));
  end if;
  select * into job from public.crm_followups where id=p_id for update;
  if not found then return jsonb_build_object('ok',false,'reason','not_found'); end if;
  if p_reason='do_not_contact' then
    perform crm_private.suppress_followup_recipient(job.recipient_email,p_reason,actor);
    return jsonb_build_object('ok',true,'state',case when job.state='accepted' then 'accepted' else 'stopped' end,'suppressed',true);
  end if;
  if job.state in ('accepted','stopped') then return jsonb_build_object('ok',true,'state',job.state); end if;
  next_state:=case when p_stop then 'stopped' else 'paused' end;
  update public.crm_followups set state=next_state,stop_reason=p_reason,generation_token=null,lease_expires_at=null,updated_at=now() where id=job.id;
  perform crm_private.followup_event(job.id,'broker_stopped',actor,job.state,next_state,job.draft_version,jsonb_build_object('reason',p_reason));
  return jsonb_build_object('ok',true,'state',next_state);
end; $$;

create function public.unsubscribe_followup(p_token uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare recipient text;
begin
  select f.recipient_email into recipient from crm_private.followup_optout_tokens t
    join public.crm_followups f on f.id=t.followup_id
    where t.token_hash=encode(sha256(convert_to(p_token::text,'UTF8')),'hex');
  if found then perform crm_private.suppress_followup_recipient(recipient,'opt_out','recipient-optout'); end if;
  -- Same response for unknown/reused tokens; no contact lookup is exposed.
  return jsonb_build_object('ok',true);
end; $$;

create function public.record_followup_outcome(p_lead_id bigint,p_outcome text,p_channel text,p_note text default '')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor text; job public.crm_followups%rowtype; next_state text;
begin
  if auth.uid() is null or not crm_private.can_access_crm_lead_id(p_lead_id) then
    raise exception 'This lead is unavailable to your account.' using errcode='42501';
  end if;
  if p_outcome is null or p_outcome not in ('attempted','conversation','appointment_booked','appointment_held')
    or p_channel is null or p_channel not in ('call','email','text','meeting')
    or char_length(coalesce(p_note,''))>1500 then raise exception 'Invalid contact outcome.' using errcode='22023'; end if;
  actor:=lower(btrim(auth.jwt()->>'email'));
  perform 1 from public.crm_leads where id=p_lead_id for update;
  insert into public.crm_activities(lead_id,kind,body,created_by)
    values(p_lead_id,p_channel,'FSR outcome v1: '||jsonb_build_object('outcome',p_outcome,'channel',p_channel,'note',coalesce(p_note,''))::text,actor);
  if p_outcome in ('conversation','appointment_booked','appointment_held') then
    for job in select * from public.crm_followups where lead_id=p_lead_id for update
    loop
      next_state:=case when job.state in ('accepted','stopped') then job.state else 'paused' end;
      if next_state='paused' then
        update public.crm_followups set state='paused',stop_reason='reply_received',generation_token=null,lease_expires_at=null,updated_at=now() where id=job.id;
      end if;
      perform crm_private.followup_event(job.id,'contact_outcome_recorded',actor,job.state,next_state,job.draft_version,jsonb_build_object('outcome',p_outcome));
    end loop;
    -- This also stops any pending queue through the eligibility trigger.
    update public.crm_leads set last_contacted_at=now(),updated_at=now() where id=p_lead_id;
  end if;
  return jsonb_build_object('ok',true);
end; $$;

create function public.create_followup_test()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare broker_email text:=crm_private.followup_broker(); display_name text; lead public.crm_leads%rowtype; job public.crm_followups%rowtype;
begin
  -- Serialize only this broker's explicit test creation, preventing double clicks.
  perform pg_advisory_xact_lock(hashtextextended('fsr-owner-followup-test:'||broker_email,0));
  select * into job from public.crm_followups where test_mode and recipient_email=broker_email
    and state in ('queued','drafting','review','sending') order by created_at desc limit 1;
  if found then return jsonb_build_object('ok',true,'id',job.id,'lead_id',job.lead_id,'existing',true); end if;
  if exists(select 1 from crm_private.followup_email_suppressions where email=broker_email) then
    return jsonb_build_object('ok',false,'reason','recipient_suppressed');
  end if;
  select u.display_name into display_name from public.crm_users u where u.email=broker_email and u.active and u.role='broker';
  insert into public.crm_leads(full_name,email,source,form_name,property_interest,message,consent,fields)
  values('TEST ONLY — '||left(display_name,80),broker_email,'qa-followup','contact','OWNER QA — no property requested',
    'TEST ONLY — verify initial-response drafting and owner email delivery. No customer outreach.',true,
    jsonb_build_object('contact_consent','yes','followup_test','yes','preferred_contact','email')) returning * into lead;
  insert into public.crm_followups(lead_id,recipient_email,test_mode,source_snapshot)
    values(lead.id,broker_email,true,crm_private.followup_snapshot(lead)) returning * into job;
  perform crm_private.followup_event(job.id,'owner_test_created',broker_email,null,'queued',0);
  return jsonb_build_object('ok',true,'id',job.id,'lead_id',lead.id,'existing',false);
end; $$;

-- Explicitly callable after release verification. No cron.schedule call here.
create function crm_private.dispatch_followup_worker()
returns bigint language plpgsql security definer set search_path = '' as $$
declare worker_token text; request_id bigint;
begin
  select decrypted_secret into worker_token from vault.decrypted_secrets
    where name='fsr_followup_worker_token' order by created_at desc limit 1;
  if worker_token is null then raise exception 'Follow-up worker token is unavailable.' using errcode='28000'; end if;
  select net.http_post(
    url := 'https://www.floridasoutheastrealty.com/api/crm/follow-up/process',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||worker_token),
    body := '{}'::jsonb, timeout_milliseconds := 25000
  ) into request_id;
  return request_id;
end; $$;

revoke all on function crm_private.followup_audit_immutable(),crm_private.followup_broker(),
  crm_private.followup_worker_token_valid(text),crm_private.followup_snapshot(public.crm_leads),
  crm_private.followup_ineligible_reason(public.crm_leads,boolean),
  crm_private.followup_event(uuid,text,text,text,text,integer,jsonb),
  crm_private.enqueue_initial_followup(),crm_private.stop_changed_followups(),
  crm_private.suppress_followup_recipient(text,text,text),crm_private.dispatch_followup_worker()
  from public,anon,authenticated;
grant execute on function crm_private.dispatch_followup_worker() to service_role;

revoke all on function public.claim_followup_draft(text),
  public.complete_followup_draft(text,uuid,uuid,text,text,text,text),
  public.fail_followup_draft(text,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.claim_followup_draft(text),
  public.complete_followup_draft(text,uuid,uuid,text,text,text,text),
  public.fail_followup_draft(text,uuid,uuid,text) to anon,service_role;

revoke all on function public.edit_followup(uuid,integer,text,text),
  public.prepare_followup_send(uuid,integer),
  public.record_followup_send_result(uuid,uuid,text,text,text),
  public.pause_or_stop_followup(uuid,text,boolean),public.create_followup_test(),
  public.record_followup_outcome(bigint,text,text,text) from public,anon,authenticated;
grant execute on function public.edit_followup(uuid,integer,text,text),
  public.prepare_followup_send(uuid,integer),
  public.record_followup_send_result(uuid,uuid,text,text,text),
  public.pause_or_stop_followup(uuid,text,boolean),public.create_followup_test(),
  public.record_followup_outcome(bigint,text,text,text) to authenticated;
revoke all on function public.unsubscribe_followup(uuid) from public,anon,authenticated;
grant execute on function public.unsubscribe_followup(uuid) to anon,authenticated;

comment on table public.crm_followups is 'Broker-reviewed initial inquiry responses. No automatic send, historical backfill, or automatic retry of uncertain delivery.';
comment on function crm_private.dispatch_followup_worker() is 'Enqueues one draft-worker HTTP request; scheduling is a separate verified-release action.';
