import { NextResponse } from "next/server";
import { SITE } from "@/lib/site-config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  // Preview auth cookies belong to the callback origin, so keep that session
  // on its preview. Production retains the brokerage's canonical destination.
  const redirectOrigin = process.env.VERCEL_ENV === "production" ? SITE.url : url.origin;
  const code = url.searchParams.get("code");
  let failure = "invalid_link";
  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL("/crm", redirectOrigin));
    // A PKCE email link must be opened by the browser that requested it.
    // Do not describe missing browser storage as an expired email or log codes,
    // tokens, cookies, email addresses, or the callback URL.
    if (error.code === "pkce_code_verifier_not_found") failure = "browser_mismatch";
    else if (error.code === "bad_code_verifier") failure = "request_replaced";
    else if (error.code !== "otp_expired" && error.code !== "flow_state_expired" && error.code !== "flow_state_not_found") failure = "exchange_failed";
    console.warn("CRM sign-in exchange failed", { reason: failure });
  }
  const response = NextResponse.redirect(new URL(`/crm/login?error=${failure}`, redirectOrigin));
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
