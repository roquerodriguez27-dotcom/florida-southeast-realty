import "server-only";

import { createHash } from "node:crypto";
import { SITE } from "@/lib/site-config";

export interface BrokerNotificationPayload {
  kind: "lead" | "saved-search";
  title: string;
  fields: Record<string, string | boolean | undefined>;
  replyTo?: string | null;
}

export interface BrokerNotificationResult {
  configured: boolean;
  delivered: boolean;
}

function recipients(): string[] {
  const configured = process.env.RESEND_TO_EMAIL
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return configured?.length ? configured : [SITE.email];
}

function label(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function notificationText(payload: BrokerNotificationPayload): string {
  const lines = Object.entries(payload.fields)
    .filter(([, value]) => value !== undefined && value !== "")
    .map(([key, value]) => `${label(key)}: ${typeof value === "boolean" ? value ? "Yes" : "No" : value}`);

  return [
    payload.title,
    "",
    ...lines,
    "",
    `Open the private CRM: ${SITE.url}/crm`,
  ].join("\n");
}

export async function sendBrokerNotification(
  payload: BrokerNotificationPayload,
): Promise<BrokerNotificationResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (!apiKey || !from) return { configured: false, delivered: false };

  const safeTitle = payload.title.replace(/[\r\n]+/g, " ").slice(0, 160);
  const idempotencyKey = createHash("sha256")
    .update(JSON.stringify({ kind: payload.kind, fields: payload.fields }))
    .digest("hex");

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `fsre-${payload.kind}-${idempotencyKey}`,
      },
      body: JSON.stringify({
        from,
        to: recipients(),
        subject: `${safeTitle} — ${SITE.shortName}`,
        text: notificationText(payload),
        ...(payload.replyTo ? { reply_to: payload.replyTo } : {}),
      }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      console.error("[broker-notification:delivery-error]", { status: response.status, kind: payload.kind });
      return { configured: true, delivered: false };
    }
    return { configured: true, delivered: true };
  } catch (error) {
    console.error("[broker-notification:delivery-error]", {
      error: error instanceof Error ? error.name : "unknown",
      kind: payload.kind,
    });
    return { configured: true, delivered: false };
  }
}
