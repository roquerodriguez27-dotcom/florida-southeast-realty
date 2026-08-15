import type { MetadataRoute } from "next";
import { getAllListings } from "@/lib/listings";
import { getAllCommunities } from "@/lib/communities";
import { getGuides, getBlogPosts } from "@/lib/content";
import { IDX_PROVIDER } from "@/lib/idx";
import { SITE } from "@/lib/site-config";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [listings, communities, guides, posts] = await Promise.all([
    getAllListings(),
    getAllCommunities(),
    getGuides(),
    getBlogPosts(),
  ]);

  const idxLive = IDX_PROVIDER !== "not_connected";
  const staticPaths = [
    "",
    "/sellers",
    "/communities",
    "/research",
    "/home-valuation",
    "/guides",
    "/blog",
    "/about",
    "/testimonials",
    "/contact",
    "/accessibility-statement",
  ];
  if (idxLive) staticPaths.splice(1, 0, "/properties");

  const staticRoutes: MetadataRoute.Sitemap = staticPaths.map((route) => ({
    url: `${SITE.url}${route}`,
    changeFrequency: route === "" ? "weekly" : route === "/blog" ? "weekly" : "monthly",
    priority: route === "" || route === "/sellers" ? 1 : route === "/communities" || route === "/research" ? 0.9 : 0.7,
  }));

  const listingRoutes: MetadataRoute.Sitemap = idxLive
    ? listings.map((listing) => ({
        url: `${SITE.url}/properties/${listing.slug}`,
        changeFrequency: "daily",
        priority: 0.8,
      }))
    : [];

  const communityRoutes: MetadataRoute.Sitemap = communities.map((community) => ({
    url: `${SITE.url}/communities/${community.slug}`,
    changeFrequency: "monthly",
    priority: 0.9,
  }));

  const guideRoutes: MetadataRoute.Sitemap = guides.map((guide) => ({
    url: `${SITE.url}/guides/${guide.slug}`,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  const postRoutes: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${SITE.url}/blog/${post.slug}`,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...staticRoutes, ...communityRoutes, ...listingRoutes, ...guideRoutes, ...postRoutes];
}
