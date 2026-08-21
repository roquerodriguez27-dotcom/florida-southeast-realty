import { NextResponse } from "next/server";
import { readSameOriginJson } from "@/lib/api/request";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { z } from "zod";

/**
 * Lead delivery seam
 * ---------------------------------------------------------------
 * This route does NOT pretend to deliver leads when nothing is
 * configured. It reports back { delivered: false, reason: "not_configured" }
 * so the calling form can tell the visitor the truth and offer a
 * phone/email fallback.
 *
 * To go live, set ONE of:
 *   LEAD_WEBHOOK_URL     — POSTs the lead JSON to your CRM's inbound
 *                           webhook (HubSpot, Follow Up Boss, a Zapier/
 *                           Make catch hook, etc).
 *   RESEND_API_KEY        — sends a transactional email via Resend.
 *   RESEND_TO_EMAIL        Also requires RESEND_FROM_EMAIL and
 *   RESEND_FROM_EMAIL      RESEND_TO_EMAIL (where leads land).
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
    return NextResponse.json({ delivered: false, reason: "spam" });
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

  const webhookUrl = process.env.LEAD_WEBHOOK_URL;
  const resendKey = process.env.RESEND_API_KEY;
  const resendTo = process.env.RESEND_TO_EMAIL;
  const resendFrom = process.env.RESEND_FROM_EMAIL;

  if (!webhookUrl && !(resendKey && resendTo && resendFrom)) {
    if (stored) return NextResponse.json({ delivered: true, stored: true });
    console.info("[lead:not_configured]", payload.formName, payload.fields);
    return NextResponse.json({ delivered: false, reason: "not_configured" });
  }

  try {
    if (webhookUrl) {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ form: payload.formName, ...payload.fields, receivedAt: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error(`Webhook responded ${res.status}`);
    } else if (resendKey && resendTo && resendFrom) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: resendFrom,
          to: resendTo,
          subject: `New ${payload.formName} lead — Florida Southeast Realty`,
          text: Object.entries(payload.fields).map(([k, v]) => `${k}: ${v}`).join("\n"),
        }),
      });
      if (!res.ok) throw new Error(`Resend responded ${res.status}`);
    }
    return NextResponse.json({ delivered: true, stored });
  } catch (err) {
    console.error("[lead:delivery_error]", err);
    if (stored) return NextResponse.json({ delivered: true, stored: true, notificationDelivered: false });
    return NextResponse.json({ delivered: false, reason: "error" }, { status: 502 });
  }
}
