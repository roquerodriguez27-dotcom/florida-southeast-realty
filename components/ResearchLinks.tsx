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
  {
    title: "Palm Beach school locator",
    source: "School District of Palm Beach County",
    body: "Enter an address to identify currently assigned elementary, middle, and high schools. Recheck assignments before enrolling or purchasing.",
    href: "https://arcgis.palmbeachschools.org/arcgisportal/apps/experiencebuilder/experience?id=0468f231866f42ae8cb11da91b97b92e",
  },
  {
    title: "Broward school locator",
    source: "Broward County Public Schools",
    body: "Use the district's official address locator and select the appropriate school year and grade level.",
    href: "https://locator.browardschools.com/",
  },
  {
    title: "Community demographics",
    source: "U.S. Census Bureau",
    body: "Compare population, households, housing, income, age, commuting, and other American Community Survey estimates.",
    href: "https://data.census.gov/",
  },
  {
    title: "Forecasts & weather alerts",
    source: "National Weather Service",
    body: "Review official forecasts, watches, warnings, advisories, radar, and severe-weather information for the area.",
    href: "https://www.weather.gov/",
  },
  {
    title: "Palm Beach permit tracking",
    source: "Palm Beach County",
    body: "Track permits and inspections and review county online property services. Municipal properties may require a city-specific search.",
    href: "https://discover.pbcgov.org/pages/online-services.aspx",
  },
  {
    title: "Broward ePermits OneStop",
    source: "Broward County",
    body: "Access county permitting services and follow links to participating municipalities for permit and approval research.",
    href: "https://www.broward.org/epermits",
  },
  {
    title: "Hurricane preparedness",
    source: "Florida Division of Emergency Management",
    body: "Review evacuation, shelter, supply, family-plan, and emergency-information resources before hurricane season.",
    href: "https://www.floridadisaster.org/planprepare/",
  },
  {
    title: "Storm surge & coastal hazards",
    source: "NOAA National Hurricane Center",
    body: "Use official tropical-weather forecasts, storm-surge resources, outlooks, and hurricane preparedness information.",
    href: "https://www.nhc.noaa.gov/",
  },
  {
    title: "Palm Tran trip planning",
    source: "Palm Beach County",
    body: "Research public bus routes, schedules, service alerts, fares, and trip-planning options across Palm Beach County.",
    href: "https://www.palmtran.org/",
  },
  {
    title: "Broward County Transit",
    source: "Broward County",
    body: "Review bus routes, schedules, fares, service changes, and trip-planning information throughout Broward County.",
    href: "https://www.broward.org/BCT/",
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
