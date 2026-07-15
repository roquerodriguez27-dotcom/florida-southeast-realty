const VALUES = [
  { value: "0.5%", label: "Listing-Side Fee" },
  { value: "Full MLS", label: "Exposure Included" },
  { value: "Full-Service", label: "From List to Close" },
  { value: "Negotiable", label: "Commission Rates" },
];

export default function ValuePropsBar() {
  return (
    <div className="bg-tide">
      <div className="container-fsre py-10 md:py-12 grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
        {VALUES.map((s) => (
          <div key={s.label} className="text-center md:text-left">
            <p className="font-mono text-2xl md:text-3xl text-sand">{s.value}</p>
            <p className="text-xs md:text-sm text-sand/60 mt-1">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
