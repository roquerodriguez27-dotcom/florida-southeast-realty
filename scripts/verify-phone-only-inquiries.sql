-- Regression checks for the installed phone-only inquiry repair.
-- All fixture CRM writes roll back. Identity sequence numbers may advance.
-- The trigger guard stops if the reviewed local-only trigger chain has changed.
begin;
set local statement_timeout = '20s';
set local lock_timeout = '3s';
-- Calls the database RPC directly; no HTTP route or notification sender is run.
-- Its deployed triggers only write CRM tables, and were inspected before testing.
select set_config('fsr.phone_only_test_tag', 'fsr-phone-only-validation-' || gen_random_uuid()::text, true);

-- CREATE OR REPLACE must keep the existing narrow EXECUTE ACL and RLS.
do $security$
declare fn oid := 'public.capture_crm_lead(text,text,text,text,text,text,jsonb,boolean)'::regprocedure;
begin
  if not has_function_privilege('anon', fn, 'EXECUTE')
    or not has_function_privilege('service_role', fn, 'EXECUTE')
    or has_function_privilege('authenticated', fn, 'EXECUTE') then
    raise exception 'RPC execution grants changed';
  end if;
  if exists (select 1 from pg_proc p, lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    where p.oid=fn and a.grantee=0 and a.privilege_type='EXECUTE') then
    raise exception 'PUBLIC must not execute the lead RPC';
  end if;
  if exists (select 1 from pg_class where oid in (
    'public.crm_leads'::regclass, 'public.crm_tasks'::regclass, 'public.crm_activities'::regclass
  ) and not relrowsecurity) then
    raise exception 'CRM RLS is disabled';
  end if;
end;
$security$;

-- Abort if the inspected local-only trigger chain has changed. The captured
-- definitions assign follow-ups and write CRM tasks/activities; neither sends
-- HTTP, email, NOTIFY, or queues external work.
do $trigger_guard$
begin
  if (select count(*) from pg_trigger
    where tgrelid in ('public.crm_leads'::regclass,'public.crm_tasks'::regclass,'public.crm_activities'::regclass)
      and not tgisinternal) <> 2 then
    raise exception 'Unexpected CRM trigger: re-inspect before any fixture write';
  end if;
  if not exists (select 1 from pg_trigger where tgrelid='public.crm_leads'::regclass
    and tgname='prepare_crm_lead' and tgenabled='O'
    and pg_get_triggerdef(oid)='CREATE TRIGGER prepare_crm_lead BEFORE INSERT OR UPDATE ON public.crm_leads FOR EACH ROW EXECUTE FUNCTION crm_private.prepare_crm_lead()'
    and md5(pg_get_functiondef(tgfoid))='4691145074363475bf90e03a84a77a0c')
  or not exists (select 1 from pg_trigger where tgrelid='public.crm_leads'::regclass
    and tgname='sync_crm_follow_up' and tgenabled='O'
    and pg_get_triggerdef(oid)='CREATE TRIGGER sync_crm_follow_up AFTER INSERT OR UPDATE ON public.crm_leads FOR EACH ROW EXECUTE FUNCTION crm_private.sync_crm_follow_up()'
    and md5(pg_get_functiondef(tgfoid))='29c094381ca000cb8791ee156536fe3b') then
    raise exception 'CRM trigger definition changed: re-inspect before testing';
  end if;
end;
$trigger_guard$;


set local role anon;
do $success$
declare
  tag text := current_setting('fsr.phone_only_test_tag');
  property_fields jsonb := jsonb_build_object('qaRun',tag,'qaCase','phone-property','name','Rollback property check','email','','phone','(202) 555-0101');
  buyer_fields jsonb := jsonb_build_object('qaRun',tag,'qaCase','phone-buyer','phone','+1 (202) 555-0102 x 9');
  email_fields jsonb := jsonb_build_object('qaRun',tag,'qaCase','email-contact','email','lead-validation@example.invalid');
