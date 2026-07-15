const AREAS = [
  "Fort Lauderdale",
  "Boca Raton",
  "Delray Beach",
  "Boynton Beach",
  "Lake Worth",
  "West Palm Beach",
  "Wellington",
  "Palm Beach Gardens",
  "Jupiter",
  "Wilton Manors",
  "Hillsboro Beach",
];

export default function AreasWeServe() {
  return (
    <section className="border-y border-ink/10 bg-keystone-dim">
      <div className="container-fsre py-10">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink/45 mb-4">
          Serving South Florida
        </p>
        <ul className="flex flex-wrap gap-x-2 gap-y-2 text-sm text-ink/70">
          {AREAS.map((area, i) => (
            <li key={area} className="flex items-center gap-2">
              <span>{area}</span>
              {i < AREAS.length - 1 && <span className="text-ink/25" aria-hidden="true">·</span>}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
