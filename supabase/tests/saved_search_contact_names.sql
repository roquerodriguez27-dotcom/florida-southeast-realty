-- Regression checks for public.capture_saved_search contact-name handling.
-- Run with the reviewed table migrations and RPC installed, as the DB owner.
-- Every address is unique to this run and uses the non-deliverable .invalid TLD.
-- This script calls no HTTP, email, worker, or scheduler code. Before hosted
-- execution, inspect installed table triggers for external side effects.
-- All fixture rows roll back; PostgreSQL identity sequences can still advance.
BEGIN;
SET LOCAL statement_timeout = '20s';
SET LOCAL lock_timeout = '3s';

DO $regression$
DECLARE
  run_tag text := replace(gen_random_uuid()::text, '-', '');
  case_row record;
  case_email text;
  case_criteria jsonb;
  established_name text;
  target_lead_id bigint;
  older_lead_id bigint;
  earlier_follow_up timestamptz := now() + interval '15 minutes';
  pending_result boolean;
  idx_enabled boolean;
  rejected boolean;
  activity_count_before bigint;
  db_lead public.crm_leads%ROWTYPE;
  db_search public.saved_searches%ROWTYPE;
BEGIN
  -- The legacy fallback is deliberately FIRST: the previous function must
  -- fail on the known name-overwrite defect before any new input-contract case.
  FOR case_row IN
    SELECT * FROM (VALUES
      (1, 'legacy', 'Website visitor'::text),
      (2, 'null', NULL::text),
      (3, 'empty', ''::text),
      (4, 'spaces', '    '::text),
      (5, 'tabs-newlines', E'\t\n'::text),
      (6, 'mixed-whitespace', E' \t\r\n '::text)
    ) AS cases(ordinal, case_name, supplied_name)
    ORDER BY ordinal
  LOOP
    case_email := 'ss-names-' || run_tag || '-existing-' || case_row.case_name || '@example.invalid';
    established_name := 'Established Client ' || case_row.case_name;
    case_criteria := jsonb_build_object('qaRun', run_tag, 'qaCase', 'existing-' || case_row.case_name);

    INSERT INTO public.crm_leads
      (full_name, email, phone, source, form_name, consent, fields, next_follow_up_at)
    VALUES
      (established_name, case_email, '(202) 555-0100', 'qa-regression', 'qa-name-test',
       true, jsonb_build_object('qaRun', run_tag, 'original', 'retain'), earlier_follow_up)
    RETURNING id INTO target_lead_id;

    pending_result := public.capture_saved_search(
      case_row.supplied_name, ' ' || upper(case_email) || ' ', NULL,
      'daily', false, case_criteria, true
    );

    SELECT * INTO STRICT db_lead FROM public.crm_leads WHERE id = target_lead_id;
    IF db_lead.full_name IS DISTINCT FROM established_name THEN
      RAISE EXCEPTION 'Existing real name overwritten for %: got %', case_row.case_name, db_lead.full_name;
    END IF;
    IF db_lead.phone IS DISTINCT FROM '(202) 555-0100'
      OR db_lead.next_follow_up_at IS DISTINCT FROM earlier_follow_up THEN
      RAISE EXCEPTION 'Existing phone or earlier follow-up changed for %', case_row.case_name;
    END IF;
    IF db_lead.source IS DISTINCT FROM 'qa-regression'
      OR db_lead.form_name IS DISTINCT FROM 'qa-name-test'
      OR db_lead.fields IS DISTINCT FROM jsonb_build_object('qaRun', run_tag, 'original', 'retain') THEN
      RAISE EXCEPTION 'Unrelated existing contact context changed for %', case_row.case_name;
    END IF;
    IF pending_result IS DISTINCT FROM false THEN
      RAISE EXCEPTION 'Active subscription must return false for %', case_row.case_name;
    END IF;
    SELECT * INTO STRICT db_search FROM public.saved_searches WHERE email = case_email;
    IF db_search.lead_id IS DISTINCT FROM target_lead_id
      OR db_search.full_name IS DISTINCT FROM established_name
      OR db_search.criteria IS DISTINCT FROM case_criteria
      OR db_search.status IS DISTINCT FROM 'active'
      OR db_search.frequency IS DISTINCT FROM 'daily'
      OR db_search.email_consent_at IS NULL THEN
      RAISE EXCEPTION 'Saved-search contact or alert context is incorrect for %', case_row.case_name;
    END IF;

    IF case_row.ordinal = 1 THEN
      SELECT count(*) INTO activity_count_before FROM public.crm_activities WHERE lead_id = target_lead_id;
      -- A replay must retain the recorded active state, even if the caller's
      -- current IDX flag differs. It must not append another timeline event.
      pending_result := public.capture_saved_search(
        'Website visitor', case_email, NULL, 'daily', false, case_criteria, false
      );
      IF pending_result IS DISTINCT FROM false
        OR (SELECT count(*) FROM public.saved_searches WHERE email = case_email) <> 1
        OR (SELECT count(*) FROM public.crm_leads WHERE email = case_email) <> 1
        OR (SELECT count(*) FROM public.crm_activities WHERE lead_id = target_lead_id) <> activity_count_before THEN
        RAISE EXCEPTION 'Active duplicate search was not suppressed';
      END IF;
    END IF;
  END LOOP;

  -- Missing names remain optional for new contacts, with a nonblank display
  -- fallback in BOTH tables. Alternate IDX flags exercise both return values.
  FOR case_row IN
    SELECT * FROM (VALUES
      (1, 'legacy', 'Website visitor'::text),
      (2, 'null', NULL::text),
      (3, 'empty', ''::text),
      (4, 'spaces', '    '::text),
      (5, 'tabs-newlines', E'\t\n'::text),
      (6, 'mixed-whitespace', E' \t\r\n '::text)
    ) AS cases(ordinal, case_name, supplied_name)
    ORDER BY ordinal
  LOOP
    case_email := 'ss-names-' || run_tag || '-new-' || case_row.case_name || '@example.invalid';
    case_criteria := jsonb_build_object('qaRun', run_tag, 'qaCase', 'new-' || case_row.case_name);
    idx_enabled := case_row.ordinal % 2 = 0;
    pending_result := public.capture_saved_search(
      case_row.supplied_name, case_email, NULL, 'weekly', false, case_criteria, idx_enabled
    );
    SELECT * INTO STRICT db_lead FROM public.crm_leads WHERE email = case_email;
    SELECT * INTO STRICT db_search FROM public.saved_searches WHERE email = case_email;
    IF db_lead.full_name IS DISTINCT FROM 'Website visitor'
      OR db_search.full_name IS DISTINCT FROM 'Website visitor'
      OR db_search.lead_id IS DISTINCT FROM db_lead.id
      OR db_lead.source IS DISTINCT FROM 'saved-search'
      OR db_lead.form_name IS DISTINCT FROM 'saved-search-alert'
      OR db_lead.consent IS DISTINCT FROM true
      OR db_search.criteria IS DISTINCT FROM case_criteria THEN
      RAISE EXCEPTION 'New contact fallback or linkage failed for %', case_row.case_name;
    END IF;
    IF pending_result IS DISTINCT FROM (NOT idx_enabled)
      OR db_search.status IS DISTINCT FROM (CASE WHEN idx_enabled THEN 'active' ELSE 'pending_idx' END) THEN
      RAISE EXCEPTION 'Active/pending contract changed for %', case_row.case_name;
    END IF;
    IF case_row.ordinal = 1 THEN
      SELECT count(*) INTO activity_count_before FROM public.crm_activities WHERE lead_id = db_lead.id;
      pending_result := public.capture_saved_search(
        NULL, case_email, NULL, 'weekly', false, case_criteria, true
      );
      IF pending_result IS DISTINCT FROM true
        OR (SELECT count(*) FROM public.saved_searches WHERE email = case_email) <> 1
        OR (SELECT count(*) FROM public.crm_leads WHERE email = case_email) <> 1
        OR (SELECT count(*) FROM public.crm_activities WHERE lead_id = db_lead.id) <> activity_count_before THEN
        RAISE EXCEPTION 'Pending duplicate search was not suppressed';
      END IF;
    END IF;
  END LOOP;

  -- A real supplied name replaces a placeholder after all surrounding
  -- whitespace is trimmed. Missing phone retains the existing contact phone.
  case_email := 'ss-names-' || run_tag || '-supplied-name@example.invalid';
  INSERT INTO public.crm_leads
    (full_name, email, phone, source, form_name, next_follow_up_at)
  VALUES
    ('Website visitor', case_email, '(202) 555-0101', 'qa-regression', 'qa-name-test', now() + interval '6 hours')
  RETURNING id INTO target_lead_id;
  pending_result := public.capture_saved_search(
    E' \tAvery Example\r\n ', case_email, NULL, 'daily', false,
    jsonb_build_object('qaRun', run_tag, 'qaCase', 'supplied-name'), false
  );
  SELECT * INTO STRICT db_lead FROM public.crm_leads WHERE id = target_lead_id;
  SELECT * INTO STRICT db_search FROM public.saved_searches WHERE email = case_email;
  IF db_lead.full_name IS DISTINCT FROM 'Avery Example'
    OR db_search.full_name IS DISTINCT FROM 'Avery Example'
    OR db_search.lead_id IS DISTINCT FROM target_lead_id
    OR db_lead.phone IS DISTINCT FROM '(202) 555-0101'
    OR db_lead.next_follow_up_at IS DISTINCT FROM now() + interval '1 hour'
    OR pending_result IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Supplied trimmed name or existing contact follow-up behavior failed';
  END IF;

  -- Preserve the existing rule that the newest matching contact owns the
  -- subscription; do not overwrite the older contact with the same email.
  case_email := 'ss-names-' || run_tag || '-newest@example.invalid';
  INSERT INTO public.crm_leads(full_name, email, source, form_name, created_at)
  VALUES ('Older Known Client', case_email, 'qa-regression', 'qa-name-test', now() - interval '2 days')
  RETURNING id INTO older_lead_id;
  INSERT INTO public.crm_leads(full_name, email, source, form_name, created_at)
  VALUES ('Newest Known Client', case_email, 'qa-regression', 'qa-name-test', now() - interval '1 day')
  RETURNING id INTO target_lead_id;
  PERFORM public.capture_saved_search(
    NULL, case_email, NULL, 'daily', false,
    jsonb_build_object('qaRun', run_tag, 'qaCase', 'newest'), true
  );
  SELECT * INTO STRICT db_search FROM public.saved_searches WHERE email = case_email;
  IF db_search.lead_id IS DISTINCT FROM target_lead_id
    OR db_search.full_name IS DISTINCT FROM 'Newest Known Client'
    OR (SELECT full_name FROM public.crm_leads WHERE id = older_lead_id) IS DISTINCT FROM 'Older Known Client' THEN
    RAISE EXCEPTION 'Newest matching contact selection changed';
  END IF;

  -- Name length is measured after trimming: 120 characters are allowed.
  case_email := 'ss-names-' || run_tag || '-length120@example.invalid';
  pending_result := public.capture_saved_search(
    E' \t' || repeat('N', 120) || E'\n ', case_email, NULL, 'daily', false,
    jsonb_build_object('qaRun', run_tag, 'qaCase', 'length120'), true
  );
  SELECT * INTO STRICT db_lead FROM public.crm_leads WHERE email = case_email;
  SELECT * INTO STRICT db_search FROM public.saved_searches WHERE email = case_email;
  IF db_lead.full_name IS DISTINCT FROM repeat('N', 120)
    OR db_search.full_name IS DISTINCT FROM repeat('N', 120)
    OR db_search.lead_id IS DISTINCT FROM db_lead.id
    OR pending_result IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'A valid trimmed 120-character name was not preserved';
  END IF;

  -- An overlong name must reject with the established validation SQLSTATE and
  -- leave no partial subscription/contact changes, for new AND existing leads.
  FOR case_row IN SELECT * FROM (VALUES (false), (true)) AS cases(has_existing_lead)
  LOOP
    case_email := 'ss-names-' || run_tag || '-length121-' || case_row.has_existing_lead::text || '@example.invalid';
    target_lead_id := NULL;
    IF case_row.has_existing_lead THEN
      INSERT INTO public.crm_leads(full_name, email, phone, source, form_name, next_follow_up_at)
      VALUES ('Keep This Name', case_email, '(202) 555-0102', 'qa-regression', 'qa-name-test', earlier_follow_up)
      RETURNING id INTO target_lead_id;
      SELECT count(*) INTO activity_count_before FROM public.crm_activities WHERE lead_id = target_lead_id;
    END IF;
    rejected := false;
    BEGIN
      PERFORM public.capture_saved_search(
        repeat('N', 121), case_email, '(202) 555-0199', 'daily', false,
        jsonb_build_object('qaRun', run_tag, 'qaCase', 'length121'), true
      );
    EXCEPTION WHEN SQLSTATE '22023' THEN
      IF SQLERRM <> 'Invalid saved-search name.' THEN
        RAISE EXCEPTION 'Overlong name failed for an unexpected validation reason: %', SQLERRM;
      END IF;
      rejected := true;
    END;
    IF NOT rejected OR EXISTS (SELECT 1 FROM public.saved_searches WHERE email = case_email) THEN
      RAISE EXCEPTION 'Overlong name was accepted or left a saved-search row';
    END IF;
    IF case_row.has_existing_lead THEN
      SELECT * INTO STRICT db_lead FROM public.crm_leads WHERE id = target_lead_id;
      IF db_lead.full_name IS DISTINCT FROM 'Keep This Name'
        OR db_lead.phone IS DISTINCT FROM '(202) 555-0102'
        OR db_lead.next_follow_up_at IS DISTINCT FROM earlier_follow_up
        OR (SELECT count(*) FROM public.crm_leads WHERE email = case_email) <> 1
        OR (SELECT count(*) FROM public.crm_activities WHERE lead_id = target_lead_id) <> activity_count_before THEN
        RAISE EXCEPTION 'Rejected name partially changed an existing contact';
      END IF;
    ELSIF EXISTS (SELECT 1 FROM public.crm_leads WHERE email = case_email) THEN
      RAISE EXCEPTION 'Rejected name left a new CRM lead';
    END IF;
  END LOOP;

  RAISE NOTICE 'PASS: saved-search contact names, linkage, duplicate handling, validation, and return contract; fixture rows will roll back.';
END;
$regression$;

ROLLBACK;
