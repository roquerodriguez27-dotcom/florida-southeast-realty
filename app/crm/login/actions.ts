"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function sendLoginLink(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const allowed = (process.env.CRM_ADMIN_EMAILS ?? "roque@floridasoutheastrealty.com")
    .split(",").map((value) => value.trim().toLowerCase());
  if (!allowed.includes(email)) redirect("/crm/login?error=unauthorized");

  const headerStore = await headers();
  const origin = headerStore.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/crm/auth/callback` },
  });
  if (error) redirect("/crm/login?error=send_failed");
  redirect("/crm/login?sent=1");
}
