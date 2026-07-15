export default function SearchPanel() {
  return (
    <form
      action="/properties"
      method="get"
      className="bg-white rounded-sm shadow-[0_20px_60px_-15px_rgba(14,43,48,0.35)] p-4 md:p-5 grid grid-cols-2 md:grid-cols-5 gap-3"
    >
      <div className="col-span-2 md:col-span-2">
        <label htmlFor="q" className="block text-[11px] font-mono uppercase tracking-wide text-ink/50 mb-1">
          City, Community, or Address
        </label>
        <input
          id="q"
          name="q"
          type="text"
          placeholder="Las Olas, Coral Ridge, 33305…"
          className="w-full border border-ink/15 rounded-sm px-3 py-2.5 text-sm text-ink focus:border-tide outline-none"
        />
      </div>

      <div>
        <label htmlFor="minPrice" className="block text-[11px] font-mono uppercase tracking-wide text-ink/50 mb-1">
          Min Price
        </label>
        <select
          id="minPrice"
          name="minPrice"
          defaultValue=""
          className="w-full border border-ink/15 rounded-sm px-2 py-2.5 text-sm text-ink bg-white focus:border-tide outline-none"
        >
          <option value="">No Min</option>
          <option value="500000">$500k</option>
          <option value="1000000">$1M</option>
          <option value="2000000">$2M</option>
          <option value="3000000">$3M</option>
        </select>
      </div>

      <div>
        <label htmlFor="beds" className="block text-[11px] font-mono uppercase tracking-wide text-ink/50 mb-1">
          Beds
        </label>
        <select
          id="beds"
          name="beds"
          defaultValue=""
          className="w-full border border-ink/15 rounded-sm px-2 py-2.5 text-sm text-ink bg-white focus:border-tide outline-none"
        >
          <option value="">Any</option>
          <option value="2">2+</option>
          <option value="3">3+</option>
          <option value="4">4+</option>
          <option value="5">5+</option>
        </select>
      </div>

      <button
        type="submit"
        className="col-span-2 md:col-span-1 bg-hibiscus hover:bg-hibiscus-dark text-sand font-medium text-sm rounded-sm px-4 py-2.5 transition-colors"
      >
        Search Homes
      </button>
    </form>
  );
}
