import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const frequencies = new Set(["instant", "daily", "weekly"]);

function clean(value: unknown, max = 200) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }

  const fullName = clean(body.fullName, 120);
  const email = clean(body.email, 254).toLowerCase();
  const phone = clean(body.phone, 40);
  const frequency = clean(body.frequency, 20);
  const criteria = body.criteria && typeof body.criteria === "object" && !Array.isArray(body.criteria)
    ? body.criteria as Record<string, unknown>
    : {};
  const smsConsent = body.smsConsent === true;

  if (!fullName || !EMAIL.test(email) || !frequencies.has(frequency)) {
    return NextResponse.json({ error: "Please provide your name, a valid email, and an alert frequency." }, { status: 400 });
  }
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
