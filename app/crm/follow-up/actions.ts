"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCrmBroker } from "@/lib/crm/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { followUpEmailConfigured, sendApprovedFollowUp } from "@/lib/crm/follow-up-email";
import { sendBrokerListingAlertTest } from "@/lib/crm/test-listing-alert";

const reference = z.object({ id: z.uuid(), version: z.coerce.number().int().min(1).max(1_000_000) });
const editable = reference.extend({
  subject: z.string().trim().min(1).max(160).refine(value => !/[\r\n\u0000-\u001f\u007f]/.test(value)),
  body: z.string().trim().min(1).max(6000).refine(value => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)),
});

function finish(code: string, id?: string): never {
  revalidatePath("/crm/follow-up");
  revalidatePath("/crm");
  const params = new URLSearchParams({ notice: code });
  if (id) params.set("id", id);
  redirect(`/crm/follow-up?${params}`);
}

export async function saveFollowUp(form: FormData) {
  await requireCrmBroker();
  const parsed = editable.safeParse(Object.fromEntries(form));
  if (!parsed.success) finish("invalid");
  const { id, version, subject, body } = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("edit_followup", {
    p_id: id, p_expected_version: version, p_subject: subject, p_body: body,
  });
  if (error) finish("unavailable", id);
  finish(data?.ok === true ? "saved" : "changed", id);
}

export async function approveAndSendFollowUp(form: FormData) {
  await requireCrmBroker();
  const parsed = reference.safeParse(Object.fromEntries(form));
  if (!parsed.success || form.get("approved") !== "yes") finish("approval_required");
  const { id, version } = parsed.data;
  if (!followUpEmailConfigured()) finish("email_unavailable", id);
  const supabase = await createSupabaseServerClient();
  // The database rechecks the broker, consent, current email and exact draft
  // version under a row lock. No recipient or message comes from this form.
  const prepared = await supabase.rpc("prepare_followup_send", { p_id: id, p_expected_version: version });
  if (prepared.error) finish("unavailable", id);
  if (prepared.data?.ok !== true) finish("changed", id);
  const result = await sendApprovedFollowUp(prepared.data);
  let recordedOk = false;
  try {
    const recorded = await supabase.rpc("record_followup_send_result", {
      p_id: id,
      p_send_attempt_token: prepared.data.send_attempt_token,
      p_outcome: result.outcome,
      p_provider_message_id: result.providerMessageId,
      p_error: result.errorCode,
    });
    recordedOk = !recorded.error && recorded.data?.ok === true;
  } catch {
    // An accepted email may already be on its way. Never submit it again.
  }
  // Losing the database acknowledgement must never encourage another send.
  if (!recordedOk) finish("send_check_required", id);
  finish(result.outcome === "accepted" ? "accepted" : result.outcome === "rejected" ? "rejected" : "send_check_required", id);
}

export async function stopFollowUp(form: FormData) {
  await requireCrmBroker();
  const parsed = z.object({
    id: z.uuid(),
    reason: z.enum(["reply_received", "do_not_contact", "not_relevant"]),
  }).safeParse(Object.fromEntries(form));
  if (!parsed.success) finish("invalid");
  const { id, reason } = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("pause_or_stop_followup", {
    p_id: id, p_reason: reason, p_stop: reason !== "reply_received",
  });
  if (error || data?.ok !== true) finish("unavailable", id);
  finish(reason === "do_not_contact" ? "suppressed" : "stopped", id);
}

export async function createFollowUpTest() {
  await requireCrmBroker();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_followup_test");
  if (error || data?.ok !== true || !z.uuid().safeParse(data.id).success) finish("unavailable");
  finish("test_queued", data.id);
}

export async function sendListingAlertTest() {
  const broker = await requireCrmBroker();
  const result = await sendBrokerListingAlertTest({ brokerEmail: broker.email });
  finish(result.accepted ? "alert_test_accepted" : result.alreadyRequested ? "alert_test_already_requested" : "alert_test_unavailable");
}
