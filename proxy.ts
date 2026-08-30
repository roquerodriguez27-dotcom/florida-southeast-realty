import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

const INVALID_PROPERTY_SLUGS = new Set(["null", "undefined", "false", "nan"]);
const NON_SEARCH_CRAWLER_USER_AGENT = /(semrush|ahrefs|mj12bot|dotbot|bytespider|petalbot|dataforseobot|seekportbot|googleother)/i;

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
    && NON_SEARCH_CRAWLER_USER_AGENT.test(request.headers.get("user-agent") ?? "")
  ) {
    return new NextResponse(null, {
      status: 204,
      headers: {
        "Cache-Control": "public, max-age=3600",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  }

  return updateSession(request);
}

export const config = {
  matcher: ["/crm/:path*", "/properties/:path*", "/buyer-tools"],
};
