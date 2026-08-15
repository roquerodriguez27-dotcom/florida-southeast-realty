import Link from "next/link";

const AREAS = [
  ["Fort Lauderdale", "/communities/las-olas"],
  ["Boca Raton", "/communities/boca-raton"],
  ["Delray Beach", "/communities/delray-beach"],
  ["Boynton Beach", "/communities/boynton-beach"],
  ["Lake Worth Beach", "/communities/lake-worth-beach"],
  ["West Palm Beach", "/communities/west-palm-beach"],
  ["Wellington", "/communities/wellington"],
  ["Palm Beach Gardens", "/communities/palm-beach-gardens"],
  ["Jupiter", "/communities/jupiter"],
  ["Wilton Manors", "/communities/wilton-manors"],
  ["Hillsboro Beach", "/communities/hillsboro-beach"],
] as const;

export default function AreasWeServe() {
  return (
    <section className="border-y border-ink/10 bg-keystone-dim">
      <div className="container-fsre py-10">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink/45 mb-4">Explore South Florida</p>
        <ul className="flex flex-wrap gap-x-2 gap-y-2 text-sm text-ink/70">
          {AREAS.map(([area, href], i) => (
            <li key={area} className="flex items-center gap-2">
              <Link href={href} className="hover:text-tide hover:underline underline-offset-4">{area}</Link>
              {i < AREAS.length - 1 && <span className="text-ink/25" aria-hidden="true">·</span>}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
