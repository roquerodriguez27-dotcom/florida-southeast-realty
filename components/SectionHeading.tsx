import Link from "next/link";

export default function SectionHeading({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="flex items-end justify-between gap-4 mb-8 md:mb-10">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-hibiscus mb-2">{eyebrow}</p>
        <h2 className="font-display text-3xl md:text-4xl text-ink leading-tight">{title}</h2>
      </div>
      {action && (
        <Link
          href={action.href}
          className="hidden sm:block text-sm font-medium text-tide border-b border-tide/40 hover:border-tide pb-0.5 shrink-0"
        >
          {action.label} →
        </Link>
      )}
    </div>
  );
}
