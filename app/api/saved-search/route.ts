import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { readSameOriginJson } from "@/lib/api/request";
import { z } from "zod";

const criteriaValueSchema = z.union([z.string().trim().max(300), z.boolean()]);
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
  if (honeypot) return NextResponse.json({ saved: true, pendingIdx: true });
  if (smsConsent && !phone) return NextResponse.json({ error: "A phone number is required for text alerts." }, { status: 400 });

  try {
    const supabase = createSupabaseAdminClient();
    const { data: existingLead } = await supabase.from("crm_leads").select("id").eq("email", email).order("created_at", { ascending: false }).limit(1).maybeSingle();
    let leadId = existingLead?.id ?? null;

    if (!leadId) {
      const { data: newLead, error: leadError } = await supabase.from("crm_leads").insert({
        full_name: fullName,
        email,
        phone: phone || null,
        source: "saved-search",
        form_name: "saved-search-alert",
        property_interest: "Saved property search alerts",
        message: `Requested ${frequency} property alerts.`,
        consent: true,
        fields: { criteria, frequency, smsConsent },
      }).select("id").single();
      if (leadError) throw leadError;
      leadId = newLead.id;
    }

    const { error } = await supabase.from("saved_searches").insert({
      lead_id: leadId,
      full_name: fullName,
      email,
      phone: phone || null,
      criteria,
      frequency,
      sms_consent_at: smsConsent ? new Date().toISOString() : null,
      status: "pending_idx",
    });
    if (error) throw error;

    await supabase.from("crm_activities").insert({
      lead_id: leadId,
      kind: "system",
      body: `Saved a ${frequency} property alert. It will activate when the live IDX feed is connected.`,
      created_by: "website",
    });

    return NextResponse.json({ saved: true, pendingIdx: true });
  } catch (error) {
    console.error("Saved-search creation failed", error);
    return NextResponse.json({ error: "We could not save this alert right now. Please try again or contact us." }, { status: 503 });
  }
}
