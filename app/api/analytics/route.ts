import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { readSameOriginJson } from "@/lib/api/request";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { ANALYTICS_EVENTS, ANALYTICS_OPTOUT_COOKIE, analyticsMetadata, analyticsPath, isProductionAnalyticsRequest, isPublicAnalyticsPath } from "@/lib/analytics";

export const dynamic = "force-dynamic";
const noCache = { "Cache-Control": "private, no-store" };
const analyticsSchema = z.object({
  visitorId: z.uuid(), sessionId: z.uuid(), eventName: z.enum(ANALYTICS_EVENTS),
  path: z.string().min(1).max(600).refine(isPublicAnalyticsPath),
  referrerHost: z.string().max(253).nullable().optional(),
  metadata: z.record(z.string().max(80), z.union([z.string().max(500), z.number(), z.boolean(), z.null()])).optional().default({}),
});

async function isEligible(request: Request) {
  if (!isProductionAnalyticsRequest(new URL(request.url).host, process.env.VERCEL_ENV)) return false;
  const jar = await cookies();
  if (jar.get(ANALYTICS_OPTOUT_COOKIE)?.value === "1") return false;
  // Exclude all Supabase sessions, including stale cookies, so temporary auth
  // failures cannot turn logged-in CRM staff browsing into visitor traffic.
  return !jar.getAll().some(({ name }) => /^sb-.+-auth-token(?:\.\d+)?$/.test(name));
}

export async function GET(request: Request) {
  try { return NextResponse.json({ eligible: await isEligible(request) }, { headers: noCache }); }
  catch { return NextResponse.json({ eligible: false }, { headers: noCache }); }
}

export async function POST(request: Request) {
  try {
    if (!await isEligible(request)) return NextResponse.json({ stored: false, excluded: true }, { headers: noCache });
    const body = await readSameOriginJson(request, 8192);
    if (!body.ok) return NextResponse.json({ stored: false }, { status: body.status, headers: noCache });
    const parsed = analyticsSchema.safeParse(body.value);
    if (!parsed.success) return NextResponse.json({ stored: false }, { status: 400, headers: noCache });
    const metadata = analyticsMetadata(parsed.data.metadata);
    if (metadata.signalVersion === "3") metadata.trafficScope = "production";
    const supabase = createSupabasePublicClient();
    const { data, error } = await supabase.rpc("capture_site_analytics_event", {
      p_visitor_id: parsed.data.visitorId, p_session_id: parsed.data.sessionId,
      p_event_name: parsed.data.eventName, p_path: analyticsPath(parsed.data.path),
      p_referrer_host: null, p_metadata: metadata,
    });
    if (error || data !== true) {
      console.error("Site analytics storage failed", { code: error?.code ?? "event_rejected", eventName: parsed.data.eventName });
      return NextResponse.json({ stored: false }, { status: 503, headers: noCache });
    }
    return NextResponse.json({ stored: true }, { headers: noCache });
  } catch {
    console.error("Site analytics storage unavailable");
    return NextResponse.json({ stored: false }, { status: 503, headers: noCache });
  }
}
