create policy "deny direct crm lead access"
on public.crm_leads for all to anon, authenticated
using (false) with check (false);

create policy "deny direct crm activity access"
on public.crm_activities for all to anon, authenticated
using (false) with check (false);

create policy "deny direct crm task access"
on public.crm_tasks for all to anon, authenticated
using (false) with check (false);
