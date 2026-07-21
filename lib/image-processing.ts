import { orderDocumentPoints, squareToQuadrilateral } from "./document-geometry.ts";

export type Point = { x: number; y: number };

export type QualityResult = {
  status: "pass" | "warn";
  title: string;
  detail: string;
  brightness: number;
  glare: number;
  sharpness: number;
};

export type DetectionResult = {
  corners: [Point, Point, Point, Point];
  confidence: number;
  found: boolean;
  rotated: boolean;
  aspectRatio: number;
};

export type CropCandidate = {
  id: "canny" | "background" | "gradient" | "framing";
  label: string;
  detail: string;
  detection: DetectionResult;
};

const AUTOMATIC_CROP_IDS = new Set<CropCandidate["id"]>(["canny", "background", "gradient"]);

function normalizedCornerDistance(first: DetectionResult, second: DetectionResult) {
  const aspectRatio = Math.max(0.1, (first.aspectRatio + second.aspectRatio) / 2);
  const diagonal = Math.hypot(aspectRatio, 1);
  return first.corners.reduce((sum, point, index) => {
    const other = second.corners[index];
    return sum + Math.hypot((point.x - other.x) * aspectRatio, point.y - other.y) / diagonal;
  }, 0) / 4;
}

function detectionForCorners(corners: [Point, Point, Point, Point], aspectRatio: number): DetectionResult {
  return {
    corners: corners.map((point) => ({ ...point })) as [Point, Point, Point, Point],
    confidence: 0,
    found: false,
    rotated: false,
    aspectRatio,
  };
}

/**
 * Pick a safe first suggestion instead of assuming one detector is always best.
 * Agreement matters because strong lines inside an ID (or another rectangle in
 * the scene) can look extremely convincing to any single detector.
 */
export function prioritizeCropCandidates(
  candidates: CropCandidate[],
  hint?: [Point, Point, Point, Point],
): CropCandidate[] {
  const automatic = candidates.filter((candidate) => AUTOMATIC_CROP_IDS.has(candidate.id));
  const plausible = automatic.filter((candidate) => candidate.detection.found && candidate.detection.confidence >= 0.58);
  const hintDetection = hint && detectionForCorners(hint, automatic[0]?.detection.aspectRatio ?? 1);
  const scored = automatic.map((candidate) => {
    const peers = plausible.filter((peer) => peer.id !== candidate.id);
    const agreement = peers.length
      ? Math.max(...peers.map((peer) => Math.max(0, 1 - normalizedCornerDistance(candidate.detection, peer.detection) / 0.11)))
      : 0;
    const hintAgreement = hintDetection
      ? Math.max(0, 1 - normalizedCornerDistance(candidate.detection, hintDetection) / 0.16)
      : 0;
    const score = candidate.detection.confidence * 0.72 + agreement * 0.22 + hintAgreement * 0.06;
    return { candidate, score };
  }).sort((first, second) => second.score - first.score);

  const best = scored[0];
  const closestPeerDistance = best
    ? Math.min(...plausible.filter((peer) => peer.id !== best.candidate.id).map((peer) => normalizedCornerDistance(best.candidate.detection, peer.detection)), Infinity)
    : Infinity;
  const hasConsensus = closestPeerDistance <= 0.11;
  const isDecisive = Boolean(best?.candidate.detection.found) && (
    hasConsensus ||
    (plausible.length === 1 && best.candidate.detection.confidence >= 0.78)
  );

  const framing = candidates.find((candidate) => candidate.id === "framing") ?? {
    id: "framing" as const,
    label: "Manual review",
    detail: "The detectors disagreed, so no uncertain rectangle was applied automatically.",
    detection: detectionForCorners(hint ?? DEFAULT_CORNERS, automatic[0]?.detection.aspectRatio ?? 1),
  };
  const remaining = candidates.filter((candidate) => candidate.id !== "framing" && !automatic.includes(candidate));
  const rankedAutomatic = scored.map(({ candidate }) => candidate);
  return isDecisive
    ? [...rankedAutomatic, ...remaining, framing]
    : [framing, ...rankedAutomatic, ...remaining];
}

