-- Match the existing compact inquiry UI: email OR phone is sufficient only for
-- property-inquiry and buyer-tools-review. Other forms still require email.
-- CREATE OR REPLACE preserves the existing validated write-only RPC privileges.
create or replace function public.capture_crm_lead(
  p_full_name text,
  p_email text,
  p_phone text,
  p_form_name text,
  p_property_interest text,
  p_message text,
  p_fields jsonb,
  p_consent boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_name text := btrim(coalesce(p_full_name, ''));
  clean_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  clean_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  clean_form_name text := btrim(coalesce(p_form_name, ''));
  clean_fields jsonb := coalesce(p_fields, '{}'::jsonb);
  -- Ignore presentation punctuation but retain extension text. Do not infer
  -- country codes or merge a main number with a different extension.
  phone_identity text := regexp_replace(lower(coalesce(clean_phone, '')), '[[:space:]().+-]', '', 'g');
  existing_lead_id bigint;
begin
  if clean_name = '' or char_length(clean_name) > 120 then
    raise exception 'Invalid lead name.' using errcode = '22023';
  end if;
  if clean_email is not null and (
    char_length(clean_email) > 254
    or clean_email !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
  ) then
    raise exception 'Invalid lead email.' using errcode = '22023';
  end if;
  if clean_phone is not null and char_length(clean_phone) > 40 then
    raise exception 'Invalid lead phone.' using errcode = '22023';
  end if;
  if clean_form_name = '' or char_length(clean_form_name) > 100 then
    raise exception 'Invalid form name.' using errcode = '22023';
  end if;
  if clean_email is null then
    if clean_form_name not in ('property-inquiry', 'buyer-tools-review') then
      raise exception 'Invalid lead email.' using errcode = '22023';
    end if;
    -- Keep telephone input permissive: international formatting and extensions
    -- remain allowed, but empty/punctuation-only/very short values cannot be
    -- the only way for the brokerage to contact the visitor.
    if clean_phone is null
      or char_length(regexp_replace(clean_phone, '[^0-9]', '', 'g')) < 7 then
      raise exception 'Invalid lead phone.' using errcode = '22023';
    end if;
  end if;
  if not coalesce(p_consent, false) then
    raise exception 'Contact consent is required.' using errcode = '22023';
  end if;
  if jsonb_typeof(clean_fields) <> 'object'
    or octet_length(clean_fields::text) > 32768
    or (select count(*) from jsonb_object_keys(clean_fields)) > 40
    or exists (select 1 from jsonb_each(clean_fields) where jsonb_typeof(value) <> 'string') then
    raise exception 'Invalid lead fields.' using errcode = '22023';
  end if;
  if char_length(coalesce(p_property_interest, '')) > 5000
    or char_length(coalesce(p_message, '')) > 5000 then
    raise exception 'Lead details are too long.' using errcode = '22023';
  end if;

  select id into existing_lead_id
  from public.crm_leads
  where form_name = clean_form_name
    and created_at > now() - interval '2 minutes'
    and (
      -- Preserve the existing email-submission duplicate check.
      (clean_email is not null and lower(email) = clean_email and fields = clean_fields)
      or (
        clean_email is null
        and nullif(btrim(email), '') is null
        and regexp_replace(lower(coalesce(phone, '')), '[[:space:]().+-]', '', 'g') = phone_identity
        and full_name = clean_name
        and property_interest is not distinct from nullif(btrim(coalesce(p_property_interest, '')), '')
        and message is not distinct from nullif(btrim(coalesce(p_message, '')), '')
        and (fields - 'email' - 'phone' - 'telephone') = (clean_fields - 'email' - 'phone' - 'telephone')
      )
    )
  order by created_at desc
  limit 1;

  if existing_lead_id is not null then
    return true;
  end if;

  insert into public.crm_leads (
    full_name, email, phone, source, form_name, property_interest, message,
    consent, fields
  ) values (
    clean_name, clean_email, clean_phone, 'website', clean_form_name,
    nullif(btrim(coalesce(p_property_interest, '')), ''),
    nullif(btrim(coalesce(p_message, '')), ''), true, clean_fields
  );

  return true;
end;
$$;
