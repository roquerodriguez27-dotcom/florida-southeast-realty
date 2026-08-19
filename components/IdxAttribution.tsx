import type { IdxAttribution as IdxAttributionData } from "@/lib/types";

function IdxLogo({ attribution, compact }: { attribution: IdxAttributionData; compact: boolean }) {
  if (!attribution.logo) return null;
  if (attribution.logo.type === "Text") {
    return <span className="font-semibold text-ink/65">{attribution.logo.value}</span>;
  }

  // MLS-controlled logo hosts vary by listing, so this compliance image is rendered directly.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={attribution.logo.value} alt={`${attribution.mlsName ?? "MLS"} IDX`} className={compact ? "max-h-6 max-w-24 object-contain" : "max-h-10 max-w-36 object-contain"} />;
}

export default function IdxAttribution({
  attribution,
  compact = false,
}: {
  attribution?: IdxAttributionData;
  compact?: boolean;
}) {
  if (!attribution) return null;

  return (
    <div className={compact ? "mt-3 border-t border-ink/10 pt-3 text-[10px] leading-relaxed text-ink/50" : "mt-8 border border-ink/10 bg-keystone-dim/40 rounded-sm p-5 text-xs leading-relaxed text-ink/60"}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <IdxLogo attribution={attribution} compact={compact} />
        {attribution.requiredFields.map((field) => (
          <span key={`${field.label}-${field.value}`}>
            <span className="font-medium text-ink/60">{field.label}:</span> {field.value}
          </span>
        ))}
      </div>
      {!compact && attribution.disclaimer && <p className="mt-3">{attribution.disclaimer}</p>}
    </div>
  );
}

export function IdxPageDisclaimer({ attribution }: { attribution?: IdxAttributionData }) {
  if (!attribution?.disclaimer) return null;
  return (
    <p className="mt-6 text-[11px] leading-relaxed text-ink/45">
      {attribution.disclaimer}
    </p>
  );
}
