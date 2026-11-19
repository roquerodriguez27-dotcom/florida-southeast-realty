-- Owner-only preview checks run on the signed-in app origin. They never dispatch
-- to production, export the scheduler credential, or claim a customer inquiry.
create function public.claim_followup_test_draft(p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor text:=crm_private.followup_broker(); job public.crm_followups%rowtype;
  lead public.crm_leads%rowtype; reason text; next_state text; claim_token uuid; budget integer;
begin
  select * into job from public.crm_followups
    where id=p_id and test_mode and recipient_email=actor;
  if not found then return jsonb_build_object('claimed',false,'reason','not_found'); end if;
  -- Match the recipient -> lead -> follow-up locking order used by broker sends.
  perform pg_advisory_xact_lock(hashtextextended('fsr-followup-recipient:'||actor,0));
  select * into lead from public.crm_leads where id=job.lead_id for update;
  select * into job from public.crm_followups
    where id=p_id and test_mode and recipient_email=actor for update;
  if not found then return jsonb_build_object('claimed',false,'reason','not_found'); end if;

  if job.state='drafting' and job.lease_expires_at<=now() then
    next_state:=case when job.generation_attempts<3 then 'queued' else 'draft_failed' end;
    update public.crm_followups set state=next_state,generation_token=null,lease_expires_at=null,
      last_error='Draft generation lease expired.',updated_at=now() where id=job.id returning * into job;
    perform crm_private.followup_event(job.id,'draft_lease_expired',actor,'drafting',next_state,job.draft_version);
  end if;
  if job.state='review' then
    return jsonb_build_object('claimed',false,'reason','already_ready');
  end if;
  if job.state<>'queued' or job.generation_attempts>=3 or job.next_attempt_at>now() then
    return jsonb_build_object('claimed',false,'reason','not_pending','state',job.state);
  end if;
  reason:=crm_private.followup_ineligible_reason(lead,true);
  if reason is null and lower(btrim(coalesce(lead.email,'')))<>actor then reason:='recipient_changed'; end if;
  if reason is not null then
    update public.crm_followups set state='stopped',stop_reason=reason,updated_at=now() where id=job.id;
    perform crm_private.followup_event(job.id,'eligibility_stopped',actor,job.state,'stopped',job.draft_version,
      jsonb_build_object('reason',reason));
    return jsonb_build_object('claimed',false,'reason','ineligible');
  end if;

  insert into crm_private.followup_daily_budget(day,claims) values((now() at time zone 'UTC')::date,1)
  on conflict(day) do update set claims=crm_private.followup_daily_budget.claims+1
    where crm_private.followup_daily_budget.claims<25 returning claims into budget;
  if not found then return jsonb_build_object('claimed',false,'reason','daily_limit'); end if;
  claim_token:=gen_random_uuid();
  update public.crm_followups set state='drafting',generation_token=claim_token,
    generation_attempts=generation_attempts+1,lease_expires_at=now()+interval '10 minutes',
    source_snapshot=crm_private.followup_snapshot(lead),last_error=null,updated_at=now()
    where id=job.id returning * into job;
  perform crm_private.followup_event(job.id,'owner_test_draft_claimed',actor,'queued','drafting',job.draft_version,
    jsonb_build_object('attempt',job.generation_attempts));
  return jsonb_build_object('claimed',true,'id',job.id,'generation_token',claim_token,
    'draft_version',job.draft_version,'source_snapshot',job.source_snapshot,'test_mode',true);
end; $$;

create function public.complete_followup_test_draft(p_id uuid,p_generation_token uuid,p_expected_version integer,
  p_subject text,p_body text,p_mode text,p_model text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor text:=crm_private.followup_broker(); job public.crm_followups%rowtype; worker_token text;
begin
  select * into job from public.crm_followups
    where id=p_id and test_mode and recipient_email=actor;
  if not found then return jsonb_build_object('ok',false,'reason','not_found'); end if;
  perform pg_advisory_xact_lock(hashtextextended('fsr-followup-recipient:'||actor,0));
  perform 1 from public.crm_leads where id=job.lead_id for update;
  select * into job from public.crm_followups
    where id=p_id and test_mode and recipient_email=actor for update;
  if not found then return jsonb_build_object('ok',false,'reason','not_found'); end if;
  if job.state<>'drafting' or job.generation_token is distinct from p_generation_token
    or job.draft_version is distinct from p_expected_version or job.lease_expires_at<=now() then
    return jsonb_build_object('ok',false,'reason','stale_claim');
  end if;
  -- The existing completion function rechecks eligibility and the source snapshot.
  -- This credential remains internal to SQL and is never returned to the app.
  select decrypted_secret into worker_token from vault.decrypted_secrets
    where name='fsr_followup_worker_token' order by created_at desc limit 1;
  if worker_token is null then raise exception 'Draft completion is unavailable.' using errcode='28000'; end if;
  return public.complete_followup_draft(worker_token,p_id,p_generation_token,p_subject,p_body,p_mode,p_model);
end; $$;

create function public.fail_followup_test_draft(p_id uuid,p_generation_token uuid,p_expected_version integer,p_error text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor text:=crm_private.followup_broker(); job public.crm_followups%rowtype; worker_token text;
begin
  select * into job from public.crm_followups
    where id=p_id and test_mode and recipient_email=actor;
  if not found then return jsonb_build_object('ok',false,'reason','not_found'); end if;
  perform pg_advisory_xact_lock(hashtextextended('fsr-followup-recipient:'||actor,0));
  perform 1 from public.crm_leads where id=job.lead_id for update;
  select * into job from public.crm_followups
    where id=p_id and test_mode and recipient_email=actor for update;
  if not found then return jsonb_build_object('ok',false,'reason','not_found'); end if;
  if job.state<>'drafting' or job.generation_token is distinct from p_generation_token
    or job.draft_version is distinct from p_expected_version or job.lease_expires_at<=now() then
    return jsonb_build_object('ok',false,'reason','stale_claim');
  end if;
  select decrypted_secret into worker_token from vault.decrypted_secrets
    where name='fsr_followup_worker_token' order by created_at desc limit 1;
  if worker_token is null then raise exception 'Draft completion is unavailable.' using errcode='28000'; end if;
  return public.fail_followup_draft(worker_token,p_id,p_generation_token,p_error);
end; $$;

revoke all on function public.claim_followup_test_draft(uuid),
  public.complete_followup_test_draft(uuid,uuid,integer,text,text,text,text),
  public.fail_followup_test_draft(uuid,uuid,integer,text) from public,anon,authenticated;
grant execute on function public.claim_followup_test_draft(uuid),
  public.complete_followup_test_draft(uuid,uuid,integer,text,text,text,text),
  public.fail_followup_test_draft(uuid,uuid,integer,text) to authenticated;

comment on function public.claim_followup_test_draft(uuid) is
  'Claims only the active broker''s specified owner test; shares the normal daily budget without a scheduler credential.';