export const DEFAULT_CORNERS: [Point, Point, Point, Point] = [
  { x: 0.06, y: 0.08 },
  { x: 0.94, y: 0.08 },
  { x: 0.94, y: 0.92 },
  { x: 0.06, y: 0.92 },
];

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_PIXELS = 60_000_000;

function timeoutAfter<T>(promise: Promise<T>, milliseconds: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error(message)), milliseconds);
    promise.then(
      (value) => { window.clearTimeout(timeout); resolve(value); },
      (error) => { window.clearTimeout(timeout); reject(error); },
    );
  });
}

export async function validateImage(file: File | Blob) {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("This image is larger than 25 MB. Choose a smaller photo.");
  }

  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  if (bitmap.width * bitmap.height > MAX_PIXELS) {
    bitmap.close();
    throw new Error("This image is too large to process safely on this device.");
  }
  bitmap.close();
}

export async function sourceToCanvas(
  source: Blob,
  maxDimension = 2400,
): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(source, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    bitmap.close();
    throw new Error("This browser could not prepare the image.");
  }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas;
}

export async function analyzeImage(source: Blob): Promise<QualityResult> {
  const canvas = await sourceToCanvas(source, 420);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Unable to inspect the image.");
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  const gray = new Float32Array(canvas.width * canvas.height);
  let brightness = 0;
  let glarePixels = 0;

  for (let pixel = 0, offset = 0; pixel < gray.length; pixel += 1, offset += 4) {
    const value = data[offset] * 0.299 + data[offset + 1] * 0.587 + data[offset + 2] * 0.114;
    gray[pixel] = value;
    brightness += value;
    const maximum = Math.max(data[offset], data[offset + 1], data[offset + 2]);
    const minimum = Math.min(data[offset], data[offset + 1], data[offset + 2]);
    if (value > 244 && maximum - minimum < 14) glarePixels += 1;
  }

  brightness /= gray.length;
  const glare = glarePixels / gray.length;
  let laplacianSum = 0;
  let laplacianSquared = 0;
  let samples = 0;
  for (let y = 1; y < canvas.height - 1; y += 2) {
    for (let x = 1; x < canvas.width - 1; x += 2) {
      const index = y * canvas.width + x;
      const value =
        gray[index - 1] +
        gray[index + 1] +
        gray[index - canvas.width] +
        gray[index + canvas.width] -
        4 * gray[index];
      laplacianSum += value;
      laplacianSquared += value * value;
      samples += 1;
    }
  }
  const mean = laplacianSum / Math.max(1, samples);
  const sharpness = laplacianSquared / Math.max(1, samples) - mean * mean;

  if (brightness < 55) {
    return { status: "warn", title: "A little more light may help", detail: "Choose a brighter photo if any details are difficult to read.", brightness, glare, sharpness };
  }
  if (brightness > 218 || glare > 0.08) {
    return { status: "warn", title: "A touch of glare is visible", detail: "Choose another photo if the reflection covers important details.", brightness, glare, sharpness };
  }
  if (sharpness < 55) {
    return { status: "warn", title: "The focus could be sharper", detail: "Choose another photo if the text does not look crisp and readable.", brightness, glare, sharpness };
  }
  return { status: "pass", title: "Clear and ready", detail: "Confirm the outline follows all four edges, then continue.", brightness, glare, sharpness };
}

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

export function orientDocumentCorners(points: [Point, Point, Point, Point]) {
  const horizontal = (distance(points[0], points[1]) + distance(points[3], points[2])) / 2;
  const vertical = (distance(points[0], points[3]) + distance(points[1], points[2])) / 2;
  const rotated = vertical > horizontal;
  return {
    // Preserve the orientation in which the user photographed the card.
    // Rotation is an explicit choice after the corrected crop is previewed.
    corners: points.map((point) => ({ ...point })) as [Point, Point, Point, Point],
    horizontal,
    vertical,
    rotated,
  };
}

