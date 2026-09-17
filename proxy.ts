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
    || pathname === "/buyer-tools"
    || pathname === "/home-valuation"
    || pathname.startsWith("/homes-for-sale/")
    || pathname === "/fort-lauderdale-homes-for-sale";
}

function isPublicPagePath(pathname: string): boolean {
  if (
    pathname.startsWith("/api/")
    || pathname === "/api"
    || pathname.startsWith("/crm")
    || pathname.startsWith("/_next/")
    || pathname.startsWith("/.well-known/")
    || pathname === "/robots.txt"
    || pathname === "/sitemap.xml"
    || pathname === "/favicon.ico"
  ) return false;

  // Do not run document-navigation heuristics against images, fonts, scripts,
  // downloadable files, or other static assets requested by real browsers.
  const lastSegment = pathname.split("/").pop() ?? "";
  return !/\.[a-z0-9]{2,8}$/i.test(lastSegment);
}

function blockedAutomationResponse(): NextResponse {
  // Never edge-cache a bot rejection. A cached 204 could otherwise be reused
  // for a legitimate buyer request that reaches the same URL later.
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

function browserVerificationResponse(): NextResponse {
  // This is intentionally limited to direct browser navigations on MLS-heavy
  // routes. Verified search crawlers/social previews bypass it, and Next.js
  // RSC transitions from an already-open page are left alone. Raw HTTP
  // scrapers that merely spoof Chrome/Safari do not execute this JavaScript,
  // so they never reach the expensive MLS render on the retry.
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>Checking your browser…</title>
</head>
<body>
  <main style="font-family:system-ui,-apple-system,sans-serif;max-width:34rem;margin:12vh auto;padding:1.5rem;text-align:center">
    <h1 style="font-size:1.25rem">Checking your browser…</h1>
    <p>One moment while we protect live property searches.</p>
    <noscript>JavaScript is required to view live property search results.</noscript>
  </main>
  <script>
    document.cookie = "fsr_browser_verified=1; Max-Age=21600; Path=/; SameSite=Lax; Secure";
    location.reload();
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

function isRecognizedCrawler(userAgent: string): boolean {
  return MAJOR_SEARCH_CRAWLER_USER_AGENT.test(userAgent)
    || SOCIAL_PREVIEW_USER_AGENT.test(userAgent)
    || AUTOMATION_USER_AGENT.test(userAgent);
}

function isBrowserNavigationRequest(request: NextRequest): boolean {
  const accept = request.headers.get("accept") ?? "";
  const fetchMode = request.headers.get("sec-fetch-mode") ?? "";
  const fetchDest = request.headers.get("sec-fetch-dest") ?? "";
  const isRscRequest = request.headers.get("rsc") === "1"
    || request.headers.has("next-router-state-tree");

  // Next.js client-side navigations legitimately request RSC payloads rather
  // than a full HTML document, so they must pass this check.
  if (isRscRequest) return true;

  // Fail open when older/privacy-focused browsers omit fetch metadata, but
  // reject contradictory headers from raw HTTP clients spoofing browser UAs.
  if (accept && !accept.includes("text/html")) return false;
  if (fetchMode && fetchMode !== "navigate") return false;
  if (fetchDest && fetchDest !== "document") return false;
  return true;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const userAgent = request.headers.get("user-agent") ?? "";
  const mlsHeavyPath = isMlsHeavyPath(pathname);
  const publicPagePath = isPublicPagePath(pathname);

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

  // The September crawler waves did not stay on MLS routes: they swept
  // research, contact, seller, join, and other public pages before fanning
  // into property URLs. Stop known automation at the first public page it
  // requests, while preserving verified search crawlers and social previews.
  if (
    publicPagePath
    && AUTOMATION_USER_AGENT.test(userAgent)
    && !MAJOR_SEARCH_CRAWLER_USER_AGENT.test(userAgent)
    && !SOCIAL_PREVIEW_USER_AGENT.test(userAgent)
  ) {
    return blockedAutomationResponse();
  }

  // Drop generic programmatic clients that do not present as a browser or a
  // recognized search/social crawler. Normal desktop/mobile browsers are not
  // affected, and this prevents simple scraper clients from bypassing bot-name
  // checks with an empty or custom User-Agent.
  if (
    publicPagePath
    && request.method === "GET"
    && !MAJOR_SEARCH_CRAWLER_USER_AGENT.test(userAgent)
    && !SOCIAL_PREVIEW_USER_AGENT.test(userAgent)
    && (!userAgent || !BROWSER_USER_AGENT.test(userAgent))
  ) {
    return blockedAutomationResponse();
  }

  // Some scrapers evade User-Agent checks by claiming to be Chrome/Safari.
  // Real top-level browsers advertise HTML/document navigation semantics, and
  // Next.js client transitions are tagged as RSC requests. Block browser-UA
  // requests whose headers contradict both legitimate patterns.
  if (
    publicPagePath
    && request.method === "GET"
    && BROWSER_USER_AGENT.test(userAgent)
    && !MAJOR_SEARCH_CRAWLER_USER_AGENT.test(userAgent)
    && !SOCIAL_PREVIEW_USER_AGENT.test(userAgent)
    && !isBrowserNavigationRequest(request)
  ) {
    return blockedAutomationResponse();
  }

  // A browser-looking raw scraper can satisfy header checks by copying Chrome
  // navigation headers. For direct navigations to MLS-heavy pages, require one
  // tiny JavaScript round-trip before rendering live listing data. This is not
  // applied to ordinary marketing pages, verified crawlers, social previews,
  // APIs, CRM, or Next.js RSC client transitions.
  const isRscRequest = request.headers.get("rsc") === "1"
    || request.headers.has("next-router-state-tree");
  if (
    mlsHeavyPath
    && request.method === "GET"
    && BROWSER_USER_AGENT.test(userAgent)
    && !MAJOR_SEARCH_CRAWLER_USER_AGENT.test(userAgent)
    && !SOCIAL_PREVIEW_USER_AGENT.test(userAgent)
    && !isRscRequest
    && isBrowserNavigationRequest(request)
    && request.cookies.get("fsr_browser_verified")?.value !== "1"
  ) {
    return browserVerificationResponse();
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
  // Apply bot heuristics to all document routes, not only MLS pages. API
  // endpoints and Next.js/static assets are excluded so saved-search workers,
  // analytics, images, scripts, and styles keep their existing behavior.
  matcher: [
    "/crm/:path*",
    "/((?!api(?:/|$)|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
