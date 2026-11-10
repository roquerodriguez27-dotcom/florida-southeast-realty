-- Extend only fixed planning route/form allowlists in the existing private analytics pipeline.
-- No new fields, privileges, PII, events or cohort definitions.
CREATE OR REPLACE FUNCTION public.capture_site_analytics_event(p_visitor_id uuid, p_session_id uuid, p_event_name text, p_path text, p_referrer_host text DEFAULT NULL::text, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_path text;
  v_metadata jsonb;
begin
  if p_visitor_id is null or p_session_id is null or p_event_name is null
    or p_event_name <> all (array['page_view','property_search','property_view','home_valuation_view','lead_submit','phone_click','email_click','saved_search_submit','compare_change','buyer_tool_use','visitor_interaction','call_click','text_click','form_start','form_submit_attempt','form_validation_error','form_submit_error']::text[])
    then return false; end if;
  if p_path is null or char_length(p_path) < 1 or char_length(p_path) > 600
    or left(p_path, 1) <> '/' or p_path ~* '^/(crm|api|auth)(/|$|\?)'
    then return false; end if;
  if p_metadata is null or pg_catalog.jsonb_typeof(p_metadata) <> 'object'
    or pg_catalog.octet_length(p_metadata::text) > 4096 then return false; end if;

  -- Discard arbitrary text, query strings and referrers at the database boundary too.
  v_path := pg_catalog.split_part(pg_catalog.split_part(p_path, '?', 1), '#', 1);
  v_path := case
    when v_path ~ '^/properties/[^/]+/?$' then '/properties/[listing]'
    when v_path ~ '^/communities/[^/]+/?$' then '/communities/[community]'
    when v_path ~ '^/homes-for-sale/[^/]+/?$' then '/homes-for-sale/[market]'
    when v_path ~ '^/guides/[^/]+/?$' then '/guides/[guide]'
    when v_path ~ '^/blog/[^/]+/?$' then '/blog/[article]'
    when v_path = any (array['/','/properties','/home-valuation','/buyer-tools','/contact','/about','/sellers','/communities','/research','/join','/guides','/testimonials','/terms-of-use','/privacy-policy','/fair-housing','/accessibility-statement','/blog','/fort-lauderdale-homes-for-sale','/compare','/saved-homes','/planning','/planning/buy','/planning/sell','/planning/own','/ask-roque','/research/homeowner-updates']) then v_path
    else '/other' end;
  select coalesce(pg_catalog.jsonb_object_agg(e.key, e.value), '{}'::jsonb)
    into v_metadata from pg_catalog.jsonb_each(p_metadata) as e
    where (e.key = 'signalVersion' and e.value in ('"2"'::jsonb, '"3"'::jsonb))
       or (e.key = 'trafficScope' and e.value = '"production"'::jsonb)
       or (e.key = 'interactionObserved' and pg_catalog.jsonb_typeof(e.value) = 'boolean')
       or (e.key = 'visitorType' and e.value in ('"browser"'::jsonb, '"probable_bot"'::jsonb))
       or (e.key = 'automatedSignal' and e.value in ('"webdriver"'::jsonb, '"user_agent"'::jsonb, '"none"'::jsonb))
       or (e.key = 'interactionKind' and e.value in ('"pointer"'::jsonb, '"keyboard"'::jsonb))
       or (e.key = 'formName' and e.value #>> '{}' = any (array['contact','home-valuation','sellers-page','buyer-inquiry','property-inquiry','buyer-tools-review','agent-recruiting','planning-seller-proceeds','planning-seller-timing','planning-seller-preparation','planning-seller-offers','planning-seller-report','planning-buyer-checklist','planning-buyer-relocation','planning-buyer-tour','planning-buyer-loans','planning-owner-calendar','planning-voice-question']) and pg_catalog.jsonb_typeof(e.value) = 'string')
       or (e.key = 'requestType' and e.value in ('"showing"'::jsonb, '"question"'::jsonb, '"shortlist"'::jsonb))
       or (e.key = 'errorKind' and e.value in ('"validation"'::jsonb, '"network"'::jsonb, '"server"'::jsonb, '"storage"'::jsonb))
       or (e.key = 'campaign' and e.value in ('"seller-review"'::jsonb, '"buyer-search"'::jsonb, '"property-share"'::jsonb, '"referral"'::jsonb))
       or (e.key = 'eventId' and e.value #>> '{}' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$');
  if p_event_name = 'visitor_interaction' and
    (coalesce(v_metadata ->> 'signalVersion', '') <> '3'
     or coalesce(v_metadata ->> 'interactionObserved', '') <> 'true'
     or coalesce(v_metadata ->> 'interactionKind', '') not in ('pointer', 'keyboard'))
    then return false; end if;
  if (select count(*) from private.site_analytics_events e
      where e.visitor_id = p_visitor_id and e.occurred_at > now() - interval '1 minute') >= 120
    then return true; end if;
  -- Old clients did not provide event IDs. Retain their previous duplicate protection.
  if not (v_metadata ? 'eventId') and exists (
    select 1 from private.site_analytics_events e where e.visitor_id = p_visitor_id
      and e.event_name = p_event_name and e.path = v_path
      and e.occurred_at > now() - interval '1 second'
  ) then return true; end if;
  insert into private.site_analytics_events (visitor_id, session_id, event_name, path, referrer_host, metadata)
    values (p_visitor_id, p_session_id, p_event_name, v_path, null, v_metadata)
    on conflict do nothing;
  return true;
end;
$function$;

CREATE OR REPLACE FUNCTION crm_private.get_site_analytics_report(p_days integer DEFAULT 7)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_from timestamptz;
  v_report jsonb;
begin
  if (select auth.uid()) is null or not crm_private.is_crm_broker() then
    raise exception 'Broker access required' using errcode = '42501';
  end if;
  if p_days is null or p_days not in (7, 30) then
    raise exception 'Report period must be 7 or 30 days' using errcode = '22023';
  end if;
  v_from := now() - pg_catalog.make_interval(days => p_days);
  with recent as materialized (
    select e.visitor_id, e.session_id, e.event_name, e.path, e.occurred_at, e.metadata,
      coalesce(e.metadata ->> 'signalVersion' = '3' and e.metadata ->> 'trafficScope' = 'production', false) as current_measurement
    from private.site_analytics_events e
    where e.occurred_at >= v_from and e.occurred_at <= now()
  ), measured as materialized (
    select * from recent where current_measurement
  ), browsers as (
    select visitor_id,
      bool_or(coalesce(metadata ->> 'visitorType' = 'probable_bot', false)
        or coalesce(metadata ->> 'automatedSignal' in ('webdriver', 'user_agent'), false)) as probable_automation,
      bool_or(event_name = 'visitor_interaction' and metadata ->> 'interactionObserved' = 'true'
        and metadata ->> 'interactionKind' in ('pointer', 'keyboard')) as observed_interaction
    from measured group by visitor_id
  ), classified as materialized (
    select m.*, case when b.probable_automation then 'automation'
      when coalesce(b.observed_interaction, false) then 'observed' else 'unclassified' end as cohort
    from measured m join browsers b using (visitor_id)
  ), conversion_totals as (
    select cohort, pg_catalog.jsonb_build_object(
        'formStarts', count(*) filter (where event_name = 'form_start'),
        'submissionAttempts', count(*) filter (where event_name = 'form_submit_attempt'),
        'validationErrors', count(*) filter (where event_name = 'form_validation_error'),
        'submissionErrors', count(*) filter (where event_name = 'form_submit_error'),
        'successfulSubmissions', count(*) filter (where event_name = 'lead_submit'),
        'calls', count(*) filter (where event_name = 'call_click'),
        'texts', count(*) filter (where event_name = 'text_click'),
        'emails', count(*) filter (where event_name = 'email_click'),
        'legacyPhoneClicks', count(*) filter (where event_name = 'phone_click')
    ) as counts from classified group by cohort
  ), form_totals as (
    select case when metadata ->> 'formName' = any (array['contact','home-valuation','sellers-page','buyer-inquiry','property-inquiry','buyer-tools-review','agent-recruiting','planning-seller-proceeds','planning-seller-timing','planning-seller-preparation','planning-seller-offers','planning-seller-report','planning-buyer-checklist','planning-buyer-relocation','planning-buyer-tour','planning-buyer-loans','planning-owner-calendar','planning-voice-question'])
        then metadata ->> 'formName' else 'unknown' end as form_name,
      case when metadata ->> 'requestType' in ('showing', 'question', 'shortlist')
        then metadata ->> 'requestType' else 'unspecified' end as request_type,
      count(*) filter (where event_name = 'form_start') as form_starts,
      count(*) filter (where event_name = 'form_submit_attempt') as submission_attempts,
      count(*) filter (where event_name = 'form_validation_error') as validation_errors,
      count(*) filter (where event_name = 'form_submit_error') as submission_errors,
      count(*) filter (where event_name = 'lead_submit') as successful_submissions
    from classified where cohort = 'observed'
      and event_name in ('form_start','form_submit_attempt','form_validation_error','form_submit_error','lead_submit')
    group by 1, 2
  ), campaign_totals as (
    select metadata ->> 'campaign' as campaign,
      count(*) filter (where event_name = 'page_view') as pageviews,
      count(*) filter (where event_name = 'lead_submit') as submissions,
      count(*) filter (where event_name in ('call_click','text_click','email_click')) as contact_clicks
    from classified where cohort = 'observed'
      and metadata ->> 'campaign' in ('seller-review','buyer-search','property-share','referral')
    group by 1
  ), daily as (
    select (occurred_at at time zone 'UTC')::date as day,
      count(distinct visitor_id) as browsers,
      count(*) filter (where event_name = 'page_view') as pageviews,
      count(*) filter (where event_name = 'property_search') as searches,
      count(*) filter (where event_name = 'lead_submit') as leads
    from measured group by 1
  ), pages as (
    select path, count(*) as pageviews from measured where event_name = 'page_view'
    group by path order by count(*) desc, path limit 10
  )
  select pg_catalog.jsonb_build_object(
    'days', p_days, 'generatedAt', now(), 'from', v_from,
    'current', pg_catalog.jsonb_build_object(
      'browsers', (select count(*) from browsers),
      'sessions', (select count(distinct session_id) from measured),
      'interactionBrowsers', (select count(*) from browsers where observed_interaction and not probable_automation),
      'probableAutomationBrowsers', (select count(*) from browsers where probable_automation),
      'unclassifiedBrowsers', (select count(*) from browsers where not probable_automation and not coalesce(observed_interaction, false)),
      'pageviews', (select count(*) from measured where event_name = 'page_view'),
      'searches', (select count(*) from measured where event_name = 'property_search'),
      'leads', (select count(*) from measured where event_name = 'lead_submit'),
      'savedSearches', (select count(*) from measured where event_name = 'saved_search_submit')
    ),
    'conversion', pg_catalog.jsonb_build_object(
      'observed', coalesce((select counts from conversion_totals where cohort = 'observed'), pg_catalog.jsonb_build_object('formStarts', 0, 'submissionAttempts', 0, 'validationErrors', 0, 'submissionErrors', 0, 'successfulSubmissions', 0, 'calls', 0, 'texts', 0, 'emails', 0, 'legacyPhoneClicks', 0)),
      'unclassified', coalesce((select counts from conversion_totals where cohort = 'unclassified'), pg_catalog.jsonb_build_object('formStarts', 0, 'submissionAttempts', 0, 'validationErrors', 0, 'submissionErrors', 0, 'successfulSubmissions', 0, 'calls', 0, 'texts', 0, 'emails', 0, 'legacyPhoneClicks', 0)),
      'automation', coalesce((select counts from conversion_totals where cohort = 'automation'), pg_catalog.jsonb_build_object('formStarts', 0, 'submissionAttempts', 0, 'validationErrors', 0, 'submissionErrors', 0, 'successfulSubmissions', 0, 'calls', 0, 'texts', 0, 'emails', 0, 'legacyPhoneClicks', 0)),
      'forms', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'formName', form_name, 'requestType', request_type,
        'formStarts', form_starts, 'submissionAttempts', submission_attempts,
        'validationErrors', validation_errors, 'submissionErrors', submission_errors,
        'successfulSubmissions', successful_submissions
      ) order by form_name, request_type) from form_totals), '[]'::jsonb),
      'campaigns', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'campaign', campaign, 'pageviews', pageviews, 'submissions', submissions, 'contactClicks', contact_clicks
      ) order by campaign) from campaign_totals), '[]'::jsonb)
    ),
    'legacy', pg_catalog.jsonb_build_object(
      'events', (select count(*) from recent where not current_measurement),
      'browsers', (select count(distinct visitor_id) from recent where not current_measurement)
    ),
    'daily', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'date', day, 'browsers', browsers, 'pageviews', pageviews, 'searches', searches, 'leads', leads
    ) order by day desc) from daily), '[]'::jsonb),
    'topPages', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'path', path, 'pageviews', pageviews
    ) order by pageviews desc, path) from pages), '[]'::jsonb)
  ) into v_report;
  return v_report;
end;
$function$;