export async function detectDocument(source: Blob, hint?: [Point, Point, Point, Point]): Promise<DetectionResult> {
  const candidates = await detectDocumentCandidates(source, hint);
  return candidates[0].detection;
}

const insetCorners = (insetX: number, insetY: number): [Point, Point, Point, Point] => [
  { x: insetX, y: insetY },
  { x: 1 - insetX, y: insetY },
  { x: 1 - insetX, y: 1 - insetY },
  { x: insetX, y: 1 - insetY },
];

export async function detectDocumentCandidates(source: Blob, hint?: [Point, Point, Point, Point]): Promise<CropCandidate[]> {
  const canvas = await sourceToCanvas(source, 960);
  let openCvCandidates: CropCandidate[] = [];
  try {
    const { detectDocumentCandidatesWithOpenCv } = await import("./opencv-document");
    openCvCandidates = await timeoutAfter(detectDocumentCandidatesWithOpenCv(canvas, hint), 12_000, "The detailed analyzer was unavailable.");
  } catch {
    // Continue with the lightweight on-device detector below.
  }
  const fallback = await detectDocumentLegacy(source);
  const aspectRatio = canvas.width / canvas.height;
  const uncertain = (corners: [Point, Point, Point, Point]): DetectionResult => ({
    corners: corners.map((point) => ({ ...point })) as [Point, Point, Point, Point],
    confidence: 0,
    found: false,
    rotated: false,
    aspectRatio,
  });
  const byId = new Map(openCvCandidates.map((candidate) => [candidate.id, candidate]));
  const canny = byId.get("canny") ?? {
    id: "canny" as const,
    label: "Canny edges",
    detail: "No closed edge loop was strong enough, so this begins near the photographed card area.",
    detection: uncertain(hint ?? DEFAULT_CORNERS),
  };
  const background = byId.get("background") ?? {
    id: "background" as const,
    label: "Background contrast",
    detail: "A conservative inset based on the main area of the photo.",
    detection: uncertain(insetCorners(0.1, 0.12)),
  };
  const gradient: CropCandidate = {
    id: "gradient",
    label: "Gradient regions",
    detail: fallback.found ? "Groups strong brightness changes into the most likely centered card region." : "A wider fallback when connected gradients are uncertain.",
    detection: fallback.found ? fallback : uncertain(insetCorners(0.055, 0.075)),
  };
  const candidates: CropCandidate[] = [canny, background, gradient];
  if (hint) candidates.push({
    id: "framing",
    label: "Camera framing",
    detail: "Uses the guide position visible when the photo was taken.",
    detection: uncertain(hint),
  });
  return prioritizeCropCandidates(candidates, hint);
}

