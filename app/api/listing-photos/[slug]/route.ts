import { NextResponse } from "next/server";
import { getListingDetail } from "@/lib/listing-detail";
import { getListingPhotos } from "@/lib/listing-photos";
import { listingKeyFromSlug } from "@/lib/listing-photo-pages";

export const dynamic = "force-dynamic";
export const maxDuration = 30;
const responseHeaders = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" };

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ error: "Open the gallery from the property page." }, { status: 403, headers: responseHeaders });
  }
  const { slug } = await context.params;
  if (!listingKeyFromSlug(slug)) {
    return NextResponse.json({ error: "Invalid property." }, { status: 400, headers: responseHeaders });
  }
  const result = await getListingDetail(slug);
  if (result.kind === "not-found" || (result.kind === "found" && !result.listing.idx)) {
    return NextResponse.json({ error: "Property not available." }, { status: 404, headers: responseHeaders });
  }
  if (result.kind === "unavailable") {
    return NextResponse.json({ error: "MLS photos are temporarily unavailable." }, { status: 503, headers: { ...responseHeaders, "Retry-After": "30" } });
  }
  try {
    const listing = result.listing;
    const images = await getListingPhotos(slug, listing.photoCount ?? 0, listing.listingUpdatedAt ?? "");
    return NextResponse.json({ images, complete: true }, { headers: responseHeaders });
  } catch {
    return NextResponse.json({ error: "More photos are temporarily unavailable. Your loaded photos are still available." }, { status: 503, headers: { ...responseHeaders, "Retry-After": "30" } });
  }
}
