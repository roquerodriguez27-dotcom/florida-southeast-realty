export default function Tideline({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-4">
      <div className="tideline flex-1" />
      {label && (
        <span className="mile-marker text-xs text-brass shrink-0">{label}</span>
      )}
      {label && <div className="tideline flex-1" />}
    </div>
  );
}