export async function detectDocumentLegacy(source: Blob): Promise<DetectionResult> {
  const canvas = await sourceToCanvas(source, 480);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Unable to inspect the card edges.");
  const width = canvas.width;
  const height = canvas.height;
  const { data } = context.getImageData(0, 0, width, height);
  const gray = new Uint8Array(width * height);
  for (let index = 0, offset = 0; index < gray.length; index += 1, offset += 4) {
    gray[index] = Math.round(data[offset] * 0.299 + data[offset + 1] * 0.587 + data[offset + 2] * 0.114);
  }

  const magnitude = new Uint8Array(width * height);
  const histogram = new Uint32Array(256);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      const gx =
        -gray[index - width - 1] - 2 * gray[index - 1] - gray[index + width - 1] +
        gray[index - width + 1] + 2 * gray[index + 1] + gray[index + width + 1];
      const gy =
        -gray[index - width - 1] - 2 * gray[index - width] - gray[index - width + 1] +
        gray[index + width - 1] + 2 * gray[index + width] + gray[index + width + 1];
      const value = Math.min(255, Math.round(Math.hypot(gx, gy) / 4));
      magnitude[index] = value;
      histogram[value] += 1;
    }
  }

  const target = Math.round(width * height * 0.86);
  let cumulative = 0;
  let threshold = 42;
  for (let value = 0; value < histogram.length; value += 1) {
    cumulative += histogram[value];
    if (cumulative >= target) {
      threshold = Math.max(34, value);
      break;
    }
  }

  let edges = new Uint8Array(width * height);
  for (let index = 0; index < magnitude.length; index += 1) edges[index] = magnitude[index] >= threshold ? 1 : 0;
  for (let pass = 0; pass < 2; pass += 1) {
    const expanded = edges.slice();
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const index = y * width + x;
        if (!edges[index]) continue;
        expanded[index - 1] = 1;
        expanded[index + 1] = 1;
        expanded[index - width] = 1;
        expanded[index + width] = 1;
      }
    }
    edges = expanded;
  }

  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let best: { score: number; count: number; tl: Point; tr: Point; br: Point; bl: Point; minX: number; maxX: number; minY: number; maxY: number } | null = null;

  for (let start = 0; start < edges.length; start += 1) {
    if (!edges[start] || visited[start]) continue;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    visited[start] = 1;
    let count = 0;
    let minX = width;
    let maxX = 0;
    let minY = height;
    let maxY = 0;
    let minSum = Infinity;
    let maxSum = -Infinity;
    let minDifference = Infinity;
    let maxDifference = -Infinity;
    let tl = { x: 0, y: 0 };
    let tr = { x: 0, y: 0 };
    let br = { x: 0, y: 0 };
    let bl = { x: 0, y: 0 };

    while (head < tail) {
      const index = queue[head++];
      const x = index % width;
      const y = Math.floor(index / width);
      count += 1;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      const sum = x + y;
      const difference = x - y;
      if (sum < minSum) { minSum = sum; tl = { x, y }; }
      if (sum > maxSum) { maxSum = sum; br = { x, y }; }
      if (difference > maxDifference) { maxDifference = difference; tr = { x, y }; }
      if (difference < minDifference) { minDifference = difference; bl = { x, y }; }

      const neighbors = [index - 1, index + 1, index - width, index + width, index - width - 1, index - width + 1, index + width - 1, index + width + 1];
      for (const neighbor of neighbors) {
        if (neighbor < 0 || neighbor >= edges.length || visited[neighbor] || !edges[neighbor]) continue;
        const neighborX = neighbor % width;
        if (Math.abs(neighborX - x) > 1) continue;
        visited[neighbor] = 1;
        queue[tail++] = neighbor;
      }
    }

    if (count < width * height * 0.004) continue;
    const boxArea = (maxX - minX) * (maxY - minY);
    const coverage = boxArea / (width * height);
    const touches = Number(minX <= 2) + Number(minY <= 2) + Number(maxX >= width - 3) + Number(maxY >= height - 3);
    if (coverage < 0.08 || coverage > 0.97 || touches >= 3) continue;
    const centerX = (minX + maxX) / 2 / width;
    const centerY = (minY + maxY) / 2 / height;
    const centerWeight = 1 - Math.min(0.7, Math.hypot(centerX - 0.5, centerY - 0.5));
    const score = boxArea * (0.65 + centerWeight * 0.35) * (touches ? 0.78 : 1);
    if (!best || score > best.score) best = { score, count, tl, tr, br, bl, minX, maxX, minY, maxY };
  }

  if (!best) {
    return { corners: DEFAULT_CORNERS.map((point) => ({ ...point })) as [Point, Point, Point, Point], confidence: 0, found: false, rotated: false, aspectRatio: width / height };
  }

  const detectedPoints = [best.tl, best.tr, best.br, best.bl].map((point) => ({ x: point.x / width, y: point.y / height })) as [Point, Point, Point, Point];
  const { corners: points, horizontal, vertical, rotated } = orientDocumentCorners(detectedPoints);
  const polygonArea = Math.abs(points.reduce((area, point, index) => {
    const next = points[(index + 1) % points.length];
    return area + point.x * next.y - next.x * point.y;
  }, 0) / 2);
  const measuredRatio = Math.max(horizontal, vertical) / Math.max(0.001, Math.min(horizontal, vertical));
  const ratioScore = Math.max(0, 1 - Math.abs(measuredRatio - 1.58577) / 1.2);
  const areaScore = Math.min(1, polygonArea / 0.28);
  const confidence = Math.max(0, Math.min(1, areaScore * 0.58 + ratioScore * 0.42));

  return { corners: points, confidence, found: confidence >= 0.78, rotated, aspectRatio: width / height };
}

