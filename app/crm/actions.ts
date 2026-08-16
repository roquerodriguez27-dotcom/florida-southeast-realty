"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCrmUser } from "@/lib/crm/auth";
import { CRM_STATUSES } from "@/lib/crm/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const idSchema = z.coerce.number().int().positive();

export async function updateLead(formData: FormData) {
  const user = await requireCrmUser();
  const id = idSchema.parse(formData.get("leadId"));
  const status = z.enum(CRM_STATUSES).parse(formData.get("status"));
  const priority = z.enum(["low", "normal", "high", "urgent"]).parse(formData.get("priority"));
  const followUpValue = String(formData.get("nextFollowUp") ?? "").trim();
  const supabase = createSupabaseAdminClient();
  const { data: previous, error: readError } = await supabase.from("crm_leads").select("status").eq("id", id).single();
  if (readError) throw readError;
  const { error } = await supabase.from("crm_leads").update({
    status,
    priority,
    next_follow_up_at: followUpValue ? new Date(followUpValue).toISOString() : null,
    updated_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) throw error;
  if (previous.status !== status) await supabase.from("crm_activities").insert({ lead_id: id, kind: "status_change", body: `Status changed from ${previous.status} to ${status}.`, created_by: user.email });
  revalidatePath("/crm");
}

export async function addNote(formData: FormData) {
  const user = await requireCrmUser();
  const leadId = idSchema.parse(formData.get("leadId"));
  const body = z.string().trim().min(1).max(5000).parse(formData.get("body"));
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("crm_activities").insert({ lead_id: leadId, kind: "note", body, created_by: user.email });
  if (error) throw error;
  revalidatePath("/crm");
}

export async function addTask(formData: FormData) {
  const user = await requireCrmUser();
  const leadId = idSchema.parse(formData.get("leadId"));
  const title = z.string().trim().min(1).max(300).parse(formData.get("title"));
  const dueValue = String(formData.get("dueAt") ?? "").trim();
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("crm_tasks").insert({ lead_id: leadId, title, due_at: dueValue ? new Date(dueValue).toISOString() : null, assigned_to: user.email, created_by: user.email });
  if (error) throw error;
  revalidatePath("/crm");
}

export async function completeTask(formData: FormData) {
  await requireCrmUser();
  const id = idSchema.parse(formData.get("taskId"));
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("crm_tasks").update({ completed_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
  revalidatePath("/crm");
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/crm/login");
}
