"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const PRODUCTION_SITE_URL = "https://www.floridasoutheastrealty.com";

function crmCallbackUrl() {
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (configuredSiteUrl) {
    try {
      const configuredUrl = new URL(configuredSiteUrl);
      const isLocalhost = ["localhost", "127.0.0.1", "::1"].includes(configuredUrl.hostname);
      if (process.env.NODE_ENV !== "production" || !isLocalhost) {
        return new URL("/crm/auth/callback", configuredUrl).toString();
      }
    } catch {
      // Use the safe environment fallback below when configuration is malformed.
    }
  }

  const siteUrl = process.env.NODE_ENV === "production"
    ? PRODUCTION_SITE_URL
    : "http://localhost:3000";
  return new URL("/crm/auth/callback", siteUrl).toString();
}

export async function sendLoginLink(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const allowed = (process.env.CRM_ADMIN_EMAILS ?? "roque@floridasoutheastrealty.com")
    .split(",").map((value) => value.trim().toLowerCase());
  if (!allowed.includes(email)) redirect("/crm/login?error=unauthorized");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: crmCallbackUrl() },
  });
  if (error) redirect("/crm/login?error=send_failed");
  redirect("/crm/login?sent=1");
}
