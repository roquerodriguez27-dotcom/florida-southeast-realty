import type { MetadataRoute } from "next";
import { getAllListings } from "@/lib/listings";
import { getAllCommunities } from "@/lib/communities";
import { getGuides, getBlogPosts } from "@/lib/content";

const SITE_URL = "https://www.floridasoutheastrealty.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [listings, communities, guides, posts] = await Promise.all([
    getAllListings(),
    getAllCommunities(),
    getGuides(),
    getBlogPosts(),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    "", "/properties", "/sellers", "/communities", "/home-valuation", "/guides", "/blog", "/about", "/contact", "/accessibility-statement",
  ].map((route) => ({
    url: `${SITE_URL}${route}`,
    changeFrequency: route === "" || route === "/properties" ? "daily" : "weekly",
    priority: route === "" || route === "/sellers" ? 1 : 0.7,
  }));

  const listingRoutes: MetadataRoute.Sitemap = listings.map((l) => ({
    url: `${SITE_URL}/properties/${l.slug}`,
    changeFrequency: "daily",
    priority: 0.9,
  }));

  const communityRoutes: MetadataRoute.Sitemap = communities.map((c) => ({
    url: `${SITE_URL}/communities/${c.slug}`,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const guideRoutes: MetadataRoute.Sitemap = guides.map((g) => ({
    url: `${SITE_URL}/guides/${g.slug}`,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  const postRoutes: MetadataRoute.Sitemap = posts.map((p) => ({
    url: `${SITE_URL}/blog/${p.slug}`,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...staticRoutes, ...listingRoutes, ...communityRoutes, ...guideRoutes, ...postRoutes];
}
