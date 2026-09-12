import type { MetadataRoute } from "next";
import { getAllCommunities } from "@/lib/communities";
import { getGuides, getBlogPosts } from "@/lib/content";
import { SITE } from "@/lib/site-config";
import { SEARCH_MARKETS } from "@/lib/seo/search-markets";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [communities, guides, posts] = await Promise.all([
    getAllCommunities(),
    getGuides(),
    getBlogPosts(),
  ]);

  const staticPaths = [
    "",
    "/properties",
    "/sellers",
    "/communities",
    "/fort-lauderdale-homes-for-sale",
    "/research",
    "/buyer-tools",
    "/home-valuation",
    "/guides",
    "/blog",
    "/about",
    "/join",
    "/testimonials",
    "/contact",
    "/referral-status",
  ];

  const staticRoutes: MetadataRoute.Sitemap = staticPaths.map((route) => ({
    url: `${SITE.url}${route}`,
    changeFrequency: route === "" || route === "/blog" || route === "/fort-lauderdale-homes-for-sale" ? "weekly" : "monthly",
    priority: route === "" || route === "/sellers"
      ? 1
      : route === "/communities" || route === "/research" || route === "/fort-lauderdale-homes-for-sale"
        ? 0.9
        : 0.7,
  }));

  const communityRoutes: MetadataRoute.Sitemap = communities.map((community) => ({
    url: `${SITE.url}/communities/${community.slug}`,
    changeFrequency: "weekly",
    priority: 0.9,
  }));

  const searchMarketRoutes: MetadataRoute.Sitemap = SEARCH_MARKETS.map((market) => ({
    url: `${SITE.url}/homes-for-sale/${market.slug}`,
    changeFrequency: "weekly",
    priority: market.kind === "county" ? 0.95 : 0.85,
  }));

  const guideRoutes: MetadataRoute.Sitemap = guides.map((guide) => ({
    url: `${SITE.url}/guides/${guide.slug}`,
    lastModified: guide.publishedAt,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  const postRoutes: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${SITE.url}/blog/${post.slug}`,
    lastModified: post.publishedAt,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  // Individual MLS listings remain indexable and are linked from the site, but
  // they are intentionally excluded from the XML sitemap. They are short-lived,
  // widely syndicated URLs and previously caused search crawlers to create large
  // bursts of live BeachesMLS traffic. The sitemap is reserved for durable pages
  // that should accumulate long-term local-search authority.
  return [...staticRoutes, ...searchMarketRoutes, ...communityRoutes, ...guideRoutes, ...postRoutes];
}
