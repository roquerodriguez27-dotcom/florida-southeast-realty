create table if not exists public.crm_leads (
  id bigint generated always as identity primary key,
  full_name text not null,
  email text,
  phone text,
  source text not null default 'website',
  form_name text not null,
  status text not null default 'new' check (status in ('new', 'contacted', 'qualified', 'appointment', 'active', 'closed', 'lost')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  property_interest text,
  message text,
  consent boolean not null default false,
  fields jsonb not null default '{}'::jsonb,
  assigned_to text,
  next_follow_up_at timestamptz,
  last_contacted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_activities (
  id bigint generated always as identity primary key,
  lead_id bigint not null references public.crm_leads(id) on delete cascade,
  kind text not null check (kind in ('note', 'call', 'email', 'text', 'meeting', 'status_change', 'system')),
  body text not null,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists public.crm_tasks (
  id bigint generated always as identity primary key,
  lead_id bigint references public.crm_leads(id) on delete cascade,
  title text not null,
  due_at timestamptz,
  completed_at timestamptz,
  assigned_to text,
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists crm_leads_status_created_idx on public.crm_leads (status, created_at desc);
create index if not exists crm_leads_follow_up_idx on public.crm_leads (next_follow_up_at) where next_follow_up_at is not null;
create index if not exists crm_leads_email_idx on public.crm_leads (lower(email)) where email is not null;
create index if not exists crm_activities_lead_created_idx on public.crm_activities (lead_id, created_at desc);
create index if not exists crm_tasks_lead_id_idx on public.crm_tasks (lead_id);
create index if not exists crm_tasks_open_due_idx on public.crm_tasks (due_at) where completed_at is null;

alter table public.crm_leads enable row level security;
alter table public.crm_activities enable row level security;
alter table public.crm_tasks enable row level security;

revoke all on public.crm_leads, public.crm_activities, public.crm_tasks from anon, authenticated;
revoke all on sequence public.crm_leads_id_seq, public.crm_activities_id_seq, public.crm_tasks_id_seq from anon, authenticated;

comment on table public.crm_leads is 'Private brokerage lead records. Accessed only by authenticated CRM server actions.';
comment on table public.crm_activities is 'Private activity timeline for CRM leads.';
comment on table public.crm_tasks is 'Private follow-up tasks associated with CRM leads.';
