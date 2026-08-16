create table if not exists public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  lead_id bigint references public.crm_leads(id) on delete set null,
  full_name text not null,
  email text not null,
  phone text,
  criteria jsonb not null default '{}'::jsonb,
  frequency text not null default 'daily' check (frequency in ('instant', 'daily', 'weekly')),
  alert_new_matches boolean not null default true,
  alert_price_changes boolean not null default true,
  alert_back_on_market boolean not null default true,
  email_consent_at timestamptz not null default now(),
  sms_consent_at timestamptz,
  status text not null default 'pending_idx' check (status in ('pending_idx', 'active', 'paused', 'unsubscribed')),
  last_evaluated_at timestamptz,
  last_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists saved_searches_status_frequency_idx on public.saved_searches (status, frequency);
create index if not exists saved_searches_email_idx on public.saved_searches (lower(email));
create index if not exists saved_searches_lead_id_idx on public.saved_searches (lead_id);

alter table public.saved_searches enable row level security;
revoke all on public.saved_searches from anon, authenticated;

create policy "deny direct saved search access"
on public.saved_searches for all to anon, authenticated
using (false) with check (false);

comment on table public.saved_searches is 'Private saved property criteria and notification preferences. Written through server-only endpoints and activated after IDX approval.';
