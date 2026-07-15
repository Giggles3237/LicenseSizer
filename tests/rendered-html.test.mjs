import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { CARD_HEIGHT_POINTS, CARD_WIDTH_POINTS, cardPlacement } from "../lib/pdf.ts";

const root = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html", host: "localhost" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the LicenseSizer application shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>LicenseSizer/);
  assert.match(html, /A true-size license copy/);
  assert.match(html, /Processed on this device/);
  assert.match(html, /Scan a license/);
  assert.match(html, /does not verify identity/i);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("uses exact nominal ID-1 PDF geometry", () => {
  assert.ok(Math.abs(CARD_WIDTH_POINTS - 242.6456692913) < 0.000001);
  assert.ok(Math.abs(CARD_HEIGHT_POINTS - 153.0141732283) < 0.000001);
  const placement = cardPlacement(612, 792, 2);
  assert.ok(placement.x > 0);
  assert.ok(placement.secondY > 0);
  assert.ok(Math.abs(placement.firstY - placement.secondY - CARD_HEIGHT_POINTS - 36) < 0.000001);
});

test("removes the disposable starter and avoids sensitive persistence", async () => {
  const [component, serviceWorker, packageJson] = await Promise.all([
    readFile(new URL("app/license-sizer-app.tsx", root), "utf8"),
    readFile(new URL("public/sw.js", root), "utf8"),
    readFile(new URL("package.json", root), "utf8"),
  ]);
  await assert.rejects(access(new URL("app/_sites-preview/SkeletonPreview.tsx", root)));
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.doesNotMatch(component, /localStorage|sessionStorage|indexedDB/);
  assert.match(component, /revokeObjectURL/);
  assert.match(component, /getTracks\(\).*track\.stop/);
  assert.match(serviceWorker, /\["document", "script", "style", "font", "manifest"\]/);
  assert.doesNotMatch(serviceWorker, /request\.destination.*image/);
});
