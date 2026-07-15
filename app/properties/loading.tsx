export default function Loading() {
  return (
    <div className="pt-28 md:pt-32 pb-20">
      <div className="container-fsre">
        <div className="h-4 w-24 bg-ink/10 rounded-sm mb-3 animate-pulse" />
        <div className="h-9 w-72 bg-ink/10 rounded-sm mb-8 animate-pulse" />
        <div className="h-24 bg-ink/5 rounded-sm mb-10 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-[4/3] bg-ink/10 rounded-sm mb-3" />
              <div className="h-5 w-1/2 bg-ink/10 rounded-sm mb-2" />
              <div className="h-4 w-3/4 bg-ink/10 rounded-sm" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
