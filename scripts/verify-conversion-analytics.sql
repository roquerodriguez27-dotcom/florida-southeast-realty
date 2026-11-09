-- Run after the conversion migration, or place that migration after BEGIN below.
-- Every synthetic event and temporary fixture is rolled back. No CRM rows,
-- notifications, credentials, roles, grants or authentication claims are changed.
begin;

do $$
declare
  v_observed uuid := pg_catalog.gen_random_uuid();
  v_automation uuid := pg_catalog.gen_random_uuid();
  v_unknown uuid := pg_catalog.gen_random_uuid();
  v_legacy uuid := pg_catalog.gen_random_uuid();
  v_session uuid := pg_catalog.gen_random_uuid();
  v_duplicate uuid := pg_catalog.gen_random_uuid();
  v_event text;
  v_meta jsonb;
  v_stored jsonb;
  v_report jsonb;
  v_query text;
  v_function text;
  v_expected text;
begin
  if not pg_catalog.has_function_privilege('anon', 'public.capture_site_analytics_event(uuid,uuid,text,text,text,jsonb)', 'EXECUTE')
    or pg_catalog.has_function_privilege('authenticated', 'public.capture_site_analytics_event(uuid,uuid,text,text,text,jsonb)', 'EXECUTE')
    or pg_catalog.has_table_privilege('anon', 'private.site_analytics_events', 'SELECT')
    or pg_catalog.has_table_privilege('anon', 'private.site_analytics_events', 'INSERT')
    or pg_catalog.has_function_privilege('anon', 'public.get_site_analytics_report(integer)', 'EXECUTE')
    or pg_catalog.has_function_privilege('service_role', 'public.get_site_analytics_report(integer)', 'EXECUTE')
    or not pg_catalog.has_function_privilege('authenticated', 'public.get_site_analytics_report(integer)', 'EXECUTE')
    or pg_catalog.has_function_privilege('anon', 'crm_private.get_site_analytics_report(integer)', 'EXECUTE')
    then raise exception 'Analytics access scope changed'; end if;

  if (select auth.uid()) is not null then
    raise exception 'Run the fixture verification without an end-user JWT';
  end if;
  begin
    perform public.get_site_analytics_report(7);
    raise exception 'Unauthenticated report access unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;

  v_meta := pg_catalog.jsonb_build_object('signalVersion','3','trafficScope','production',
    'visitorType','browser','automatedSignal','none','interactionObserved',true,
    'formName','property-inquiry','requestType','question','campaign','seller-review');
  if not public.capture_site_analytics_event(v_observed,v_session,'visitor_interaction','/properties/private-address?email=private@example.test',null,
    v_meta || pg_catalog.jsonb_build_object('interactionKind','pointer','eventId',pg_catalog.gen_random_uuid())) then
    raise exception 'Valid interaction was rejected';
  end if;

  foreach v_event in array array['form_start','form_submit_attempt','form_validation_error','form_submit_error','lead_submit','call_click','text_click','email_click'] loop
    if not public.capture_site_analytics_event(v_observed,v_session,v_event,'/properties/private-address?email=private@example.test','private-referrer.example',
      v_meta || pg_catalog.jsonb_build_object('eventId',pg_catalog.gen_random_uuid(),'errorKind','storage','email','private@example.test','question','private question','utm_campaign','private campaign')) then
      raise exception 'Valid conversion event % was rejected', v_event;
    end if;
  end loop;
  perform public.capture_site_analytics_event(v_observed,v_session,'form_submit_attempt','/properties/private-address',null,
    v_meta || pg_catalog.jsonb_build_object('eventId',pg_catalog.gen_random_uuid()));
  perform public.capture_site_analytics_event(v_observed,v_session,'text_click','/properties/private-address',null,
    v_meta || pg_catalog.jsonb_build_object('eventId',v_duplicate));
  perform public.capture_site_analytics_event(v_observed,v_session,'text_click','/properties/private-address',null,
    v_meta || pg_catalog.jsonb_build_object('eventId',v_duplicate));
  if (select count(*) from private.site_analytics_events where visitor_id=v_observed and event_name='text_click') <> 2 then
    raise exception 'Event ID duplicate protection failed';
  end if;
  select metadata into v_stored from private.site_analytics_events
    where visitor_id=v_observed and event_name='form_submit_error';
  if v_stored ->> 'formName' <> 'property-inquiry' or v_stored ->> 'requestType' <> 'question'
    or v_stored ->> 'errorKind' <> 'storage' or v_stored ->> 'campaign' <> 'seller-review'
    or v_stored ?| array['email','question','utm_campaign'] then
    raise exception 'Allowed labels or metadata privacy boundary failed';
  end if;
  if exists (select 1 from private.site_analytics_events where visitor_id=v_observed
    and (path <> '/properties/[listing]' or referrer_host is not null
      or metadata::text like '%private@example.test%' or metadata::text like '%private question%')) then
    raise exception 'Private property, contact or referrer text was retained';
  end if;

  foreach v_event in array array['visitor_interaction','form_start','lead_submit','call_click'] loop
    perform public.capture_site_analytics_event(v_automation,v_session,v_event,'/sellers',null,
      v_meta || pg_catalog.jsonb_build_object('visitorType','probable_bot','automatedSignal','webdriver','interactionKind','pointer','eventId',pg_catalog.gen_random_uuid()));
  end loop;
  foreach v_event in array array['page_view','form_submit_attempt','call_click'] loop
    perform public.capture_site_analytics_event(v_unknown,v_session,v_event,'/sellers',null,
      (v_meta - 'interactionObserved') || pg_catalog.jsonb_build_object('eventId',pg_catalog.gen_random_uuid()));
  end loop;
  perform public.capture_site_analytics_event(v_legacy,v_session,'lead_submit','/contact',null,
    pg_catalog.jsonb_build_object('signalVersion','2','eventId',pg_catalog.gen_random_uuid()));

  perform public.capture_site_analytics_event(v_unknown,v_session,'page_view','/contact?email=private@example.test',null,
    pg_catalog.jsonb_build_object('signalVersion','3','trafficScope','production','eventId',pg_catalog.gen_random_uuid(),
      'formName','private@example.test','requestType','private question','errorKind','private error','campaign','private campaign'));
  if exists (select 1 from private.site_analytics_events where visitor_id=v_unknown and path='/contact'
    and metadata ?| array['formName','requestType','errorKind','campaign']) then
    raise exception 'Unrecognised labels were retained';
  end if;
  if public.capture_site_analytics_event(v_observed,v_session,'send_private_data','/contact',null,'{}'::jsonb)
    or public.capture_site_analytics_event(v_observed,v_session,'form_start','/crm',null,v_meta)
    or public.capture_site_analytics_event(v_unknown,v_session,'visitor_interaction','/contact',null,v_meta)
    then raise exception 'Invalid event, private route or incomplete interaction was accepted'; end if;

  -- Exercise the exact report aggregation against only these rolled-back fixtures.
  -- This is a privileged test query, not a broker JWT or a change to the report guard.
  create temporary table fsr_conversion_fixture_events on commit drop as
    select * from private.site_analytics_events where visitor_id in (v_observed,v_automation,v_unknown,v_legacy);
  v_function := pg_catalog.pg_get_functiondef('crm_private.get_site_analytics_report(integer)'::regprocedure);
  if pg_catalog.strpos(v_function, 'not crm_private.is_crm_broker()') = 0
    or pg_catalog.strpos(v_function, 'auth.uid()') = 0 then
    raise exception 'Broker authorization guard missing';
  end if;
  v_query := pg_catalog.substr(v_function, pg_catalog.strpos(v_function, 'with recent as materialized'));
  v_query := pg_catalog.split_part(v_query, '  return v_report;', 1);
  v_query := pg_catalog.replace(v_query, 'private.site_analytics_events', 'pg_temp.fsr_conversion_fixture_events');
  v_query := pg_catalog.replace(v_query, 'v_from', '$1');
  v_query := pg_catalog.replace(v_query, 'p_days', '$2');
  v_query := pg_catalog.replace(v_query, 'into v_report', '');
  execute v_query into v_report using now() - interval '7 days', 7;

  if v_report #>> '{current,browsers}' <> '3'
    or v_report #>> '{current,interactionBrowsers}' <> '1'
    or v_report #>> '{current,probableAutomationBrowsers}' <> '1'
    or v_report #>> '{current,unclassifiedBrowsers}' <> '1'
    or v_report #>> '{legacy,events}' <> '1'
    then raise exception 'Current/legacy browser classification failed'; end if;
  foreach v_expected in array array['formStarts','validationErrors','submissionErrors','successfulSubmissions','calls','emails'] loop
    if v_report #>> array['conversion','observed',v_expected] <> '1' then
      raise exception 'Observed conversion counter % failed', v_expected;
    end if;
  end loop;
  if v_report #>> '{conversion,observed,submissionAttempts}' <> '2'
    or v_report #>> '{conversion,observed,texts}' <> '2'
    or v_report #>> '{conversion,observed,legacyPhoneClicks}' <> '0'
    or v_report #>> '{conversion,automation,successfulSubmissions}' <> '1'
    or v_report #>> '{conversion,automation,formStarts}' <> '1'
    or v_report #>> '{conversion,unclassified,submissionAttempts}' <> '1'
    or v_report #>> '{conversion,unclassified,calls}' <> '1'
    then raise exception 'Conversion cohort separation failed'; end if;
  if pg_catalog.jsonb_array_length(v_report #> '{conversion,forms}') <> 1
    or v_report #>> '{conversion,forms,0,formName}' <> 'property-inquiry'
    or v_report #>> '{conversion,forms,0,requestType}' <> 'question'
    or v_report #>> '{conversion,forms,0,submissionAttempts}' <> '2'
    or v_report #>> '{conversion,forms,0,successfulSubmissions}' <> '1'
    then raise exception 'Form breakdown failed'; end if;
  if pg_catalog.jsonb_array_length(v_report #> '{conversion,campaigns}') <> 1
    or v_report #>> '{conversion,campaigns,0,campaign}' <> 'seller-review'
    or v_report #>> '{conversion,campaigns,0,submissions}' <> '1'
    or v_report #>> '{conversion,campaigns,0,contactClicks}' <> '4'
    then raise exception 'Campaign breakdown failed'; end if;
end;
$$;

rollback;
