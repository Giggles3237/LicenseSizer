import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { CARD_HEIGHT_POINTS, CARD_WIDTH_POINTS, cardPlacement } from "../lib/pdf.ts";
import { orientDocumentCorners } from "../lib/image-processing.ts";
import { mapGuideToVideoCorners } from "../lib/camera-geometry.ts";
import { detectDocumentWithOpenCv, warpDocumentWithOpenCv } from "../lib/opencv-document.ts";
import { cornersToEdgeLines, edgeLinesToCorners, extendLineToBounds, orderDocumentPoints, squareToQuadrilateral } from "../lib/document-geometry.ts";

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

test("preserves portrait crop orientation until the user chooses rotate", () => {
  const portrait = [
    { x: 0.3, y: 0.1 },
    { x: 0.55, y: 0.1 },
    { x: 0.55, y: 0.9 },
    { x: 0.3, y: 0.9 },
  ];
  const result = orientDocumentCorners(portrait);
  assert.equal(result.rotated, true);
  assert.ok(result.horizontal < result.vertical);
  assert.deepEqual(result.corners, portrait);
});

test("maps the visible camera guide into the full-resolution covered video", () => {
  const corners = mapGuideToVideoCorners(
    { left: 20, top: 300, width: 350, height: 221 },
    { left: 0, top: 0, width: 390, height: 844 },
    1920,
    1080,
  );
  assert.ok(corners[0].x > 0.37 && corners[0].x < 0.4);
  assert.ok(corners[1].x > 0.6 && corners[1].x < 0.63);
  assert.ok(corners[0].y > 0.34 && corners[0].y < 0.37);
  assert.ok(corners[2].y > 0.6 && corners[2].y < 0.63);
});

test("OpenCV analysis finds a four-corner card contour instead of copying the guide", async () => {
  globalThis.window ??= { cv: await Promise.resolve((await import("@techstark/opencv-js")).default) };
  globalThis.HTMLImageElement ??= class HTMLImageElement {};
  globalThis.HTMLCanvasElement ??= class HTMLCanvasElement {};
  globalThis.ImageData ??= class ImageData {
    constructor(data, width, height) { this.data = data; this.width = width; this.height = height; }
  };
  const width = 640;
  const height = 420;
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let offset = 0; offset < pixels.length; offset += 4) {
    pixels[offset] = 22; pixels[offset + 1] = 30; pixels[offset + 2] = 34; pixels[offset + 3] = 255;
  }
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const insideCard = x >= 100 + y * 0.08 && x <= 560 - y * 0.04 && y >= 80 && y <= 340;
      if (!insideCard) continue;
      const offset = (y * width + x) * 4;
      pixels[offset] = 230; pixels[offset + 1] = 228; pixels[offset + 2] = 218;
    }
  }
  const canvas = new globalThis.HTMLCanvasElement();
  canvas.width = width;
  canvas.height = height;
  canvas.getContext = () => ({ getImageData: () => new globalThis.ImageData(pixels, width, height) });
  const guide = [{ x: 0.08, y: 0.12 }, { x: 0.92, y: 0.12 }, { x: 0.92, y: 0.88 }, { x: 0.08, y: 0.88 }];
  const result = await detectDocumentWithOpenCv(canvas, guide);
  assert.equal(result?.found, true);
  assert.ok((result?.confidence ?? 0) > 0.75);
  assert.ok(Math.abs((result?.corners[0].x ?? 0) - guide[0].x) > 0.05);
});

