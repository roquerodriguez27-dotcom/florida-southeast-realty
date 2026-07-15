export default function Loading() {
  return (
    <div className="pt-28 md:pt-32 pb-20">
      <div className="container-fsre">
        <div className="h-4 w-24 bg-ink/10 rounded-sm mb-3 animate-pulse" />
        <div className="h-9 w-96 bg-ink/10 rounded-sm mb-10 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-[16/10] bg-ink/10 rounded-sm mb-4" />
              <div className="h-4 w-1/3 bg-ink/10 rounded-sm mb-2" />
              <div className="h-6 w-full bg-ink/10 rounded-sm" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
