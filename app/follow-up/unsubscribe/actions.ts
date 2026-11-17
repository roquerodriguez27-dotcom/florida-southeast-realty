"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabasePublicClient } from "@/lib/supabase/public";

export async function unsubscribeFromInquiryFollowUp(form: FormData) {
  const token = z.uuid().safeParse(form.get("token"));
  if (!token.success) redirect("/follow-up/unsubscribe?status=invalid");
  let confirmed = false;
  try {
    const supabase = createSupabasePublicClient();
    const { data, error } = await supabase.rpc("unsubscribe_followup", { p_token: token.data });
    confirmed = !error && data?.ok === true;
  } catch {
    // No token, email address or provider response belongs in public logs.
  }
  redirect(`/follow-up/unsubscribe?status=${confirmed ? "processed" : "unavailable"}`);
}
