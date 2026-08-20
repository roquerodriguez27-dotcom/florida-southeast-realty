import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./config";

export function createSupabaseAdminClient() {
  const secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Supabase server secret is not configured.");

  return createClient(SUPABASE_URL, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
