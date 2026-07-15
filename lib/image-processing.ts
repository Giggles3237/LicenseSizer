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

export const DEFAULT_CORNERS: [Point, Point, Point, Point] = [
  { x: 0.06, y: 0.08 },
  { x: 0.94, y: 0.08 },
  { x: 0.94, y: 0.92 },
  { x: 0.06, y: 0.92 },
];

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_PIXELS = 60_000_000;

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
    return { status: "warn", title: "The photo looks dark", detail: "Use softer, brighter light if any details are hard to read.", brightness, glare, sharpness };
  }
  if (brightness > 218 || glare > 0.08) {
    return { status: "warn", title: "Check for glare", detail: "Tilt the card away from direct light if any information is obscured.", brightness, glare, sharpness };
  }
  if (sharpness < 55) {
    return { status: "warn", title: "Check the focus", detail: "Retake the photo if the text is not crisp and readable.", brightness, glare, sharpness };
  }
  return { status: "pass", title: "Photo looks usable", detail: "Confirm that all four corners are inside the crop.", brightness, glare, sharpness };
}

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

export function orientDocumentCorners(points: [Point, Point, Point, Point]) {
  const horizontal = (distance(points[0], points[1]) + distance(points[3], points[2])) / 2;
  const vertical = (distance(points[0], points[3]) + distance(points[1], points[2])) / 2;
  const rotated = vertical > horizontal;
  return {
    corners: (rotated ? [points[3], points[0], points[1], points[2]] : points) as [Point, Point, Point, Point],
    horizontal,
    vertical,
    rotated,
  };
}

export async function detectDocument(source: Blob): Promise<DetectionResult> {
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

  return { corners: points, confidence, found: confidence >= 0.48, rotated, aspectRatio: width / height };
}

function squareToQuadrilateral(points: [Point, Point, Point, Point], width: number, height: number) {
  const [p0, p1, p2, p3] = points.map((point) => ({
    x: point.x * (width - 1),
    y: point.y * (height - 1),
  })) as [Point, Point, Point, Point];
  const dx1 = p1.x - p2.x;
  const dx2 = p3.x - p2.x;
  const dx3 = p0.x - p1.x + p2.x - p3.x;
  const dy1 = p1.y - p2.y;
  const dy2 = p3.y - p2.y;
  const dy3 = p0.y - p1.y + p2.y - p3.y;
  const denominator = dx1 * dy2 - dx2 * dy1;

  let g = 0;
  let h = 0;
  if (Math.abs(denominator) > 0.000001) {
    g = (dx3 * dy2 - dx2 * dy3) / denominator;
    h = (dx1 * dy3 - dx3 * dy1) / denominator;
  }

  return {
    a: p1.x - p0.x + g * p1.x,
    b: p3.x - p0.x + h * p3.x,
    c: p0.x,
    d: p1.y - p0.y + g * p1.y,
    e: p3.y - p0.y + h * p3.y,
    f: p0.y,
    g,
    h,
  };
}

export async function correctPerspective(
  source: Blob,
  corners: [Point, Point, Point, Point],
  quality: "standard" | "high" = "high",
): Promise<Blob> {
  const sourceCanvas = await sourceToCanvas(source);
  const sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true });
  if (!sourceContext) throw new Error("Unable to read the image.");
  const sourceData = sourceContext.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height).data;
  const outputWidth = quality === "high" ? 1011 : 674;
  const outputHeight = quality === "high" ? 638 : 425;
  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = outputWidth;
  outputCanvas.height = outputHeight;
  const outputContext = outputCanvas.getContext("2d");
  if (!outputContext) throw new Error("Unable to create the corrected image.");
  const output = outputContext.createImageData(outputWidth, outputHeight);
  const transform = squareToQuadrilateral(corners, sourceCanvas.width, sourceCanvas.height);

  for (let y = 0; y < outputHeight; y += 1) {
    const v = y / Math.max(1, outputHeight - 1);
    for (let x = 0; x < outputWidth; x += 1) {
      const u = x / Math.max(1, outputWidth - 1);
      const denominator = transform.g * u + transform.h * v + 1;
      const sourceX = Math.max(0, Math.min(sourceCanvas.width - 1, (transform.a * u + transform.b * v + transform.c) / denominator));
      const sourceY = Math.max(0, Math.min(sourceCanvas.height - 1, (transform.d * u + transform.e * v + transform.f) / denominator));
      const left = Math.floor(sourceX);
      const top = Math.floor(sourceY);
      const right = Math.min(sourceCanvas.width - 1, left + 1);
      const bottom = Math.min(sourceCanvas.height - 1, top + 1);
      const fx = sourceX - left;
      const fy = sourceY - top;
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
  return new Promise((resolve, reject) => {
    outputCanvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Unable to encode the corrected image."))),
      "image/jpeg",
      quality === "high" ? 0.92 : 0.84,
    );
  });
}
