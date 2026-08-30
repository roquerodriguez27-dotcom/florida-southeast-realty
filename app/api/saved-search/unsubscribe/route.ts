import { NextResponse } from "next/server";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { SITE } from "@/lib/site-config";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token")?.trim() ?? "";
  if (!UUID_PATTERN.test(token)) {
    return NextResponse.redirect(`${SITE.url}/properties?alert=invalid`, 303);
  }

  const supabase = createSupabasePublicClient();
  const { data, error } = await supabase.rpc("unsubscribe_saved_search", { p_token: token });
  const status = !error && data === true ? "unsubscribed" : "already-unsubscribed";
  return NextResponse.redirect(`${SITE.url}/properties?alert=${status}`, 303);
}
