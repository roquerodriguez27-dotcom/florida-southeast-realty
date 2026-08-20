export default function SearchPanel() {
  return (
    <form
      action="/properties"
      method="get"
      className="bg-white rounded-sm shadow-[0_20px_60px_-15px_rgba(14,43,48,0.35)] p-4 md:p-5 grid grid-cols-2 md:grid-cols-6 gap-3"
    >
      <div className="col-span-2 md:col-span-2 min-w-0">
        <label htmlFor="q" className="block text-[11px] font-mono uppercase tracking-wide text-ink/50 mb-1">
          City, Community, Address, or ZIP
        </label>
        <input
          id="q"
          name="q"
          type="search"
          placeholder="Boca Raton, Delray Beach, 33426…"
          enterKeyHint="search"
          autoComplete="off"
          className="w-full min-w-0 border border-ink/15 rounded-sm px-3 py-2.5 text-base md:text-sm text-ink focus:border-tide outline-none"
        />
      </div>

      <div className="min-w-0">
        <label htmlFor="minPrice" className="block text-[11px] font-mono uppercase tracking-wide text-ink/50 mb-1">
          Min Price
        </label>
        <div className="flex items-center border border-ink/15 rounded-sm bg-white focus-within:border-tide">
          <span className="pl-2.5 text-ink/45">$</span>
          <input
            id="minPrice"
            name="minPrice"
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            placeholder="Any"
            autoComplete="off"
            className="w-full min-w-0 bg-transparent px-2 py-2.5 text-base md:text-sm text-ink outline-none"
          />
        </div>
      </div>

      <div className="min-w-0">
        <label htmlFor="maxPrice" className="block text-[11px] font-mono uppercase tracking-wide text-ink/50 mb-1">
          Max Price
        </label>
        <div className="flex items-center border border-ink/15 rounded-sm bg-white focus-within:border-tide">
          <span className="pl-2.5 text-ink/45">$</span>
          <input
            id="maxPrice"
            name="maxPrice"
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            placeholder="Any"
            autoComplete="off"
            className="w-full min-w-0 bg-transparent px-2 py-2.5 text-base md:text-sm text-ink outline-none"
          />
        </div>
      </div>

      <div className="min-w-0">
        <label htmlFor="beds" className="block text-[11px] font-mono uppercase tracking-wide text-ink/50 mb-1">
          Beds
        </label>
        <select
          id="beds"
          name="beds"
          defaultValue=""
          className="w-full min-w-0 border border-ink/15 rounded-sm px-2 py-2.5 text-base md:text-sm text-ink bg-white focus:border-tide outline-none"
        >
          <option value="">Any</option>
          <option value="1">1+</option>
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
