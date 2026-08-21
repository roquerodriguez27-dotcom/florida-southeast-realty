import "server-only";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getCrmUser() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getClaims();
    if (error || !data?.claims) return null;
    const email = String(data.claims.email ?? "").toLowerCase();
    if (!email) return null;
    const { data: profile, error: profileError } = await supabase
      .from("crm_users")
      .select("email,display_name,role,active")
      .eq("email", email)
      .eq("active", true)
      .single();
    if (profileError || !profile || (profile.role !== "broker" && profile.role !== "agent")) return null;
    return {
      id: String(data.claims.sub),
      email,
      displayName: String(profile.display_name),
      role: profile.role as "broker" | "agent",
    };
  } catch {
    return null;
  }
}

export async function requireCrmBroker() {
  const user = await requireCrmUser();
  if (user.role !== "broker") redirect("/crm");
  return user;
}

export async function requireCrmUser() {
  const user = await getCrmUser();
  if (!user) redirect("/crm/login");
  return user;
}
