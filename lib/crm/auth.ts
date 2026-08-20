import "server-only";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function allowedEmails() {
  return (process.env.CRM_ADMIN_EMAILS ?? "roque@floridasoutheastrealty.com")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export async function getCrmUser() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getClaims();
    if (error || !data?.claims) return null;
    const email = String(data.claims.email ?? "").toLowerCase();
    if (!email || !allowedEmails().includes(email)) return null;
    return { id: String(data.claims.sub), email };
  } catch {
    return null;
  }
}

export async function requireCrmUser() {
  const user = await getCrmUser();
  if (!user) redirect("/crm/login");
  return user;
}
