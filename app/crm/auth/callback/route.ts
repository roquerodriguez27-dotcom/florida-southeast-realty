import { NextResponse } from "next/server";
import { SITE } from "@/lib/site-config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  // Preview auth cookies belong to the callback origin, so keep that session
  // on its preview. Production retains the brokerage's canonical destination.
  const redirectOrigin = process.env.VERCEL_ENV === "production" ? SITE.url : url.origin;
  const code = url.searchParams.get("code");
  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL("/crm", redirectOrigin));
  }
  return NextResponse.redirect(new URL("/crm/login?error=invalid_link", redirectOrigin));
}
