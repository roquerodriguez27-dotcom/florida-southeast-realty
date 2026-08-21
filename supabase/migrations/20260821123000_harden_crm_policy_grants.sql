drop policy if exists "deny direct crm lead access" on public.crm_leads;
drop policy if exists "deny direct crm activity access" on public.crm_activities;
drop policy if exists "deny direct crm task access" on public.crm_tasks;
drop policy if exists "deny direct saved search access" on public.saved_searches;

drop policy if exists "no direct crm admin access" on crm_private.crm_admins;
create policy "no direct crm admin access"
on crm_private.crm_admins for all to public
using (false)
with check (false);

revoke execute on function public.capture_crm_lead(text, text, text, text, text, text, jsonb, boolean) from authenticated;
revoke execute on function public.capture_saved_search(text, text, text, text, boolean, jsonb, boolean) from authenticated;
