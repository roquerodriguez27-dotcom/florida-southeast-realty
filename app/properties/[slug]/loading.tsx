export default function Loading() {
  return (
    <div className="pt-16 pb-20 animate-pulse">
      <div className="h-[46vh] md:h-[64vh] bg-ink/10" />
      <div className="container-fsre mt-10 grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 space-y-4">
          <div className="h-8 w-2/3 bg-ink/10 rounded-sm" />
          <div className="h-5 w-1/2 bg-ink/10 rounded-sm" />
          <div className="h-8 w-40 bg-ink/10 rounded-sm" />
          <div className="h-24 bg-ink/5 rounded-sm" />
        </div>
        <div className="h-64 bg-ink/10 rounded-sm" />
      </div>
    </div>
  );
}