begin
  -- Property inquiry: original, exact replay and reformatted replay are one record.
  perform public.capture_crm_lead('Rollback property check',null,'(202) 555-0101','property-inquiry','Example property','Property check',property_fields,true);
  perform public.capture_crm_lead('Rollback property check',null,'(202) 555-0101','property-inquiry','Example property','Property check',property_fields,true);
  perform public.capture_crm_lead('Rollback property check','  ','202.555.0101','property-inquiry','Example property','Property check',property_fields || '{"phone":"202.555.0101","email":"  "}'::jsonb,true);
  -- Distinct phone with otherwise EXACTLY identical fields must not merge.
  perform public.capture_crm_lead('Rollback property check',null,'202-555-0103','property-inquiry','Example property','Property check',property_fields,true);
  -- Distinct message/name with the same number must also remain distinct.
  perform public.capture_crm_lead('Rollback property check',null,'2025550101','property-inquiry','Example property','Different inquiry',property_fields,true);
  perform public.capture_crm_lead('Different rollback visitor',null,'2025550101','property-inquiry','Example property','Property check',property_fields,true);

  -- Buyer review: absent name is supplied by the route as "Website visitor".
  -- Extensions remain allowed and different extensions stay separate.
  perform public.capture_crm_lead('Website visitor',null,'+1 (202) 555-0102 x 9','buyer-tools-review',null,'Buyer check',buyer_fields,true);
  perform public.capture_crm_lead('Website visitor','','+1-202-555-0102x9','buyer-tools-review',null,'Buyer check',buyer_fields || '{"phone":"+1-202-555-0102x9"}'::jsonb,true);
  perform public.capture_crm_lead('Website visitor',null,'+1-202-555-0102x10','buyer-tools-review',null,'Buyer check',buyer_fields,true);

  -- Existing valid email behavior and duplicate handling are unchanged.
  perform public.capture_crm_lead('Rollback email check',' LEAD-VALIDATION@example.invalid ',null,'contact',null,'Contact check',email_fields,true);
  perform public.capture_crm_lead('Rollback email check','lead-validation@example.invalid',null,'contact',null,'Contact check',email_fields,true);
  perform public.capture_crm_lead('Rollback email property','email-property@example.invalid',null,'property-inquiry',null,null,jsonb_build_object('qaRun',tag,'qaCase','email-property'),true);
  perform public.capture_crm_lead('Rollback email buyer','email-buyer@example.invalid',null,'buyer-tools-review',null,null,jsonb_build_object('qaRun',tag,'qaCase','email-buyer'),true);
  -- A supplied optional phone remains subject only to the existing max length
  -- when email is valid; this repair adds no global telephone format restriction.
  perform public.capture_crm_lead('Rollback optional phone','optional-phone@example.invalid','Please use email','contact',null,null,jsonb_build_object('qaRun',tag,'qaCase','optional-phone'),true);
end;
$success$;

do $reject$
declare
  tag text := current_setting('fsr.phone_only_test_tag');
  c record;
begin
  for c in select * from (values
    ('property missing both',null::text,null::text,'property-inquiry',true),
    ('buyer missing both','','   ','buyer-tools-review',true),
    ('property bad supplied email','not-an-email','2025550101','property-inquiry',true),
    ('buyer bad supplied email','not-an-email','2025550101','buyer-tools-review',true),
    ('contact still needs email',null,'2025550101','contact',true),
    ('valuation still needs email',null,'2025550101','home-valuation',true),
    ('other form still needs email',null,'2025550101','unknown-form',true),
    ('phone has no digits',null,'Please call me','property-inquiry',true),
    ('phone too short',null,'123','buyer-tools-review',true),
    ('phone too long',null,repeat('1',41),'property-inquiry',true),
    ('consent still required',null,'2025550101','property-inquiry',false)
  ) as cases(label,email,phone,form_name,consent)
  loop
    begin
      perform public.capture_crm_lead('Rollback rejected case',c.email,c.phone,c.form_name,null,null,jsonb_build_object('qaRun',tag,'qaCase','must-reject'),c.consent);
      raise exception 'Invalid request unexpectedly accepted: %',c.label;
    exception when sqlstate '22023' then
      null;
    end;
  end loop;

  begin
    perform public.capture_crm_lead('Rollback invalid fields',null,'2025550101','property-inquiry',null,null,jsonb_build_object('qaRun',tag,'qaCase','must-reject','unexpectedNumber',1),true);
    raise exception 'Non-string field value unexpectedly accepted';
  exception when sqlstate '22023' then
    null;
  end;
