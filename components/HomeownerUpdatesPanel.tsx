import Link from "next/link";
import {
  HOMEOWNER_UPDATES,
  HOMEOWNER_UPDATES_PATH,
  HOMEOWNER_UPDATES_TITLE,
  formatHomeownerDate,
} from "@/lib/homeowner-updates";

export default function HomeownerUpdatesPanel() {
  return (
    <aside className="rounded-sm border border-tide/15 bg-white p-5 sm:p-7" aria-label={HOMEOWNER_UPDATES_TITLE}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-hibiscus">Ownership costs &amp; changes</p>
          <h2 className="mt-2 font-display text-2xl text-ink">
            <Link href={HOMEOWNER_UPDATES_PATH} className="hover:text-tide">{HOMEOWNER_UPDATES_TITLE}</Link>
          </h2>
        </div>
        <Link href={HOMEOWNER_UPDATES_PATH} className="shrink-0 text-sm text-tide underline underline-offset-4">
          Read the updates <span aria-hidden="true">→</span>
        </Link>
      </div>
      <ul className="mt-5 grid gap-4 md:grid-cols-3">
        {HOMEOWNER_UPDATES.topics.map((topic) => (
          <li key={topic.id} className="border-l-2 border-brass/50 pl-4">
            <p className="text-xs font-medium text-seagrass">{topic.status.label}</p>
            <Link href={`${HOMEOWNER_UPDATES_PATH}#${topic.id}`} className="mt-1 block text-sm font-medium leading-relaxed text-tide hover:underline underline-offset-4">
              {topic.title}
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-5 text-xs text-ink/60">
        Article updated <time dateTime={HOMEOWNER_UPDATES.editorialUpdatedAt}>{formatHomeownerDate(HOMEOWNER_UPDATES.editorialUpdatedAt)}</time>. Official sources and review dates are included with each update.
      </p>
    </aside>
  );
}
