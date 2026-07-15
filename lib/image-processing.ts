export type Point = { x: number; y: number };

export type QualityResult = {
  status: "pass" | "warn";
  title: string;
  detail: string;
  brightness: number;
  glare: number;
  sharpness: number;
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
