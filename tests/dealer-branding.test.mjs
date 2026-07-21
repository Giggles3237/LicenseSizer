import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("new dealership profiles use readable collision-aware public links", async () => {
  const [route, data] = await Promise.all([
    readFile(new URL("../app/api/admin/profile/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/dealer-data.ts", import.meta.url), "utf8"),
  ]);
  assert.match(route, /createAvailablePublicSlug\(baseSlug\)/);
  assert.doesNotMatch(route, /organizationId\.slice/);
  assert.match(data, /suffix === 1 \? preferredSlug : `\$\{preferredSlug\}-\$\{suffix\}`/);
});

test("dealership landing pages expose branding, contact details, and a separate scan route", async () => {
  const [landing, scanner, editor] = await Promise.all([
    readFile(new URL("../app/d/[slug]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/d/[slug]/scan/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/landing-page-editor.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(landing, /profile\.landingHeadline/);
  assert.match(landing, /profile\.publicAddress/);
  assert.match(landing, /profile\.facebookUrl/);
  assert.match(landing, /Customer license intake/);
  assert.match(landing, /dealer-visit-summary/);
  assert.match(landing, /\/scan/);
  assert.match(scanner, /LicenseResizerApp/);
  assert.match(editor, /Choose logo/);
  assert.match(editor, /image\/png,image\/jpeg,image\/webp/);
  assert.match(editor, /180 KB/);
  assert.doesNotMatch(editor, /Logo URL or asset path/);
  for (const theme of ["Classic", "Modern", "Minimal"]) assert.match(editor, new RegExp(`>${theme}<`));
  assert.match(editor, /Live preview/);
});

test("Summit demo profile supports a bundled dealership logo", async () => {
  const [dealer, route] = await Promise.all([
    readFile(new URL("../lib/dealer.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/profile/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(dealer, /Summit Motor Group/);
  assert.match(dealer, /\/summit-logo\.png/);
  assert.match(route, /publicAssetOrExternalUrl\(body\.logoUrl\)/);
  assert.match(route, /imageDataUrl/);
  assert.match(route, /png\|jpeg\|webp/);
  assert.match(route, /250_000/);
});