end;
$reject$;

-- Anonymous callers can submit validated RPC input but cannot directly read/write CRM.
do $anon_isolation$
declare visible integer;
begin
  begin
    select count(*) into visible from public.crm_leads
      where fields->>'qaRun'=current_setting('fsr.phone_only_test_tag');
    if visible <> 0 then raise exception 'Anonymous caller can read CRM leads'; end if;
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.crm_leads(full_name,email,phone,source,form_name,consent,fields)
      values('Unauthorized direct-write check','direct-write@example.invalid',null,'website','contact',true,jsonb_build_object('qaRun',current_setting('fsr.phone_only_test_tag'),'qaCase','must-reject'));
    raise exception 'Anonymous caller can insert directly into CRM';
  exception when insufficient_privilege then null;
  end;
end;
$anon_isolation$;
reset role;

set local role authenticated;
do $authenticated_isolation$
begin
  begin
    perform public.capture_crm_lead('Unauthorized RPC check',null,'2025550101','property-inquiry',null,null,jsonb_build_object('qaRun',current_setting('fsr.phone_only_test_tag'),'qaCase','must-reject'),true);
    raise exception 'Authenticated role unexpectedly gained write-only RPC execution';
  exception when insufficient_privilege then null;
  end;
end;
$authenticated_isolation$;
reset role;

do $stored$
declare
  tag text := current_setting('fsr.phone_only_test_tag');
  c record;
  actual integer;
begin
  for c in select * from (values
    ('phone-property',4),('phone-buyer',2),('email-contact',1),
    ('email-property',1),('email-buyer',1),('optional-phone',1),('must-reject',0)
  ) as expected(case_name,n)
  loop
    select count(*) into actual from public.crm_leads
      where fields->>'qaRun'=tag and fields->>'qaCase'=c.case_name;
    if actual <> c.n then raise exception 'Case % expected % records, got %',c.case_name,c.n,actual; end if;
  end loop;
  if exists(select 1 from public.crm_leads where fields->>'qaRun'=tag
    and fields->>'qaCase' in ('phone-property','phone-buyer') and email is not null) then
    raise exception 'Missing email must be stored as SQL NULL';
  end if;
  if not exists(select 1 from public.crm_leads where fields->>'qaRun'=tag
    and fields->>'qaCase'='email-contact' and email='lead-validation@example.invalid') then
    raise exception 'Existing email normalization changed';
  end if;
  if (select count(*) from public.crm_tasks t join public.crm_leads l on l.id=t.lead_id
    where l.fields->>'qaRun'=tag and t.automation_key='lead_follow_up') <> 10 then
    raise exception 'Expected one follow-up task per accepted distinct lead';
  end if;
  if (select count(*) from public.crm_activities a join public.crm_leads l on l.id=a.lead_id
    where l.fields->>'qaRun'=tag) <> 10 then
    raise exception 'Expected one local CRM activity per accepted distinct lead';
  end if;
end;
$stored$;

select jsonb_build_object(
  'result','PASS',
  'test_tag',current_setting('fsr.phone_only_test_tag'),
  'accepted_distinct_leads',10,
  'phone_only_distinct_leads',6,
  'notifications_sent',0,
  'next_action','ROLLBACK'
) as phone_only_validation;

rollback;
select count(*) as persisted_validation_leads
from public.crm_leads
where fields->>'qaRun' like 'fsr-phone-only-validation-%';
