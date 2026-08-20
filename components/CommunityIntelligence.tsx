import { getCensusSnapshot, getCommunityMapLinks, getWeatherSnapshot } from "@/lib/community-intelligence";

const number = new Intl.NumberFormat("en-US");
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default async function CommunityIntelligence({ slug, name }: { slug: string; name: string }) {
  const [census, weather] = await Promise.all([getCensusSnapshot(slug), getWeatherSnapshot(slug)]);
  const links = getCommunityMapLinks(slug, name);
  return (
    <section className="container-fsre mt-12">
      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-3 mb-6"><div><p className="font-mono text-xs uppercase tracking-[0.18em] text-hibiscus">Neighborhood Intelligence</p><h2 className="font-display text-2xl md:text-3xl mt-1">Current context for {name}</h2></div><p className="text-xs text-ink/50 max-w-lg">Government data provides broad area context, not property-level facts. Always verify an address independently.</p></div>
      <div className="grid lg:grid-cols-2 gap-5">
        <article className="bg-white border border-ink/10 rounded-sm p-5 md:p-6">
          <div className="flex justify-between gap-3"><div><p className="font-mono text-[10px] uppercase tracking-widest text-hibiscus">U.S. Census Bureau</p><h3 className="font-display text-xl mt-1">Community snapshot</h3></div>{census && <span className="text-[10px] text-ink/45 text-right">{census.vintage}</span>}</div>
          {census ? <><p className="text-xs text-ink/55 mt-2">Geography: {census.geography}. Neighborhood boundaries may differ.</p><dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-5"><div><dt className="text-[10px] uppercase text-ink/45">Population</dt><dd className="font-display text-xl mt-1">{number.format(census.population)}</dd></div><div><dt className="text-[10px] uppercase text-ink/45">Median income</dt><dd className="font-display text-xl mt-1">{money.format(census.medianHouseholdIncome)}</dd></div><div><dt className="text-[10px] uppercase text-ink/45">Median home value</dt><dd className="font-display text-xl mt-1">{money.format(census.medianHomeValue)}</dd></div><div><dt className="text-[10px] uppercase text-ink/45">Median rent</dt><dd className="font-display text-xl mt-1">{money.format(census.medianGrossRent)}</dd></div><div><dt className="text-[10px] uppercase text-ink/45">Median age</dt><dd className="font-display text-xl mt-1">{census.medianAge.toFixed(1)}</dd></div><div><dt className="text-[10px] uppercase text-ink/45">Owner occupied</dt><dd className="font-display text-xl mt-1">{census.ownerOccupiedPercent.toFixed(1)}%</dd></div></dl></> : <div className="mt-5 bg-keystone/70 border border-ink/10 rounded-sm p-4"><p className="text-sm text-ink/70">View the latest population, income, housing, and demographic estimates directly in the official Census profile for this area.</p></div>}
          <a href={links.census} target="_blank" rel="noopener noreferrer" className="inline-block mt-5 text-sm text-tide underline">Open official Census profile ↗</a>
        </article>
        <article className="bg-tide text-sand rounded-sm p-5 md:p-6">
          <div className="flex justify-between gap-3"><div><p className="font-mono text-[10px] uppercase tracking-widest text-brass">National Weather Service</p><h3 className="font-display text-xl mt-1">Local forecast</h3></div><span className="text-[10px] text-sand/50">Updated automatically</span></div>
          {weather?.alert && <div className="mt-4 border border-hibiscus/60 bg-hibiscus/20 p-3 rounded-sm"><p className="text-[10px] uppercase tracking-wide text-brass">{weather.alert.severity} alert</p><p className="text-sm mt-1">{weather.alert.headline}</p></div>}
          {weather?.periods.length ? <div className="grid grid-cols-2 gap-3 mt-5">{weather.periods.map((period) => <div key={period.name} className="border border-white/10 rounded-sm p-3"><p className="text-xs text-sand/60">{period.name}</p><p className="font-display text-2xl mt-1">{period.temperature}°{period.temperatureUnit}</p><p className="text-xs text-sand/70 mt-1">{period.shortForecast}</p><p className="text-[10px] text-sand/45 mt-1">Wind {period.windSpeed}</p></div>)}</div> : <p className="text-sm text-sand/65 mt-5">The live forecast is temporarily unavailable.</p>}
          <div className="flex flex-wrap gap-4 mt-5 text-sm"><a href={links.weather} target="_blank" rel="noopener noreferrer" className="text-brass underline">Official forecast ↗</a><a href={links.googleMaps} target="_blank" rel="noopener noreferrer" className="text-brass underline">Area map ↗</a><a href={links.directions} target="_blank" rel="noopener noreferrer" className="text-brass underline">Directions ↗</a></div>
        </article>
      </div>
    </section>
  );
}
