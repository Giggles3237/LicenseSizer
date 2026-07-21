import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { CARD_HEIGHT_POINTS, CARD_WIDTH_POINTS, cardPlacement } from "../lib/pdf.ts";
import { orientDocumentCorners, prioritizeCropCandidates } from "../lib/image-processing.ts";
import { mapGuideToVideoCorners } from "../lib/camera-geometry.ts";
import { detectDocumentCandidatesWithOpenCv, detectDocumentWithOpenCv, warpDocumentWithOpenCv } from "../lib/opencv-document.ts";
import { cornersToEdgeLines, edgeLinesToCorners, extendLineToBounds, orderDocumentPoints, squareToQuadrilateral } from "../lib/document-geometry.ts";

const root = new URL("../", import.meta.url);

test("contains the LicenseSizer customer workflow and production metadata", async () => {
  const [app, layout] = await Promise.all([
    readFile(new URL("../app/license-sizer-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(layout, /LicenseSizer/);
  assert.match(app, /Your license copy/);
  assert.match(app, /Processed on this device/);
  assert.match(app, /Begin securely/);
  assert.match(app, /does not verify identity/i);
  assert.match(app, /Open share sheet/);
  assert.doesNotMatch(app, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
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
  const candidates = await detectDocumentCandidatesWithOpenCv(canvas, guide);
  assert.equal(candidates[0]?.id, "canny", "Canny must be the first automatic crop model");
});

test("Canny reconstructs a perspective crop from separated opposite edge pairs", async () => {
  globalThis.window ??= { cv: await Promise.resolve((await import("@techstark/opencv-js")).default) };
  globalThis.HTMLImageElement ??= class HTMLImageElement {};
  globalThis.HTMLCanvasElement ??= class HTMLCanvasElement {};
  globalThis.ImageData ??= class ImageData {
    constructor(data, width, height) { this.data = data; this.width = width; this.height = height; }
  };
  const width = 640;
  const height = 420;
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let offset = 0; offset < pixels.length; offset += 4) pixels[offset + 3] = 255;
  const drawSegment = (start, end) => {
    const steps = Math.ceil(Math.hypot(end.x - start.x, end.y - start.y));
    for (let step = 0; step <= steps; step += 1) {
      const x = Math.round(start.x + (end.x - start.x) * step / steps);
      const y = Math.round(start.y + (end.y - start.y) * step / steps);
      for (let offsetY = -2; offsetY <= 2; offsetY += 1) {
        for (let offsetX = -2; offsetX <= 2; offsetX += 1) {
          const pixel = ((y + offsetY) * width + x + offsetX) * 4;
          pixels[pixel] = 245; pixels[pixel + 1] = 245; pixels[pixel + 2] = 245;
        }
      }
    }
  };
  const corners = [{ x: 92, y: 78 }, { x: 552, y: 96 }, { x: 520, y: 350 }, { x: 108, y: 334 }];
  for (let edge = 0; edge < 4; edge += 1) {
    const start = corners[edge];
    const end = corners[(edge + 1) % 4];
    const firstEnd = { x: start.x + (end.x - start.x) * 0.44, y: start.y + (end.y - start.y) * 0.44 };
    const secondStart = { x: start.x + (end.x - start.x) * 0.56, y: start.y + (end.y - start.y) * 0.56 };
    drawSegment(start, firstEnd);
    drawSegment(secondStart, end);
  }
  const canvas = new globalThis.HTMLCanvasElement();
  canvas.width = width;
  canvas.height = height;
  canvas.getContext = () => ({ getImageData: () => new globalThis.ImageData(pixels, width, height) });
  const candidates = await detectDocumentCandidatesWithOpenCv(canvas);
  const canny = candidates.find((candidate) => candidate.id === "canny")?.detection;
  assert.equal(canny?.found, true);
  assert.ok(Math.abs((canny?.corners[0].x ?? 0) - corners[0].x / width) < 0.06);
  assert.ok(Math.abs((canny?.corners[2].y ?? 0) - corners[2].y / height) < 0.06);
});

test("automatic crop promotes cross-detector consensus over a confident outlier", () => {
  const detection = (corners, confidence, found = true) => ({ corners, confidence, found, rotated: false, aspectRatio: 1.5 });
  const card = [{ x: 0.16, y: 0.24 }, { x: 0.84, y: 0.23 }, { x: 0.85, y: 0.69 }, { x: 0.15, y: 0.7 }];
  const nearCard = card.map((point) => ({ x: point.x + 0.008, y: point.y - 0.006 }));
  const distractor = [{ x: 0.04, y: 0.05 }, { x: 0.62, y: 0.05 }, { x: 0.62, y: 0.42 }, { x: 0.04, y: 0.42 }];
  const ranked = prioritizeCropCandidates([
    { id: "canny", label: "Canny", detail: "", detection: detection(distractor, 0.91) },
    { id: "background", label: "Background", detail: "", detection: detection(card, 0.86) },
    { id: "gradient", label: "Gradient", detail: "", detection: detection(nearCard, 0.79) },
  ]);
  assert.equal(ranked[0].id, "background");
});

test("automatic crop refuses to silently choose among conflicting detections", () => {
  const detection = (corners, confidence) => ({ corners, confidence, found: true, rotated: false, aspectRatio: 1.5 });
  const ranked = prioritizeCropCandidates([
    { id: "canny", label: "Canny", detail: "", detection: detection([{ x: 0.05, y: 0.08 }, { x: 0.63, y: 0.08 }, { x: 0.63, y: 0.45 }, { x: 0.05, y: 0.45 }], 0.93) },
    { id: "background", label: "Background", detail: "", detection: detection([{ x: 0.37, y: 0.5 }, { x: 0.94, y: 0.5 }, { x: 0.94, y: 0.88 }, { x: 0.37, y: 0.88 }], 0.88) },
  ]);
  assert.equal(ranked[0].id, "framing");
  assert.equal(ranked[0].detection.found, false);
});

test("Canny uses portrait pixel geometry and rejects larger shapes touching the photo frame", async () => {
  globalThis.window ??= { cv: await Promise.resolve((await import("@techstark/opencv-js")).default) };
  globalThis.HTMLImageElement ??= class HTMLImageElement {};
  globalThis.HTMLCanvasElement ??= class HTMLCanvasElement {};
  globalThis.ImageData ??= class ImageData {
    constructor(data, width, height) { this.data = data; this.width = width; this.height = height; }
  };
  const width = 720;
  const height = 960;
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let offset = 0; offset < pixels.length; offset += 4) {
    pixels[offset] = 105; pixels[offset + 1] = 32; pixels[offset + 2] = 35; pixels[offset + 3] = 255;
  }
  for (let y = 0; y < 250; y += 1) {
    for (let x = 0; x < 560 - y; x += 1) {
      const offset = (y * width + x) * 4;
      pixels[offset] = 12; pixels[offset + 1] = 17; pixels[offset + 2] = 19;
    }
  }
  for (let y = 350; y <= 715; y += 1) {
    for (let x = 70; x <= 650; x += 1) {
      const offset = (y * width + x) * 4;
      pixels[offset] = 235; pixels[offset + 1] = 234; pixels[offset + 2] = 228;
    }
  }
  const canvas = new globalThis.HTMLCanvasElement();
  canvas.width = width;
  canvas.height = height;
  canvas.getContext = () => ({ getImageData: () => new globalThis.ImageData(pixels, width, height) });
  const candidates = await detectDocumentCandidatesWithOpenCv(canvas);
  const canny = candidates.find((candidate) => candidate.id === "canny")?.detection;
  assert.equal(canny?.found, true);
  assert.ok((canny?.corners[0].x ?? 0) > 0.05, "crop should not attach to the left photo boundary");
  assert.ok((canny?.corners[0].y ?? 0) > 0.3, "crop should reject the stronger top-frame distractor");
  assert.ok(Math.abs((canny?.corners[2].y ?? 0) - 715 / height) < 0.05);
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

test("crop suggestions use friendly direct choices and retain endpoint handles without visible guide lines", async () => {
  const component = await readFile(new URL("../app/license-sizer-app.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const processing = await readFile(new URL("../lib/image-processing.ts", import.meta.url), "utf8");
  assert.match(component, /Select and move.*crop line/);
  assert.match(component, /handle \$\{endIndex \+ 1\} of 2/);
  assert.match(component, /startWholeLineDrag/);
  assert.match(component, /aria-pressed=\{selectedLine === index\}/);
  assert.match(component, /Recommended/);
  assert.match(component, /role="radiogroup" aria-label="Framing options"/);
  assert.match(component, /Rotate photo 90 degrees clockwise/);
  assert.doesNotMatch(component, /rotateAdjusted/);
  assert.match(component, /Back is always optional/);
  assert.doesNotMatch(component, /Capture required back/);
  assert.match(component, /chooseCropCandidate/);
  assert.match(processing, /prioritizeCropCandidates\(candidates, hint\)/);
  assert.doesNotMatch(styles, /\.crop-line::before|\.crop-line\.selected::before/);
  assert.match(styles, /\.line-handle\.selected/);
  assert.match(styles, /\.crop-selection \.crop-mask/);
  assert.match(styles, /\.crop-selection \.crop-boundary/);
});

test("edge labels retain screen order for portrait crops", () => {
  const portrait = [{ x: 0.35, y: 0.08 }, { x: 0.62, y: 0.12 }, { x: 0.65, y: 0.91 }, { x: 0.31, y: 0.87 }];
  const lines = cornersToEdgeLines(portrait);
  assert.ok(lines[0].start.y < lines[2].start.y, "top line must stay above bottom line");
  assert.ok(lines[1].start.x > lines[3].start.x, "right line must stay right of left line");
});

test("development viewer exposes the primary and fallback image-analysis stages", async () => {
  const [component, analysis] = await Promise.all([
    readFile(new URL("../app/license-sizer-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/development-analysis.ts", import.meta.url), "utf8"),
  ]);
  assert.match(component, /Image analysis viewer/);
  assert.match(component, /<select id="analysis-view"/);
  for (const view of ["Gaussian blur", "Background difference mask", "Cleaned foreground mask", "Canny edges", "Sobel edge strength", "Thresholded + dilated edges", "Contour skin", "Contours + detected crop"]) {
    assert.ok(analysis.includes(view), `missing ${view} option`);
  }
  assert.match(analysis, /Nothing leaves the browser/);
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
