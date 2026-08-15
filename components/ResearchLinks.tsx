import Link from "next/link";

export const RESEARCH_RESOURCES = [
  {
    title: "Flood maps & zones",
    source: "FEMA",
    body: "Check the official National Flood Hazard Layer and map products before making assumptions about flood exposure or insurance needs.",
    href: "https://msc.fema.gov/portal/home",
  },
  {
    title: "Florida school grades",
    source: "Florida Department of Education",
    body: "Review official school grades and accountability reports. Always confirm current school assignments with the applicable district.",
    href: "https://www.fldoe.org/accountability/accountability-reporting/school-grades/",
  },
  {
    title: "Palm Beach property records",
    source: "Palm Beach County Property Appraiser",
    body: "Research assessed values, sales history, parcel details, exemptions, maps, and other public property-record information.",
    href: "https://pbcpao.gov/AdvSearch/AdvanceSearch",
  },
  {
    title: "Broward property records",
    source: "Broward County Property Appraiser",
    body: "Search public parcel, sales, assessment, map, and exemption information for Broward County properties.",
    href: "https://web.bcpa.net/bcpaclient/",
  },
  {
    title: "Palm Beach permits & code",
    source: "Palm Beach County PZB",
    body: "Start permit, inspection, lien, zoning, and code-compliance research through the county’s official Planning, Zoning & Building resources.",
    href: "https://discover.pbc.gov/pzb/pages/i-want-to.aspx",
  },
  {
    title: "Broward permits",
    source: "Broward County",
    body: "Use Broward County ePermits OneStop and local municipality resources to investigate permit status and approvals.",
    href: "https://www.broward.org/ePermits/Pages/Default.aspx",
  },
  {
    title: "Florida crime data",
    source: "Florida Department of Law Enforcement",
    body: "Use official incident-based reporting data for objective research. We do not label neighborhoods as safe or unsafe.",
    href: "https://www.fdle.state.fl.us/CJAB/FIBRS",
  },
  {
    title: "Walkability & transportation",
    source: "Walk Score",
    body: "Explore walkability, bike access, and transit context as one part of evaluating how a location fits your routine.",
    href: "https://www.walkscore.com/",
  },
];

export default function ResearchLinks({ limit }: { limit?: number }) {
  const resources = typeof limit === "number" ? RESEARCH_RESOURCES.slice(0, limit) : RESEARCH_RESOURCES;

  return (
    <div>
      <div className="grid sm:grid-cols-2 gap-4">
        {resources.map((resource) => (
          <a
            key={resource.title}
            href={resource.href}
            target="_blank"
            rel="noopener noreferrer"
            className="group bg-white border border-ink/10 rounded-sm p-5 hover:border-tide/30 hover:shadow-sm transition-all"
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-hibiscus">{resource.source}</p>
            <h3 className="font-display text-lg text-ink mt-1 group-hover:text-tide">{resource.title}</h3>
            <p className="text-sm text-ink/65 mt-2 leading-relaxed">{resource.body}</p>
            <span className="inline-block text-xs text-tide mt-3">Open official resource ↗</span>
          </a>
        ))}
      </div>
      {typeof limit === "number" && limit < RESEARCH_RESOURCES.length && (
        <Link href="/research" className="inline-block mt-5 text-sm text-tide underline underline-offset-4">
          Open the full South Florida research center
        </Link>
      )}
    </div>
  );
}
