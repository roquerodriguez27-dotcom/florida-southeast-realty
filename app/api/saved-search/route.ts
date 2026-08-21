import { NextResponse } from "next/server";
import { readSameOriginJson } from "@/lib/api/request";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { z } from "zod";
import { checkIdxConnection } from "@/lib/idx";
import { sendBrokerNotification } from "@/lib/broker-notification";

const criteriaValueSchema = z.union([z.string().trim().max(2000), z.boolean()]);
const savedSearchSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  email: z.email().max(254).transform((value) => value.toLowerCase()),
  phone: z.string().trim().max(40).optional().default(""),
  frequency: z.enum(["instant", "daily", "weekly"]),
  smsConsent: z.boolean().optional().default(false),
  honeypot: z.string().max(500).optional().default(""),
  criteria: z.record(z.string().max(60), criteriaValueSchema)
    .refine((value) => Object.keys(value).length <= 20, "Too many search criteria."),
});

export async function POST(request: Request) {
  const body = await readSameOriginJson(request);
  if (!body.ok) {
    return NextResponse.json({ error: "Invalid request." }, { status: body.status });
  }

  const parsed = savedSearchSchema.safeParse(body.value);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please provide your name, a valid email, and an alert frequency." }, { status: 400 });
  }
  const { fullName, email, phone, frequency, smsConsent, honeypot, criteria } = parsed.data;
  if (honeypot) return NextResponse.json({ saved: true, pendingIdx: false });
  if (smsConsent && !phone) return NextResponse.json({ error: "A phone number is required for text alerts." }, { status: 400 });

  try {
    const idxConnection = await checkIdxConnection();
    const idxActive = idxConnection.connected && idxConnection.idxRoleVerified !== false;
    const supabase = createSupabasePublicClient();
    const { data: pendingIdx, error } = await supabase.rpc("capture_saved_search", {
      p_full_name: fullName,
      p_email: email,
      p_phone: phone || null,
      p_frequency: frequency,
      p_sms_consent: smsConsent,
      p_criteria: criteria,
      p_idx_active: idxActive,
    });
    if (error) throw error;
    const notification = await sendBrokerNotification({
      kind: "saved-search",
      title: "New saved property search",
      replyTo: email,
      fields: {
        fullName,
        email,
        phone,
        frequency,
        smsConsent,
        ...Object.fromEntries(Object.entries(criteria).map(([key, value]) => [`criteria_${key}`, value])),
      },
    });
    return NextResponse.json({
      saved: true,
      stored: true,
      pendingIdx: pendingIdx === true,
      notificationConfigured: notification.configured,
      notificationDelivered: notification.delivered,
    });
  } catch (error) {
    console.error("Saved-search creation failed", error);
    return NextResponse.json({ error: "We could not save this alert right now. Please try again or contact us." }, { status: 503 });
  }
}
