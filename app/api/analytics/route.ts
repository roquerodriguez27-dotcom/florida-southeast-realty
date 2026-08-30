import { NextResponse } from "next/server";
import { z } from "zod";
import { readSameOriginJson } from "@/lib/api/request";
import { createSupabasePublicClient } from "@/lib/supabase/public";

const analyticsSchema = z.object({
  visitorId: z.uuid(),
  sessionId: z.uuid(),
  eventName: z.enum([
    "page_view",
    "property_search",
    "lead_submit",
    "phone_click",
    "email_click",
    "saved_search_submit",
    "compare_change",
    "buyer_tool_use",
  ]),
  path: z.string().min(1).max(600).refine((value) => value.startsWith("/")),
  referrerHost: z.string().max(253).nullable().optional(),
  metadata: z.record(z.string().max(80), z.union([z.string().max(500), z.number(), z.boolean(), z.null()])).optional().default({}),
});

export async function POST(request: Request) {
  const body = await readSameOriginJson(request, 8_192);
  if (!body.ok) return NextResponse.json({ stored: false }, { status: body.status });

  const parsed = analyticsSchema.safeParse(body.value);
  if (!parsed.success) return NextResponse.json({ stored: false }, { status: 400 });

  try {
    const supabase = createSupabasePublicClient();
    const { data, error } = await supabase.rpc("capture_site_analytics_event", {
      p_visitor_id: parsed.data.visitorId,
      p_session_id: parsed.data.sessionId,
      p_event_name: parsed.data.eventName,
      p_path: parsed.data.path,
      p_referrer_host: parsed.data.referrerHost ?? null,
      p_metadata: parsed.data.metadata,
    });
    if (error || data !== true) throw error ?? new Error("Analytics event rejected");
    return NextResponse.json({ stored: true });
  } catch {
    return NextResponse.json({ stored: false }, { status: 503 });
  }
}
