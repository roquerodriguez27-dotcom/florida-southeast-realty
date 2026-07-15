export default function Loading() {
  return (
    <div className="pb-20 animate-pulse">
      <div className="h-[52svh] min-h-[380px] bg-ink/10" />
      <div className="container-fsre mt-12 grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 space-y-4">
          <div className="h-5 w-full bg-ink/10 rounded-sm" />
          <div className="h-5 w-2/3 bg-ink/10 rounded-sm" />
          <div className="h-24 bg-ink/5 rounded-sm" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="aspect-square bg-ink/10 rounded-sm" />
          <div className="aspect-square bg-ink/10 rounded-sm" />
        </div>
      </div>
    </div>
  );
}
