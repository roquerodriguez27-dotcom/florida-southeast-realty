import type { Metadata } from "next";
import Link from "next/link";
import {
  HOMEOWNER_UPDATES,
  HOMEOWNER_UPDATES_PATH,
  HOMEOWNER_UPDATES_TITLE,
  HOMEOWNER_UPDATES_DESCRIPTION,
  formatHomeownerDate,
  sourcesReviewedAt,
} from "@/lib/homeowner-updates";
import { SITE } from "@/lib/site-config";
import { serializeJsonLd } from "@/lib/seo/json-ld";

export const metadata: Metadata = {
  title: HOMEOWNER_UPDATES_TITLE,
  description: HOMEOWNER_UPDATES_DESCRIPTION,
  alternates: { canonical: HOMEOWNER_UPDATES_PATH },
  openGraph: {
    type: "article",
    title: HOMEOWNER_UPDATES_TITLE,
    description: HOMEOWNER_UPDATES_DESCRIPTION,
    publishedTime: HOMEOWNER_UPDATES.publishedAt,
    modifiedTime: HOMEOWNER_UPDATES.editorialUpdatedAt,
  },
};

export default function HomeownerUpdatesPage() {
  const reviewedAt = sourcesReviewedAt(HOMEOWNER_UPDATES.topics);
  const history = [...HOMEOWNER_UPDATES.history].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 6);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: HOMEOWNER_UPDATES_TITLE,
    description: HOMEOWNER_UPDATES_DESCRIPTION,
    datePublished: HOMEOWNER_UPDATES.publishedAt,
    dateModified: HOMEOWNER_UPDATES.editorialUpdatedAt,
    author: { "@type": "Organization", name: SITE.name },
    publisher: { "@type": "Organization", name: SITE.name, url: SITE.url },
    mainEntityOfPage: `${SITE.url}${HOMEOWNER_UPDATES_PATH}`,
    citation: [...new Set(HOMEOWNER_UPDATES.topics.flatMap((topic) => topic.sources.map((source) => source.url)))],
  };

  return (
    <article className="pb-20">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      <header className="bg-tide pt-28 pb-12 text-sand md:pt-32 md:pb-16">
        <div className="container-fsre max-w-5xl">
          <Link href="/research" className="text-sm text-sand/75 underline underline-offset-4 hover:text-sand">
            <span aria-hidden="true">← </span>Research Center
          </Link>
          <p className="mt-7 font-mono text-xs uppercase tracking-[0.2em] text-brass">Know what changes. Know what to ask.</p>
          <h1 className="mt-3 max-w-3xl font-display text-4xl leading-tight md:text-6xl">{HOMEOWNER_UPDATES_TITLE}</h1>
          <p className="mt-5 max-w-3xl text-lg leading-relaxed text-sand/80">{HOMEOWNER_UPDATES_DESCRIPTION}</p>
          <dl className="mt-7 flex flex-col gap-4 border-t border-sand/15 pt-5 text-sm sm:flex-row sm:gap-10">
            <div>
              <dt className="text-sand/60">Article updated</dt>
              <dd className="mt-1"><time dateTime={HOMEOWNER_UPDATES.editorialUpdatedAt}>{formatHomeownerDate(HOMEOWNER_UPDATES.editorialUpdatedAt)}</time></dd>
            </div>
            <div>
              <dt className="text-sand/60">Sources reviewed</dt>
              <dd className="mt-1"><time dateTime={reviewedAt}>{formatHomeownerDate(reviewedAt)}</time></dd>
              <dd className="mt-1 text-xs text-sand/60">Published verification snapshot</dd>
            </div>
          </dl>
        </div>
      </header>

      <div className="container-fsre max-w-5xl">
        <nav aria-label="Homeowner update topics" className="grid gap-3 py-7 md:grid-cols-3 md:py-9">
          {HOMEOWNER_UPDATES.topics.map((topic, index) => (
            <a key={topic.id} href={`#${topic.id}`} className="group flex gap-3 rounded-sm border border-ink/10 bg-white p-4 transition-colors hover:border-tide/35">
              <span className="font-mono text-xs text-brass">0{index + 1}</span>
              <span className="text-sm font-medium leading-relaxed text-tide group-hover:underline underline-offset-4">{topic.title}</span>
            </a>
          ))}
        </nav>

        <p className="mb-9 max-w-3xl text-sm leading-relaxed text-ink/65">
          Use these updates to organize your next questions. Eligibility, costs, and deadlines can depend on the property and policy. Confirm the details with the responsible agency and the professionals advising your transaction. Dates are shown in Eastern Time.
        </p>

        <div className="space-y-10">
          {HOMEOWNER_UPDATES.topics.map((topic, index) => {
            const topicReviewedAt = sourcesReviewedAt([topic]);
            return (
              <section key={topic.id} id={topic.id} aria-labelledby={`${topic.id}-title`} className="scroll-mt-28 overflow-hidden rounded-sm border border-ink/10 bg-white">
                <div className="border-b border-ink/10 bg-keystone/50 p-6 sm:p-8">
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <span className="font-mono text-brass">0{index + 1}</span>
                    <span className={`rounded-full px-3 py-1 font-medium ${topic.status.code === "under-review" || topic.status.code === "unofficial-results" ? "bg-brass/15 text-tide" : "bg-seagrass/10 text-seagrass"}`}>
                      {topic.status.label}
                    </span>
                    <span className="text-ink/60">Reviewed <time dateTime={topicReviewedAt}>{formatHomeownerDate(topicReviewedAt)}</time></span>
                  </div>
                  <h2 id={`${topic.id}-title`} className="mt-4 font-display text-2xl leading-tight text-ink sm:text-3xl">{topic.title}</h2>
                  <p className="mt-4 text-base leading-relaxed text-ink/75">{topic.summary}</p>
                  <p className="mt-4 border-l-2 border-brass pl-4 text-sm leading-relaxed text-tide">{topic.status.detail}</p>
                  <p className="mt-4 text-sm leading-relaxed text-ink/65"><span className="font-medium text-ink">Who should read this: </span>{topic.appliesTo}</p>
                </div>

                <div className="p-6 sm:p-8">
                  <h3 className="font-display text-xl text-ink">What the official sources say</h3>
                  <ul className="mt-4 space-y-5">
                    {topic.facts.map((fact) => (
                      <li key={fact.id} className="border-l border-ink/15 pl-4">
                        <p className="text-sm leading-relaxed text-ink/80">{fact.text}</p>
                        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-xs" aria-label="Sources for this fact">
                          {fact.sourceIds.map((sourceId) => {
                            const source = topic.sources.find((item) => item.id === sourceId)!;
                            return <li key={sourceId}><a href={source.url} target="_blank" rel="noopener noreferrer" className="text-tide underline underline-offset-4">{source.label}<span className="sr-only"> (opens in a new tab)</span></a></li>;
                          })}
                        </ul>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-7 rounded-sm bg-keystone/60 p-5">
                    <h3 className="font-display text-xl text-ink">Questions and next steps</h3>
                    <ul className="mt-4 space-y-3">
                      {topic.actions.map((action) => (
                        <li key={action.text} className="flex gap-3 text-sm leading-relaxed text-ink/80">
                          <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brass" />
                          {action.href ? action.href.startsWith("/") ? (
                            <Link href={action.href} prefetch={false} className="text-tide underline underline-offset-4">{action.text}</Link>
                          ) : (
                            <a href={action.href} target="_blank" rel="noopener noreferrer" className="text-tide underline underline-offset-4">{action.text}<span className="sr-only"> (opens in a new tab)</span></a>
                          ) : <span>{action.text}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-7 border-t border-ink/10 pt-5">
                    <h3 className="text-sm font-medium text-ink">Official sources and review dates</h3>
                    <ul className="mt-3 space-y-3 text-xs leading-relaxed">
                      {topic.sources.map((source) => (
                        <li key={source.id}>
                          <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-tide underline underline-offset-4">{source.label}<span className="sr-only"> (opens in a new tab)</span></a>
                          <span className="block mt-1 text-ink/60">Reviewed <time dateTime={source.lastSuccessfulCheckAt}>{formatHomeownerDate(source.lastSuccessfulCheckAt)}</time>{source.accessMethod === "official-index" ? " · Official search excerpt reviewed" : " · Official page reviewed"}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-4 text-xs text-ink/60">Article updated <time dateTime={topic.editorialUpdatedAt}>{formatHomeownerDate(topic.editorialUpdatedAt)}</time></p>
                  </div>
                </div>
              </section>
            );
          })}
        </div>

        <section className="mt-12 border-t border-ink/15 pt-7" aria-labelledby="update-history-title">
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-hibiscus">Keeping the record clear</p>
          <h2 id="update-history-title" className="mt-2 font-display text-2xl">Recent changes</h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink/65">Source review dates record the successful checks included in this published version; the earliest review appears at the top of the page. Routine checks that find no changes do not change these dates or the article date. The article date changes when the published explanation changes.</p>
          <ol className="mt-5 space-y-5">
            {history.map((entry) => (
              <li key={`${entry.at}-${entry.summary}`} className="border-l-2 border-brass/50 pl-4">
                <time dateTime={entry.at} className="text-xs font-medium text-seagrass">{formatHomeownerDate(entry.at)}</time>
                <p className="mt-1 text-sm leading-relaxed text-ink/75">{entry.summary}</p>
                <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-xs" aria-label="Topics changed">
                  {entry.topicIds.map((topicId) => <li key={topicId}><a href={`#${topicId}`} className="text-tide underline underline-offset-4">{HOMEOWNER_UPDATES.topics.find((topic) => topic.id === topicId)!.title}</a></li>)}
                </ul>
              </li>
            ))}
          </ol>
        </section>

        <aside className="mt-10 rounded-sm bg-tide p-6 text-sand sm:p-8">
          <h2 className="font-display text-2xl">Planning a purchase, sale, or move?</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-sand/75">Bring the property address and your questions. We can help organize the research and identify the records and professionals you may need next.</p>
          <div className="mt-5 flex flex-wrap gap-4 text-sm">
            <Link href="/contact" className="rounded-sm bg-sand px-5 py-3 font-medium text-tide hover:bg-keystone">Ask a local broker</Link>
            <Link href="/buyer-tools" className="px-1 py-3 text-sand underline underline-offset-4">Compare ownership costs</Link>
          </div>
        </aside>
      </div>
    </article>
  );
}
