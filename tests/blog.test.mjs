import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("local MDX blog keeps production posts static and discoverable", async () => {
  const [blogLib, indexPage, postPage, sitemap, components, cta, samplePost] = await Promise.all([
    readFile(new URL("../lib/blog.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/blog/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/blog/[slug]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/sitemap.ts", import.meta.url), "utf8"),
    readFile(new URL("../mdx-components.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/blog/trial-cta.tsx", import.meta.url), "utf8"),
    readFile(new URL("../content/blog/private-license-collection.mdx", import.meta.url), "utf8"),
  ]);

  for (const field of ["title", "description", "publishedAt", "updatedAt", "author", "slug", "image", "draft"]) {
    assert.match(samplePost, new RegExp(`${field}:`));
  }

  assert.match(blogLib, /content", "blog"/);
  assert.match(blogLib, /\.filter\(\(post\) => includeDrafts \|\| !post\.draft\)/);
  assert.match(blogLib, /readingTimeFor/);
  assert.match(indexPage, /getAllBlogPosts/);
  assert.match(postPage, /generateStaticParams/);
  assert.match(postPage, /includeDrafts: false/);
  assert.match(postPage, /dynamicParams = false/);
  assert.match(postPage, /"@type": "Article"/);
  assert.match(postPage, /getRelatedBlogPosts/);
  assert.match(sitemap, /\/blog\/\$\{post\.slug\}/);
  assert.match(components, /LicenseResizerTrialCTA/);
  assert.match(cta, /data-analytics="start-free-trial"/);
});
