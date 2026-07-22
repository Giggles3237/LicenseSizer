import type { MetadataRoute } from "next";
import { absoluteUrl, getAllBlogPosts } from "../lib/blog";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes = ["", "/blog", "/capture", "/privacy", "/security", "/terms", "/support", "/subprocessors"].map((route) => ({
    url: absoluteUrl(route || "/"),
    lastModified: new Date(),
  }));
  const posts = await getAllBlogPosts({ includeDrafts: false });

  return [
    ...staticRoutes,
    ...posts.map((post) => ({
      url: absoluteUrl(`/blog/${post.slug}`),
      lastModified: new Date(post.updatedAt || post.publishedAt),
    })),
  ];
}
