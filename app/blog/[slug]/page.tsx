import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import LicenseResizerBrand from "../../brand-logo";
import LicenseResizerTrialCTA from "../trial-cta";
import { useMDXComponents } from "../../../mdx-components";
import { absoluteUrl, formatBlogDate, getAllBlogPosts, getBlogPost, getRelatedBlogPosts } from "../../../lib/blog";

type BlogPostPageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamicParams = false;

export async function generateStaticParams() {
  const posts = await getAllBlogPosts({ includeDrafts: false });
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPost(slug);
  if (!post) return {};

  const canonical = absoluteUrl(`/blog/${post.slug}`);
  const image = post.image || "/og.png";

  return {
    title: `${post.title} - LicenseResizer Blog`,
    description: post.description,
    alternates: { canonical },
    openGraph: {
      title: post.title,
      description: post.description,
      url: canonical,
      type: "article",
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt || post.publishedAt,
      authors: [post.author],
      images: [{ url: image, width: 1536, height: 896, alt: post.title }],
    },
    twitter: { card: "summary_large_image", title: post.title, description: post.description, images: [image] },
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = await getBlogPost(slug);
  if (!post) notFound();

  const related = await getRelatedBlogPosts(post.slug);
  const mdxComponents = useMDXComponents({});
  const canonical = absoluteUrl(`/blog/${post.slug}`);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt || post.publishedAt,
    author: { "@type": "Person", name: post.author },
    image: post.image ? absoluteUrl(post.image) : absoluteUrl("/og.png"),
    mainEntityOfPage: canonical,
    publisher: {
      "@type": "Organization",
      name: "LicenseResizer",
      logo: { "@type": "ImageObject", url: absoluteUrl("/favicon.svg") },
    },
  };

  return (
    <main className="blog-shell">
      <header className="blog-header">
        <LicenseResizerBrand />
        <nav aria-label="Blog navigation"><Link href="/blog">Blog</Link><Link href="/capture">Demo</Link><Link href="/sign-in">Sign in</Link></nav>
      </header>

      <article className="blog-article">
        <Link className="back-link" href="/blog">Back to blog</Link>
        <header className="blog-article-hero">
          <p className="marketing-kicker"><span /> Field note</p>
          <h1>{post.title}</h1>
          <p>{post.description}</p>
          <div className="blog-meta">
            <span>{formatBlogDate(post.publishedAt)}</span>
            {post.updatedAt ? <span>Updated {formatBlogDate(post.updatedAt)}</span> : null}
            <span>{post.readingTime}</span>
            <span>{post.author}</span>
          </div>
        </header>

        <div className="blog-prose">
          <MDXRemote source={post.content} components={mdxComponents} />
        </div>
      </article>

      <LicenseResizerTrialCTA />

      {related.length ? (
        <section className="related-articles" aria-label="Related articles">
          <div className="related-heading">
            <span className="step-kicker">Keep reading</span>
            <h2>Related articles</h2>
          </div>
          <div className="blog-grid compact">
            {related.map((relatedPost) => (
              <article className="blog-card" key={relatedPost.slug}>
                <div className="blog-card-top"><span>{formatBlogDate(relatedPost.publishedAt)}</span><span>{relatedPost.readingTime}</span></div>
                <h3><Link href={`/blog/${relatedPost.slug}`}>{relatedPost.title}</Link></h3>
                <p>{relatedPost.description}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </main>
  );
}
