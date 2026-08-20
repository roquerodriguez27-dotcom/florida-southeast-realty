import Link from "next/link";
import { sendLoginLink } from "./actions";

export const metadata = { title: "CRM Login | Florida Southeast Realty", robots: { index: false, follow: false } };

export default async function CrmLoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  return (
    <main className="min-h-screen bg-tide flex items-center justify-center px-5 py-16">
      <section className="w-full max-w-md rounded-sm bg-sand p-7 md:p-10 shadow-2xl">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-hibiscus">Private brokerage workspace</p>
        <h1 className="font-display text-4xl text-tide mt-3">CRM sign in</h1>
        <p className="text-sm text-ink/65 mt-3">Enter your authorized brokerage email. We’ll send a secure sign-in link—no password required.</p>
        {params.sent === "1" && <p className="mt-5 rounded-sm bg-seagrass/10 border border-seagrass/30 p-3 text-sm">Check your email for the secure login link.</p>}
        {params.error && <p className="mt-5 rounded-sm bg-hibiscus/10 border border-hibiscus/30 p-3 text-sm text-hibiscus">That email is not authorized or the sign-in link could not be sent.</p>}
        <form action={sendLoginLink} className="mt-6 space-y-4">
          <label className="block text-xs font-mono uppercase tracking-wide text-ink/60" htmlFor="email">Brokerage email</label>
          <input id="email" name="email" type="email" required autoComplete="email" className="w-full border border-ink/20 rounded-sm bg-white px-3 py-3 outline-none focus:border-tide" />
          <button className="w-full rounded-sm bg-hibiscus px-4 py-3 text-sm font-semibold text-sand hover:bg-hibiscus-dark">Email my secure link</button>
        </form>
        <Link href="/" className="mt-6 inline-block text-sm text-tide underline">Return to website</Link>
      </section>
    </main>
  );
}
