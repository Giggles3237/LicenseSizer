import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

export type BlogFrontmatter = {
  title: string;
  description: string;
  publishedAt: string;
  updatedAt?: string;
  author: string;
  slug: string;
  image?: string;
  draft?: boolean;
};

export type BlogPost = BlogFrontmatter & {
  content: string;
  readingTime: string;
};

const BLOG_DIR = path.join(process.cwd(), "content", "blog");
const WORDS_PER_MINUTE = 225;

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://licenseresizer.com";

function productionBuild() {
  return process.env.NODE_ENV === "production";
}

function plainText(source: string) {
  return source
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/[#{}`*_~>\-[\]()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function readingTimeFor(source: string) {
  const words = plainText(source).split(" ").filter(Boolean).length;
  return `${Math.max(1, Math.ceil(words / WORDS_PER_MINUTE))} min read`;
}

function normalizePost(fileName: string, raw: string): BlogPost {
  const parsed = matter(raw);
  const data = parsed.data as Partial<BlogFrontmatter>;
  const slug = data.slug || fileName.replace(/\.mdx$/, "");

  if (!data.title || !data.description || !data.publishedAt || !data.author) {
    throw new Error(`Blog post ${fileName} is missing required frontmatter.`);
  }

  return {
    title: data.title,
    description: data.description,
    publishedAt: data.publishedAt,
    updatedAt: data.updatedAt,
    author: data.author,
    slug,
    image: data.image,
    draft: Boolean(data.draft),
    content: parsed.content,
    readingTime: readingTimeFor(parsed.content),
  };
}

async function readBlogFiles() {
  try {
    const entries = await fs.readdir(BLOG_DIR);
    return entries.filter((entry) => entry.endsWith(".mdx"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

export async function getAllBlogPosts({ includeDrafts = !productionBuild() } = {}) {
  const files = await readBlogFiles();
  const posts = await Promise.all(
    files.map(async (fileName) => normalizePost(fileName, await fs.readFile(path.join(BLOG_DIR, fileName), "utf8"))),
  );

  return posts
    .filter((post) => includeDrafts || !post.draft)
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
}

export async function getBlogPost(slug: string) {
  const posts = await getAllBlogPosts();
  return posts.find((post) => post.slug === slug);
}

export async function getRelatedBlogPosts(slug: string, limit = 3) {
  const posts = await getAllBlogPosts();
  const current = posts.find((post) => post.slug === slug);
  if (!current) return [];

  return posts
    .filter((post) => post.slug !== slug)
    .sort((a, b) => {
      const authorMatch = Number(b.author === current.author) - Number(a.author === current.author);
      if (authorMatch !== 0) return authorMatch;
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    })
    .slice(0, limit);
}

export function absoluteUrl(pathname: string) {
  return new URL(pathname, SITE_URL).toString();
}

export function formatBlogDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}
