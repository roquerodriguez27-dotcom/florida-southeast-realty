const COPY = {
  listings:
    "Sample listings shown for demonstration only — not live MLS data. Connect an IDX/RESO feed to display real inventory (see lib/idx.ts).",
  editorial:
    "Sample editorial content for demonstration — replace with your firm's verified market data and reviewed copy before publishing.",
} as const;

export default function SampleDataNotice({ variant }: { variant: keyof typeof COPY }) {
  return (
    <div className="bg-brass/15 border border-brass/40 text-tide text-xs md:text-sm rounded-sm px-4 py-2.5 flex items-start gap-2">
      <span aria-hidden="true">⚠</span>
      <p>{COPY[variant]}</p>
    </div>
  );
}
