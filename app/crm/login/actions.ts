"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SITE } from "@/lib/site-config";

function authCallbackUrl(requestOrigin: string | null) {
  // Vercel always provides VERCEL_ENV. Never let a missing or stale public
  // environment variable send a production magic link back to localhost.
  const baseUrl = process.env.VERCEL_ENV === "production"
    ? SITE.url
    : requestOrigin ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const url = new URL(baseUrl);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("CRM auth callback requires an HTTP(S) site URL.");
  }

  return new URL("/crm/auth/callback", url.origin).toString();
}

export async function sendLoginLink(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const allowed = (process.env.CRM_ADMIN_EMAILS ?? "roque@floridasoutheastrealty.com")
    .split(",").map((value) => value.trim().toLowerCase());
  if (!allowed.includes(email)) redirect("/crm/login?error=unauthorized");

  const headerStore = await headers();
  let emailRedirectTo: string;
  try {
    emailRedirectTo = authCallbackUrl(headerStore.get("origin"));
  } catch {
    redirect("/crm/login?error=configuration");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo, shouldCreateUser: false },
  });
  if (error) redirect("/crm/login?error=send_failed");
  redirect("/crm/login?sent=1");
}
