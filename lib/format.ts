export function formatPrice(price: number): string {
  if (price >= 1_000_000) {
    const millions = price / 1_000_000;
    return `$${millions.toFixed(millions % 1 === 0 ? 0 : 2)}M`;
  }
  return `$${price.toLocaleString("en-US")}`;
}

export function formatFullPrice(price: number): string {
  return price.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function formatMileMarker(mm: number): string {
  return `MM ${mm.toFixed(1)}`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}
