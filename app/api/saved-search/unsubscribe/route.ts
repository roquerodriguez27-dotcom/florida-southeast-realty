import { NextResponse } from "next/server";
import { createSupabasePublicClient } from "@/lib/supabase/public";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function resultRedirect(request: Request, status: string) {
  const destination = new URL("/properties", request.url);
  destination.searchParams.set("alert", status);
  const response = NextResponse.redirect(destination, 303);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token")?.trim() ?? "";
  if (!UUID_PATTERN.test(token)) {
    return resultRedirect(request, "invalid");
  }

  try {
    const supabase = createSupabasePublicClient();
    const { data, error } = await supabase.rpc("unsubscribe_saved_search", { p_token: token });
    if (error || typeof data !== "boolean") {
      console.error("[saved-search-unsubscribe:failed]");
      return resultRedirect(request, "unsubscribe-error");
    }
    // A false result can mean either an expired/unknown link or an alert that
    // was already stopped. Do not report a newly confirmed unsubscribe.
    return resultRedirect(request, data ? "unsubscribed" : "already-unsubscribed");
  } catch {
    // Do not include the capability token or subscriber details in logs.
    console.error("[saved-search-unsubscribe:failed]");
    return resultRedirect(request, "unsubscribe-error");
  }
}
