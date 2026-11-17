import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { createFollowUpDraft } from "@/lib/crm/follow-up-draft";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const claimSchema = z.object({
  claimed: z.literal(true),
  id: z.uuid(),
  generation_token: z.uuid(),
  source_snapshot: z.object({
    full_name: z.string().nullish(),
    form_name: z.string(),
    property_interest: z.string().nullish(),
    message: z.string().nullish(),
    fields: z.record(z.string(), z.unknown()).nullish(),
  }),
});

function response(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/** Private scheduler: generate at most one draft, with no email-sending capability. */
export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer ([^\s]{20,256})$/)?.[1];
  if (!token) return response({ ok: false, reason: "unauthorized" }, 401);
  let supabase: ReturnType<typeof createSupabasePublicClient>;
  let claimed: unknown;
  try {
    supabase = createSupabasePublicClient();
    const { data, error } = await supabase.rpc("claim_followup_draft", { p_token: token });
    if (error) return response({ ok: false, reason: error.code === "28000" ? "unauthorized" : "queue_unavailable" }, error.code === "28000" ? 401 : 503);
    if (data?.claimed === false) return response({ ok: true, drafted: 0, reason: data.reason === "daily_limit" ? "daily_limit" : "no_pending_inquiries" });
    claimed = data;
  } catch {
    return response({ ok: false, reason: "queue_unavailable" }, 503);
  }
  const parsed = claimSchema.safeParse(claimed);
  if (!parsed.success) return response({ ok: false, reason: "invalid_queue_response" }, 503);
  const claim = parsed.data;
  try {
    const draft = await createFollowUpDraft({
      name: claim.source_snapshot.full_name,
      formName: claim.source_snapshot.form_name,
      propertyInterest: claim.source_snapshot.property_interest,
      message: claim.source_snapshot.message,
      fields: claim.source_snapshot.fields,
    });
    const completed = await supabase.rpc("complete_followup_draft", {
      p_token: token,
      p_id: claim.id,
      p_generation_token: claim.generation_token,
      p_subject: draft.subject,
      p_body: draft.body,
      p_mode: draft.generationMode,
      p_model: draft.generationMode === "ai" ? process.env.AI_FOLLOW_UP_MODEL?.trim() || "openai/gpt-5-mini" : null,
    });
    if (completed.error) throw new Error("draft_persistence_failed");
    if (completed.data?.ok !== true) return response({ ok: true, drafted: 0, reason: "inquiry_changed" });
    return response({ ok: true, drafted: 1, mode: draft.generationMode });
  } catch {
    try {
      await supabase.rpc("fail_followup_draft", {
        p_token: token,
        p_id: claim.id,
        p_generation_token: claim.generation_token,
        p_error: "draft_persistence_failed",
      });
    } catch {
      // The generation lease expires safely; do not make another model call.
    }
    return response({ ok: false, reason: "draft_unavailable" }, 503);
  }
}
