import "server-only";

import { z } from "zod";
import { SITE, SITE_ADDRESS_LINE } from "@/lib/site-config";

const sendSchema = z.object({
  id: z.uuid(),
  send_attempt_token: z.uuid(),
  idempotency_key: z.string().min(8).max(200).regex(/^[a-zA-Z0-9_./-]+$/),
  recipient: z.email().max(254),
  subject: z.string().trim().min(1).max(160).refine(value => !/[\r\n\u0000-\u001f\u007f]/.test(value)),
  body: z.string().trim().min(1).max(6000).refine(value => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)),
  unsubscribe_token: z.uuid(),
  test_mode: z.boolean(),
});

export type PreparedFollowUpSend = z.infer<typeof sendSchema>;
export type FollowUpSendResult = {
  outcome: "accepted" | "rejected" | "unknown";
  providerMessageId: string | null;
  errorCode: string | null;
};

export function followUpEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

/** A single approved, immutable send. There is deliberately no retry loop. */
export async function sendApprovedFollowUp(value: unknown): Promise<FollowUpSendResult> {
  const parsed = sendSchema.safeParse(value);
  if (!parsed.success) return { outcome: "rejected", providerMessageId: null, errorCode: "invalid_send_payload" };
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return { outcome: "rejected", providerMessageId: null, errorCode: "email_not_configured" };
  const send = parsed.data;
  const unsubscribe = new URL("/follow-up/unsubscribe", SITE.url);
  unsubscribe.searchParams.set("token", send.unsubscribe_token);
  const from = process.env.RESEND_FROM_EMAIL?.trim()
    || `Florida Southeast Realty <website@${new URL(SITE.url).hostname.replace(/^www\./, "")}>`;
  const subject = send.test_mode ? `TEST ONLY — ${send.subject}` : send.subject;
  const text = [
    ...(send.test_mode ? ["TEST ONLY — Owner-authorized FSR reply queue verification. This is not a customer inquiry or appointment.", ""] : []),
    send.body,
    "",
    SITE.name,
    SITE_ADDRESS_LINE,
    `${SITE.phoneDisplay} · ${SITE.email}`,
    "",
    `To stop inquiry follow-up emails: ${unsubscribe.toString()}`,
  ].join("\n");

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": send.idempotency_key,
      },
      body: JSON.stringify({ from, to: [send.recipient], reply_to: SITE.email, subject, text }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      // A timeout, conflict or server failure can follow an accepted request.
      // Keep these uncertain; never let a new approval create a second email.
      const rejected = [400, 401, 403, 404, 413, 422].includes(response.status);
      return { outcome: rejected ? "rejected" : "unknown", providerMessageId: null, errorCode: `provider_${response.status}` };
    }
    const result: unknown = await response.json();
    const provider = z.object({ id: z.string().min(1).max(200) }).safeParse(result);
    if (!provider.success) return { outcome: "unknown", providerMessageId: null, errorCode: "provider_missing_receipt" };
    return { outcome: "accepted", providerMessageId: provider.data.id, errorCode: null };
  } catch {
    // Provider errors may contain credentials or message text; never log them.
    return { outcome: "unknown", providerMessageId: null, errorCode: "provider_connection_uncertain" };
  }
}