export async function correctPerspective(
  source: Blob,
  corners: [Point, Point, Point, Point],
  quality: "standard" | "high" = "high",
): Promise<Blob> {
  const sourceCanvas = await sourceToCanvas(source);
  const ordered = orderDocumentPoints(corners);
  const sourceDistance = (first: Point, second: Point) => Math.hypot(
    (first.x - second.x) * sourceCanvas.width,
    (first.y - second.y) * sourceCanvas.height,
  );
  const cropWidth = (sourceDistance(ordered[0], ordered[1]) + sourceDistance(ordered[3], ordered[2])) / 2;
  const cropHeight = (sourceDistance(ordered[0], ordered[3]) + sourceDistance(ordered[1], ordered[2])) / 2;
  const landscapeWidth = quality === "high" ? 1011 : 674;
  const landscapeHeight = quality === "high" ? 638 : 425;
  const outputWidth = cropWidth >= cropHeight ? landscapeWidth : landscapeHeight;
  const outputHeight = cropWidth >= cropHeight ? landscapeHeight : landscapeWidth;
  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = outputWidth;
  outputCanvas.height = outputHeight;
  const outputContext = outputCanvas.getContext("2d");
  if (!outputContext) throw new Error("Unable to create the corrected image.");
  try {
    const { warpDocumentWithOpenCv } = await import("./opencv-document");
    const corrected = await timeoutAfter(warpDocumentWithOpenCv(sourceCanvas, corners, outputWidth, outputHeight), 5_000, "Using compatible perspective correction.");
    outputContext.putImageData(new ImageData(corrected.data, corrected.width, corrected.height), 0, 0);
  } catch {
    const sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true });
    if (!sourceContext) throw new Error("Unable to read the image.");
    const sourceData = sourceContext.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height).data;
    const output = outputContext.createImageData(outputWidth, outputHeight);
    const transform = squareToQuadrilateral(ordered, sourceCanvas.width, sourceCanvas.height);
    for (let y = 0; y < outputHeight; y += 1) {
      const v = y / Math.max(1, outputHeight - 1);
      for (let x = 0; x < outputWidth; x += 1) {
        const u = x / Math.max(1, outputWidth - 1);
        const divisor = transform.g * u + transform.h * v + 1;
        const sourceX = Math.max(0, Math.min(sourceCanvas.width - 1, (transform.a * u + transform.b * v + transform.c) / divisor));
        const sourceY = Math.max(0, Math.min(sourceCanvas.height - 1, (transform.d * u + transform.e * v + transform.f) / divisor));
        const left = Math.floor(sourceX), top = Math.floor(sourceY);
        const right = Math.min(sourceCanvas.width - 1, left + 1), bottom = Math.min(sourceCanvas.height - 1, top + 1);
        const fx = sourceX - left, fy = sourceY - top;
        const destination = (y * outputWidth + x) * 4;
        for (let channel = 0; channel < 3; channel += 1) {
          const topValue = sourceData[(top * sourceCanvas.width + left) * 4 + channel] * (1 - fx) + sourceData[(top * sourceCanvas.width + right) * 4 + channel] * fx;
          const bottomValue = sourceData[(bottom * sourceCanvas.width + left) * 4 + channel] * (1 - fx) + sourceData[(bottom * sourceCanvas.width + right) * 4 + channel] * fx;
          output.data[destination + channel] = topValue * (1 - fy) + bottomValue * fy;
        }
        output.data[destination + 3] = 255;
      }
    }
    outputContext.putImageData(output, 0, 0);
  }
  return new Promise((resolve, reject) => {
    outputCanvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Unable to encode the corrected image."))),
      "image/jpeg",
      quality === "high" ? 0.92 : 0.84,
    );
  });
}
