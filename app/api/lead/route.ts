import { NextResponse } from "next/server";

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

interface LeadPayload {
  formName: string;
  honeypot?: string;
  fields: Record<string, string>;
}

export async function POST(req: Request) {
  let payload: LeadPayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ delivered: false, reason: "invalid_payload" }, { status: 400 });
  }

  // Honeypot: real visitors never fill this hidden field.
  if (payload.honeypot) {
    return NextResponse.json({ delivered: false, reason: "spam" });
  }

  const webhookUrl = process.env.LEAD_WEBHOOK_URL;
  const resendKey = process.env.RESEND_API_KEY;
  const resendTo = process.env.RESEND_TO_EMAIL;
  const resendFrom = process.env.RESEND_FROM_EMAIL;

  if (!webhookUrl && !(resendKey && resendTo && resendFrom)) {
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
    return NextResponse.json({ delivered: true });
  } catch (err) {
    console.error("[lead:delivery_error]", err);
    return NextResponse.json({ delivered: false, reason: "error" }, { status: 502 });
  }
}
