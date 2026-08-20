import Image from "next/image";
import Link from "next/link";

type EqualHousingMarkProps = {
  className?: string;
  light?: boolean;
};

export default function EqualHousingMark({ className = "", light = false }: EqualHousingMarkProps) {
  return (
    <Link
      href="/fair-housing"
      className={`inline-flex rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 ${light ? "text-sand" : "text-ink"} ${className}`}
      aria-label="Read our Equal Housing Opportunity statement"
    >
      <Image
        src="/equal-housing-opportunity.svg"
        alt="Equal Housing Opportunity"
        width={180}
        height={84}
        className="h-auto w-[150px]"
      />
    </Link>
  );
}
