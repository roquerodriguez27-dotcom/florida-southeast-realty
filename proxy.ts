import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

const INVALID_PROPERTY_SLUGS = new Set(["null", "undefined", "false", "nan"]);
const NON_SEARCH_CRAWLER_USER_AGENT = /(semrush|ahrefs|mj12bot|dotbot|bytespider|petalbot|dataforseobot|seekportbot|googleother)/i;
const CRAWLER_USER_AGENT = /(bot|crawler|spider|slurp|bingpreview|facebookexternalhit|linkedinbot|twitterbot|google-inspectiontool|semrush|ahrefs|mj12bot|dotbot|bytespider|petalbot|dataforseobot|seekportbot)/i;
const PROPERTY_FILTER_PARAMETERS = new Set([
  "q",
  "location",
  "minPrice",
  "maxPrice",
  "beds",
  "baths",
  "minSqft",
  "maxSqft",
  "minLotSqft",
  "maxLotSqft",
  "minYearBuilt",
  "maxYearBuilt",
  "listingStatus",
  "type",
  "waterfront",
  "pool",
  "garage",
  "garageSpaces",
  "newConstruction",
  "senior",
  "noHoa",
  "maxHoa",
  "priceReduced",
  "maxTaxes",
  "style",
  "viewType",
  "cooling",
  "heating",
  "fireplace",
  "amenity",
  "maxDom",
  "newer",
  "spacious",
  "largeLot",
  "page",
  "north",
  "south",
  "east",
  "west",
  "view",
  "sort",
  "shape",
]);

function hasPropertySearchParameters(request: NextRequest): boolean {
  return [...request.nextUrl.searchParams.keys()].some((key) => (
    PROPERTY_FILTER_PARAMETERS.has(key)
  ));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const userAgent = request.headers.get("user-agent") ?? "";

  if (pathname.startsWith("/properties/")) {
    const slug = pathname.slice("/properties/".length).trim().toLowerCase();
    if (!slug || INVALID_PROPERTY_SLUGS.has(slug)) {
      const target = request.nextUrl.clone();
      target.pathname = "/properties";
      target.search = "";
      return NextResponse.redirect(target, 308);
    }
  }

  // Third-party/non-indexing crawlers can fan out across hundreds of dynamic
  // MLS URLs at once. Do not spend BeachesMLS request capacity rendering those
  // pages. Major search indexers are intentionally not included here.
  if (
    (pathname === "/properties" || pathname.startsWith("/properties/") || pathname === "/buyer-tools")
    && NON_SEARCH_CRAWLER_USER_AGENT.test(userAgent)
  ) {
    return new NextResponse(null, {
      status: 204,
      headers: {
        "Cache-Control": "public, max-age=3600",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  }

  // Filter combinations and pagination URLs canonicalize to /properties and
  // have no independent SEO value. Redirect crawlers before the page renders
  // so they cannot fan out across thousands of unique live MLS searches. Real
  // buyers, including people opening a shared filtered-search URL, are not
  // affected by this rule.
  if (
    pathname === "/properties"
    && CRAWLER_USER_AGENT.test(userAgent)
    && hasPropertySearchParameters(request)
  ) {
    const target = request.nextUrl.clone();
    target.search = "";
    const response = NextResponse.redirect(target, 308);
    response.headers.set("Cache-Control", "public, max-age=3600");
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    return response;
  }

  // Supabase session refresh is only needed by the private CRM. Running it on
  // every public listing request adds avoidable work and can prevent otherwise
  // cacheable MLS pages from staying cheap.
  if (pathname.startsWith("/crm")) return updateSession(request);
  return NextResponse.next();
}

export const config = {
  matcher: ["/crm/:path*", "/properties/:path*", "/buyer-tools"],
};
