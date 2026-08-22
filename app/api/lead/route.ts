import { NextResponse } from "next/server";
import { readSameOriginJson } from "@/lib/api/request";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { sendBrokerNotification } from "@/lib/broker-notification";
import { z } from "zod";

/**
 * Lead delivery seam
 * ---------------------------------------------------------------
 * Every valid inquiry is first written to the private Supabase CRM.
 * Broker email delivery is then attempted separately so the response can
 * report CRM storage and notification delivery truthfully.
 *
 * RESEND_API_KEY enables broker notification emails. RESEND_FROM_EMAIL may
 * override the website@ brokerage-domain sender, and RESEND_TO_EMAIL defaults
 * to the brokerage email in site-config. An optional
 * LEAD_WEBHOOK_URL may also mirror the inquiry to another authorized system.
 *
 * Add real reCAPTCHA/hCaptcha verification here before going live —
 * the honeypot field below only filters unsophisticated bots.
 */

const leadSchema = z.object({
  formName: z.string().trim().min(1).max(100),
  honeypot: z.string().max(500).optional(),
  fields: z.record(z.string(), z.string().max(5000)).refine((fields) => Object.keys(fields).length <= 40),
});

function first(fields: Record<string, string>, names: string[]) {
  for (const name of names) if (fields[name]?.trim()) return fields[name].trim();
  return null;
}

async function sendLeadWebhook(formName: string, fields: Record<string, string>) {
  const webhookUrl = process.env.LEAD_WEBHOOK_URL?.trim();
  if (!webhookUrl) return { configured: false, delivered: false };

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ form: formName, ...fields, receivedAt: new Date().toISOString() }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`Webhook responded ${response.status}`);
    return { configured: true, delivered: true };
  } catch (error) {
    console.error("[lead:webhook-delivery-error]", {
      error: error instanceof Error ? error.name : "unknown",
    });
    return { configured: true, delivered: false };
  }
}

export async function POST(req: Request) {
  const body = await readSameOriginJson(req);
  if (!body.ok) {
    return NextResponse.json({ delivered: false, reason: body.reason }, { status: body.status });
  }

  let payload: z.infer<typeof leadSchema>;
  try {
    payload = leadSchema.parse(body.value);
  } catch {
    return NextResponse.json({ delivered: false, reason: "invalid_payload" }, { status: 400 });
  }

  // Honeypot: real visitors never fill this hidden field.
  if (payload.honeypot) {
    return NextResponse.json({ delivered: true, stored: false, reason: "spam" });
  }

  if (payload.fields.contact_consent !== "yes") {
    return NextResponse.json({ delivered: false, reason: "invalid_payload" }, { status: 400 });
  }

  let stored = false;
  try {
    const fields = payload.fields;
    const supabase = createSupabasePublicClient();
    const { data, error } = await supabase.rpc("capture_crm_lead", {
      p_full_name: first(fields, ["name", "full_name", "first_name"]) ?? "Website visitor",
      p_email: first(fields, ["email"]),
      p_phone: first(fields, ["phone", "telephone"]),
      p_form_name: payload.formName,
      p_property_interest: first(fields, [
        "property",
        "property_address",
        "address",
        "listingAddress",
        "listing_address",
        "criteria",
        "community",
        "areas",
        "location",
        "interest",
        "scenario",
      ]),
      p_message: first(fields, ["message", "comments", "notes", "goals", "criteria", "scenario"]),
      p_fields: fields,
      p_consent: fields.contact_consent === "yes",
    });
    if (error) throw error;
    stored = data === true;
  } catch (error) {
    console.error("[lead:crm_storage_error]", error);
  }

  if (!stored) {
    return NextResponse.json({ delivered: false, stored: false, reason: "crm_storage_error" }, { status: 503 });
  }

  const email = first(payload.fields, ["email"]);
  const [notification, webhook] = await Promise.all([
    sendBrokerNotification({
      kind: "lead",
      title: `New ${payload.formName} website inquiry`,
      fields: payload.fields,
      replyTo: email,
    }),
    sendLeadWebhook(payload.formName, payload.fields),
  ]);

  return NextResponse.json({
    delivered: true,
    stored: true,
    destination: "crm",
    notificationConfigured: notification.configured,
    notificationDelivered: notification.delivered,
    webhookDelivered: webhook.delivered,
  });
}