test("OpenCV perspective correction maps exact manual corners to a rectangle", async () => {
  globalThis.HTMLImageElement ??= class HTMLImageElement {};
  globalThis.HTMLCanvasElement ??= class HTMLCanvasElement {};
  globalThis.ImageData ??= class ImageData {
    constructor(data, width, height) { this.data = data; this.width = width; this.height = height; }
  };
  const width = 240;
  const height = 180;
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let offset = 0; offset < pixels.length; offset += 4) pixels[offset + 3] = 255;
  const sourceCorners = [{ x: 40, y: 24 }, { x: 208, y: 42 }, { x: 190, y: 154 }, { x: 22, y: 132 }];
  const colors = [[255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 255, 0]];
  sourceCorners.forEach((corner, index) => {
    for (let y = corner.y - 8; y <= corner.y + 8; y += 1) {
      for (let x = corner.x - 8; x <= corner.x + 8; x += 1) {
        const offset = (y * width + x) * 4;
        pixels[offset] = colors[index][0]; pixels[offset + 1] = colors[index][1]; pixels[offset + 2] = colors[index][2];
      }
    }
  });
  const canvas = new globalThis.HTMLCanvasElement();
  canvas.width = width;
  canvas.height = height;
  canvas.getContext = () => ({ getImageData: () => new globalThis.ImageData(pixels, width, height) });
  const normalized = sourceCorners.map((point) => ({ x: point.x / (width - 1), y: point.y / (height - 1) }));
  const warped = await warpDocumentWithOpenCv(canvas, [normalized[2], normalized[0], normalized[3], normalized[1]], 160, 100);
  const pixel = (x, y) => Array.from(warped.data.slice((y * warped.width + x) * 4, (y * warped.width + x) * 4 + 3));
  assert.ok(pixel(2, 2)[0] > 180, "top-left should come from the red source corner");
  assert.ok(pixel(157, 2)[1] > 180, "top-right should come from the green source corner");
  assert.ok(pixel(157, 97)[2] > 180, "bottom-right should come from the blue source corner");
  const bottomLeft = pixel(2, 97);
  assert.ok(bottomLeft[0] > 180 && bottomLeft[1] > 180, "bottom-left should come from the yellow source corner");
});

test("lightweight perspective fallback maps all four unordered manual corners", () => {
  const points = [{ x: 0.82, y: 0.86 }, { x: 0.16, y: 0.14 }, { x: 0.88, y: 0.22 }, { x: 0.1, y: 0.8 }];
  const ordered = orderDocumentPoints(points);
  const transform = squareToQuadrilateral(ordered, 1000, 800);
  const project = (u, v) => {
    const divisor = transform.g * u + transform.h * v + 1;
    return { x: (transform.a * u + transform.b * v + transform.c) / divisor, y: (transform.d * u + transform.e * v + transform.f) / divisor };
  };
  const expected = ordered.map((point) => ({ x: point.x * 999, y: point.y * 799 }));
  [[0, 0], [1, 0], [1, 1], [0, 1]].forEach(([u, v], index) => {
    const actual = project(u, v);
    assert.ok(Math.abs(actual.x - expected[index].x) < 0.001);
    assert.ok(Math.abs(actual.y - expected[index].y) < 0.001);
  });
});

test("independent edge lines extend to the photo bounds and intersect into the crop", () => {
  const expected = [{ x: 0.18, y: 0.2 }, { x: 0.84, y: 0.16 }, { x: 0.88, y: 0.82 }, { x: 0.12, y: 0.86 }];
  const lines = cornersToEdgeLines(expected);
  lines[0].start.y += 0.01;
  const visible = extendLineToBounds(lines[0]);
  assert.ok(visible.start.x < 0.001 || visible.start.y < 0.001 || visible.end.x > 0.999 || visible.end.y > 0.999);
  const intersections = edgeLinesToCorners(lines);
  assert.ok(intersections);
  assert.equal(intersections.length, 4);
  assert.ok(intersections.every((point) => point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1));
  assert.notDeepEqual(intersections[0], expected[0], "moving one line end should change its intersections independently");
});

test("edge labels retain screen order for portrait crops", () => {
  const portrait = [{ x: 0.35, y: 0.08 }, { x: 0.62, y: 0.12 }, { x: 0.65, y: 0.91 }, { x: 0.31, y: 0.87 }];
  const lines = cornersToEdgeLines(portrait);
  assert.ok(lines[0].start.y < lines[2].start.y, "top line must stay above bottom line");
  assert.ok(lines[1].start.x > lines[3].start.x, "right line must stay right of left line");
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
  assert.match(component, /registration\.update\(\)/);
  assert.match(component, /disabled=\{!interactive\}/);
  assert.match(serviceWorker, /license-sizer-shell-v8/);
  assert.match(serviceWorker, /\["document", "script", "style", "font", "manifest"\]/);
  assert.match(serviceWorker, /fetch\(request\)[\s\S]*catch\(\(\) => caches\.match\(request\)\)/);
  assert.doesNotMatch(serviceWorker, /request\.destination.*image/);
});
