"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCrmBroker, requireCrmUser } from "@/lib/crm/auth";
import { CRM_STATUSES } from "@/lib/crm/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CONTACT_CHANNELS, CONTACT_OUTCOMES, outcomeBody } from "@/lib/crm/outcomes";

const idSchema = z.coerce.number().int().positive();
const emailSchema = z.email().max(254).transform((value) => value.trim().toLowerCase());

export async function updateLead(formData: FormData) {
  const user = await requireCrmUser();
  const id = idSchema.parse(formData.get("leadId"));
  const status = z.enum(CRM_STATUSES).parse(formData.get("status"));
  const priority = z.enum(["low", "normal", "high", "urgent"]).parse(formData.get("priority"));
  const followUpValue = String(formData.get("nextFollowUp") ?? "").trim();
  const followUpAt = followUpValue ? new Date(followUpValue) : null;
  if (followUpAt && Number.isNaN(followUpAt.getTime())) throw new Error("Invalid follow-up date.");
  const supabase = await createSupabaseServerClient();
  const { data: previous, error: readError } = await supabase.from("crm_leads").select("status,assigned_to").eq("id", id).single();
  if (readError) throw readError;
  let assignedTo = previous.assigned_to as string | null;
  if (user.role === "broker" && formData.has("assignedTo")) {
    const requestedAssignee = emailSchema.parse(formData.get("assignedTo"));
    const { data: teamMember, error: teamError } = await supabase
      .from("crm_users")
      .select("email")
      .eq("email", requestedAssignee)
      .eq("active", true)
      .single();
    if (teamError || !teamMember) throw new Error("The selected agent is not active.");
    assignedTo = teamMember.email;
  }
  const { error } = await supabase.from("crm_leads").update({
    status,
    priority,
    assigned_to: assignedTo,
    next_follow_up_at: followUpAt?.toISOString() ?? null,
    updated_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) throw error;
  if (previous.status !== status) {
    const { error: activityError } = await supabase.from("crm_activities").insert({ lead_id: id, kind: "status_change", body: `Status changed from ${previous.status} to ${status}.`, created_by: user.email });
    if (activityError) throw activityError;
  }
  if (previous.assigned_to !== assignedTo) {
    const { error: assignmentError } = await supabase.from("crm_activities").insert({
      lead_id: id,
      kind: "system",
      body: `Lead assigned to ${assignedTo}.`,
      created_by: user.email,
    });
    if (assignmentError) throw assignmentError;
  }
  revalidatePath("/crm");
  revalidatePath("/crm/outcomes");
}

export async function recordContactOutcome(formData: FormData) {
  const user = await requireCrmUser();
  const leadId = idSchema.parse(formData.get("leadId"));
  const outcome = z.enum(CONTACT_OUTCOMES).parse(formData.get("outcome"));
  const channel = z.enum(CONTACT_CHANNELS).parse(formData.get("channel"));
  const note = z.string().trim().max(1500).parse(formData.get("note") ?? "");
  if (formData.get("confirmed") !== "yes") throw new Error("Confirm the outcome actually occurred before recording it.");
  const supabase = await createSupabaseServerClient();
  const { data: lead, error: readError } = await supabase.from("crm_leads").select("id").eq("id", leadId).single();
  if (readError || !lead) throw new Error("This lead is unavailable to your account.");
  const { error: activityError } = await supabase.from("crm_activities").insert({
    lead_id: leadId, kind: channel, body: outcomeBody(outcome, channel, note), created_by: user.email,
  });
  if (activityError) throw activityError;
  if (outcome === "conversation" || outcome === "appointment_held") {
    const { data: updated, error } = await supabase.from("crm_leads")
      .update({ last_contacted_at: new Date().toISOString() }).eq("id", leadId).select("id").single();
    if (error || !updated) throw new Error("The activity was recorded, but the lead contact date could not be updated. Refresh the lead before retrying.");
  }
  revalidatePath("/crm");
  revalidatePath("/crm/outcomes");
}

export async function addNote(formData: FormData) {
  const user = await requireCrmUser();
  const leadId = idSchema.parse(formData.get("leadId"));
  const body = z.string().trim().min(1).max(5000).parse(formData.get("body"));
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("crm_activities").insert({ lead_id: leadId, kind: "note", body, created_by: user.email });
  if (error) throw error;
  revalidatePath("/crm");
}

export async function addTask(formData: FormData) {
  const user = await requireCrmUser();
  const leadId = idSchema.parse(formData.get("leadId"));
  const title = z.string().trim().min(1).max(300).parse(formData.get("title"));
  const dueValue = String(formData.get("dueAt") ?? "").trim();
  const dueAt = dueValue ? new Date(dueValue) : null;
  if (dueAt && Number.isNaN(dueAt.getTime())) throw new Error("Invalid task date.");
  const supabase = await createSupabaseServerClient();
  const { data: lead, error: leadError } = await supabase.from("crm_leads").select("assigned_to").eq("id", leadId).single();
  if (leadError) throw leadError;
  const { error } = await supabase.from("crm_tasks").insert({ lead_id: leadId, title, due_at: dueAt?.toISOString() ?? null, assigned_to: lead.assigned_to ?? user.email, created_by: user.email });
  if (error) throw error;
  revalidatePath("/crm");
}

export async function completeTask(formData: FormData) {
  const user = await requireCrmUser();
  const id = idSchema.parse(formData.get("taskId"));
  const supabase = await createSupabaseServerClient();
  const { data: task, error: readError } = await supabase.from("crm_tasks").select("lead_id,title,completed_at,automation_key,due_at").eq("id", id).single();
  if (readError) throw readError;
  if (task.completed_at) return;
  if (String(formData.get("expectedDueAt") ?? "") !== (task.due_at ?? "")) {
    revalidatePath("/crm");
    return; // A stale screen must not close a reminder that has been rescheduled.
  }
  const completedAt = new Date().toISOString();
  let completion = supabase.from("crm_tasks").update({ completed_at: completedAt }).eq("id", id).is("completed_at", null);
  completion = task.due_at ? completion.eq("due_at", task.due_at) : completion.is("due_at", null);
  const { data: completed, error } = await completion.select("id");
  if (error) throw error;
  if (!completed?.length) return;
  if (task.lead_id) {
    // Completing a reminder says nothing about whether a client replied.
    // Only clear its matching schedule; a newer follow-up date must survive.
    if (task.automation_key === "lead_follow_up" && task.due_at) {
      const { error: scheduleError } = await supabase.from("crm_leads")
        .update({ next_follow_up_at: null }).eq("id", task.lead_id).eq("next_follow_up_at", task.due_at);
      if (scheduleError) throw scheduleError;
    }
    const { error: activityError } = await supabase.from("crm_activities").insert({ lead_id: task.lead_id, kind: "system", body: `Completed task: ${task.title}`, created_by: user.email });
    if (activityError) throw activityError;
  }
  revalidatePath("/crm");
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/crm/login");
}

export async function addCrmTeamMember(formData: FormData) {
  const broker = await requireCrmBroker();
  const displayName = z.string().trim().min(1).max(120).parse(formData.get("displayName"));
  const email = emailSchema.parse(formData.get("email"));
  if (email === broker.email) throw new Error("Your broker account is already active.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("crm_users").upsert({
    email,
    display_name: displayName,
    role: "agent",
    active: true,
    invited_by: broker.email,
  }, { onConflict: "email" });
  if (error) throw error;
  revalidatePath("/crm");
}

export async function setCrmTeamMemberActive(formData: FormData) {
  const broker = await requireCrmBroker();
  const email = emailSchema.parse(formData.get("email"));
  const active = z.enum(["true", "false"]).parse(formData.get("active")) === "true";
  if (email === broker.email) throw new Error("The signed-in broker account cannot be deactivated.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("crm_users").update({ active }).eq("email", email).eq("role", "agent");
  if (error) throw error;
  revalidatePath("/crm");
}
