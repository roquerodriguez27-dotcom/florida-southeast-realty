import Link from "next/link";
import { z } from "zod";
import { SITE } from "@/lib/site-config";
import { unsubscribeFromInquiryFollowUp } from "./actions";

export const metadata = { title: "Email preferences", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function FollowUpUnsubscribePage({ searchParams }: {
  searchParams: Promise<{ token?: string; status?: string }>;
}) {
  const params = await searchParams;
  const validToken = z.uuid().safeParse(params.token);
  const processed = params.status === "processed";
  return <main className="min-h-[75vh] bg-sand px-5 pb-16 pt-36 text-ink">
    <section className="mx-auto max-w-xl rounded-sm border border-ink/10 bg-white p-7 md:p-10">
      <p className="font-mono text-xs uppercase tracking-widest text-hibiscus">Florida Southeast Realty</p>
      <h1 className="mt-3 font-display text-3xl text-tide">Inquiry email preferences</h1>
      {processed ? <p role="status" className="mt-5 text-sm leading-6">Your request to stop inquiry follow-up emails has been processed. It does not change any saved-search listing alerts; those emails have their own unsubscribe link.</p> : validToken.success ? <>
        <p className="mt-5 text-sm leading-6">Use the button below to stop inquiry follow-up emails for the address that received this link. Your saved-search listing alerts have a separate unsubscribe link.</p>
        <form action={unsubscribeFromInquiryFollowUp} className="mt-6"><input type="hidden" name="token" value={validToken.data} /><button className="min-h-11 rounded-sm bg-hibiscus px-5 py-3 text-sm font-semibold text-white">Stop inquiry follow-up emails</button></form>
      </> : <p role="alert" className="mt-5 text-sm leading-6">{params.status === "unavailable" ? "We couldn’t confirm the change. Please try the link in your email again, or contact us so we can stop follow-up for you." : "This page needs the complete preferences link from your email. You can also contact us to stop inquiry follow-up."}</p>}
      <p className="mt-6 text-sm"><a href={`mailto:${SITE.email}`} className="break-words text-tide underline">{SITE.email}</a></p>
      <Link href="/" className="mt-5 inline-block text-sm text-tide underline">Return to website</Link>
    </section>
  </main>;
}
