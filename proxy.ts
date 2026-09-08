import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

const INVALID_PROPERTY_SLUGS = new Set(["null", "undefined", "false", "nan"]);
const MAJOR_SEARCH_CRAWLER_USER_AGENT = /(googlebot|bingbot|applebot|duckduckbot|yandexbot|google-inspectiontool)/i;
const SOCIAL_PREVIEW_USER_AGENT = /(facebookexternalhit|linkedinbot|twitterbot|slackbot|discordbot|whatsapp)/i;
const AUTOMATION_USER_AGENT = /(bot|crawler|spider|slurp|semrush|ahrefs|mj12bot|dotbot|bytespider|petalbot|dataforseobot|seekportbot|googleother|headless|python-requests|python\/|curl\/|wget\/|scrapy|httpclient|node-fetch|axios|go-http-client|java\/|okhttp|libwww|zgrab|masscan)/i;
const BROWSER_USER_AGENT = /(mozilla\/5\.0|applewebkit|chrome|safari|firefox|edg|opr)/i;
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

function isMlsHeavyPath(pathname: string): boolean {
  return pathname === "/properties"
    || pathname.startsWith("/properties/")
    || pathname.startsWith("/communities/")
    || pathname === "/buyer-tools";
}

function isRecognizedCrawler(userAgent: string): boolean {
  return MAJOR_SEARCH_CRAWLER_USER_AGENT.test(userAgent)
    || SOCIAL_PREVIEW_USER_AGENT.test(userAgent)
    || AUTOMATION_USER_AGENT.test(userAgent);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const userAgent = request.headers.get("user-agent") ?? "";
  const mlsHeavyPath = isMlsHeavyPath(pathname);

  if (pathname.startsWith("/properties/")) {
    const slug = pathname.slice("/properties/".length).trim().toLowerCase();
    if (!slug || INVALID_PROPERTY_SLUGS.has(slug)) {
      const target = request.nextUrl.clone();
      target.pathname = "/properties";
      target.search = "";
      const response = NextResponse.redirect(target, 308);
      response.headers.set("Cache-Control", "public, max-age=86400, stale-while-revalidate=86400");
      response.headers.set("X-Robots-Tag", "noindex, nofollow");
      return response;
    }
  }

  // MLS routes are expensive because an uncached request can trigger a live
  // BeachesMLS RESO call. Keep major search engines and social link previews,
  // but stop SEO scrapers, AI crawlers, headless clients, and other automation
  // from consuming the same upstream capacity as real buyers.
  if (
    mlsHeavyPath
    && AUTOMATION_USER_AGENT.test(userAgent)
    && !MAJOR_SEARCH_CRAWLER_USER_AGENT.test(userAgent)
    && !SOCIAL_PREVIEW_USER_AGENT.test(userAgent)
  ) {
    return new NextResponse(null, {
      status: 204,
      headers: {
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=3600",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  }

  // Drop generic programmatic clients that do not present as a browser or a
  // recognized search/social crawler. Normal desktop/mobile browsers are not
  // affected, and this prevents simple scraper clients from bypassing bot-name
  // checks with an empty or custom User-Agent.
  if (
    mlsHeavyPath
    && request.method === "GET"
    && !MAJOR_SEARCH_CRAWLER_USER_AGENT.test(userAgent)
    && !SOCIAL_PREVIEW_USER_AGENT.test(userAgent)
    && (!userAgent || !BROWSER_USER_AGENT.test(userAgent))
  ) {
    return new NextResponse(null, {
      status: 204,
      headers: {
        "Cache-Control": "public, max-age=900, stale-while-revalidate=900",
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
    && isRecognizedCrawler(userAgent)
    && hasPropertySearchParameters(request)
  ) {
    const target = request.nextUrl.clone();
    target.search = "";
    const response = NextResponse.redirect(target, 308);
    response.headers.set("Cache-Control", "public, max-age=3600, stale-while-revalidate=3600");
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
  matcher: ["/crm/:path*", "/properties/:path*", "/communities/:path*", "/buyer-tools"],
};
