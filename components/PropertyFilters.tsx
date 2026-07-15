export default function PropertyFilters({
  current,
}: {
  current: { q?: string; minPrice?: string; maxPrice?: string; beds?: string; type?: string; waterfront?: string };
}) {
  return (
    <form
      action="/properties"
      method="get"
      className="bg-white border border-ink/10 rounded-sm p-4 md:p-5 grid grid-cols-2 md:grid-cols-6 gap-3 items-end"
    >
      <div className="col-span-2 md:col-span-2">
        <label htmlFor="f-q" className="block text-[11px] font-mono uppercase tracking-wide text-ink/50 mb-1">
          Location
        </label>
        <input
          id="f-q"
          name="q"
          defaultValue={current.q}
          type="text"
          placeholder="City, community, zip…"
          className="w-full border border-ink/15 rounded-sm px-3 py-2 text-sm focus:border-tide outline-none"
        />
      </div>

      <div>
        <label htmlFor="f-min" className="block text-[11px] font-mono uppercase tracking-wide text-ink/50 mb-1">
          Min Price
        </label>
        <select id="f-min" name="minPrice" defaultValue={current.minPrice ?? ""} className="w-full border border-ink/15 rounded-sm px-2 py-2 text-sm bg-white focus:border-tide outline-none">
          <option value="">No Min</option>
          <option value="500000">$500k</option>
          <option value="1000000">$1M</option>
          <option value="2000000">$2M</option>
          <option value="3000000">$3M</option>
        </select>
      </div>

      <div>
        <label htmlFor="f-max" className="block text-[11px] font-mono uppercase tracking-wide text-ink/50 mb-1">
          Max Price
        </label>
        <select id="f-max" name="maxPrice" defaultValue={current.maxPrice ?? ""} className="w-full border border-ink/15 rounded-sm px-2 py-2 text-sm bg-white focus:border-tide outline-none">
          <option value="">No Max</option>
          <option value="1000000">$1M</option>
          <option value="2000000">$2M</option>
          <option value="3000000">$3M</option>
          <option value="5000000">$5M</option>
        </select>
      </div>

      <div>
        <label htmlFor="f-beds" className="block text-[11px] font-mono uppercase tracking-wide text-ink/50 mb-1">
          Beds
        </label>
        <select id="f-beds" name="beds" defaultValue={current.beds ?? ""} className="w-full border border-ink/15 rounded-sm px-2 py-2 text-sm bg-white focus:border-tide outline-none">
          <option value="">Any</option>
          <option value="2">2+</option>
          <option value="3">3+</option>
          <option value="4">4+</option>
          <option value="5">5+</option>
        </select>
      </div>

      <div>
        <label htmlFor="f-type" className="block text-[11px] font-mono uppercase tracking-wide text-ink/50 mb-1">
          Type
        </label>
        <select id="f-type" name="type" defaultValue={current.type ?? ""} className="w-full border border-ink/15 rounded-sm px-2 py-2 text-sm bg-white focus:border-tide outline-none">
          <option value="">Any</option>
          <option value="Single Family">Single Family</option>
          <option value="Condo">Condo</option>
          <option value="Townhome">Townhome</option>
          <option value="Estate">Estate</option>
        </select>
      </div>

      <label className="col-span-2 md:col-span-2 flex items-center gap-2 text-sm text-ink/70 py-2">
        <input
          type="checkbox"
          name="waterfront"
          value="1"
          defaultChecked={current.waterfront === "1"}
          className="h-4 w-4 accent-hibiscus"
        />
        Waterfront only
      </label>

      <button
        type="submit"
        className="col-span-2 md:col-span-4 bg-tide hover:bg-tide-light text-sand font-medium text-sm rounded-sm px-4 py-2.5 transition-colors"
      >
        Update Results
      </button>
    </form>
  );
}
