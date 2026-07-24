import type { Metadata } from "next";
import Link from "next/link";
import LicenseResizerBrand from "../brand-logo";
import { absoluteUrl, formatBlogDate, getAllBlogPosts } from "../../lib/blog";
import LicenseResizerTrialCTA from "./trial-cta";

export const metadata: Metadata = {
  title: "LicenseResizer Blog - Dealership document workflows",
  description: "Field notes on private license collection, dealership handoffs, and cleaner document workflows.",
  alternates: { canonical: absoluteUrl("/blog") },
  openGraph: {
    title: "LicenseResizer Blog",
    description: "Field notes on private license collection, dealership handoffs, and cleaner document workflows.",
    url: absoluteUrl("/blog"),
    type: "website",
    images: [{ url: "/og.png", width: 1536, height: 896, alt: "LicenseResizer private license collection for dealerships" }],
  },
};

export default async function BlogIndexPage() {
  const posts = await getAllBlogPosts();
  const [featured, ...rest] = posts;

  return (
    <main className="blog-shell">
      <header className="blog-header">
        <LicenseResizerBrand />
        <nav aria-label="Blog navigation"><Link href="/">Home</Link><Link href="/capture">Demo</Link><Link href="/sign-in">Sign in</Link></nav>
      </header>

      <section className="blog-hero">
        <p className="marketing-kicker"><span /> LicenseResizer Blog</p>
        <h1>Better license collection, one handoff at a time.</h1>
        <p>Practical notes for dealership teams replacing blurry texts, manual cropping, and uncertain document handoffs with a cleaner customer workflow.</p>
      </section>

      {featured ? (
        <section className="blog-featured" aria-label="Featured article">
          <div>
            <span className="step-kicker">Featured</span>
            <h2><Link href={`/blog/${featured.slug}`}>{featured.title}</Link></h2>
            <p>{featured.description}</p>
            <div className="blog-meta"><span>{formatBlogDate(featured.publishedAt)}</span><span>{featured.readingTime}</span><span>{featured.author}</span></div>
          </div>
          <Link className="text-cta" href={`/blog/${featured.slug}`}>Read article <span aria-hidden="true">-&gt;</span></Link>
        </section>
      ) : null}

      <section className="blog-grid" aria-label="All articles">
        {rest.map((post) => (
          <article className="blog-card" key={post.slug}>
            <div className="blog-card-top"><span>{formatBlogDate(post.publishedAt)}</span><span>{post.readingTime}</span></div>
            <h2><Link href={`/blog/${post.slug}`}>{post.title}</Link></h2>
            <p>{post.description}</p>
            <Link href={`/blog/${post.slug}`}>Read more <span aria-hidden="true">-&gt;</span></Link>
          </article>
        ))}
      </section>

      <LicenseResizerTrialCTA />
    </main>
  );
}
