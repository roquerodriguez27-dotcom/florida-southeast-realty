-- Preserve an established CRM name when a saved-search signup omits one.
-- Keep the existing RPC signature and privileges. Handle the legacy display
-- placeholder as an omitted name so this is safe before the API rollout.
-- RETURNING uses the name held by the row at update time for the subscription.

CREATE OR REPLACE FUNCTION public.capture_saved_search(p_full_name text, p_email text, p_phone text, p_frequency text, p_sms_consent boolean, p_criteria jsonb, p_idx_active boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  clean_name text := nullif(regexp_replace(coalesce(p_full_name, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g'), '');
  clean_email text := lower(btrim(coalesce(p_email, '')));
  clean_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  clean_criteria jsonb := coalesce(p_criteria, '{}'::jsonb);
  lead_id_value bigint;
  duplicate_status text;
  saved_status text := case when coalesce(p_idx_active, false) then 'active' else 'pending_idx' end;
  created_lead boolean := false;
begin
  if char_length(clean_name) > 120 then
    raise exception 'Invalid saved-search name.' using errcode = '22023';
  end if;
  -- Older deployed clients supplied this display fallback instead of no name.
  if clean_name = 'Website visitor' then
    clean_name := null;
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
    clean_name := coalesce(clean_name, 'Website visitor');
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
    set full_name = coalesce(clean_name, full_name),
        phone = coalesce(clean_phone, phone),
        next_follow_up_at = case
          when next_follow_up_at is null or next_follow_up_at > now() + interval '1 hour'
            then now() + interval '1 hour'
          else next_follow_up_at
        end
    where id = lead_id_value
    returning full_name into clean_name;
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
$function$;
