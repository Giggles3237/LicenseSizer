/* eslint-disable @typescript-eslint/no-explicit-any */
import type { DetectionResult, Point } from "./image-processing";
import { orderDocumentPoints } from "./document-geometry.ts";

let openCvPromise: Promise<any> | null = null;

async function loadOpenCv() {
  if (!openCvPromise) {
    openCvPromise = new Promise((resolve, reject) => {
      const browserWindow = window as Window & { cv?: Promise<any> | any };
      const finish = () => Promise.resolve(browserWindow.cv).then((cv) => cv?.Mat ? resolve(cv) : reject(new Error("The image analyzer did not initialize.")), reject);
      if (browserWindow.cv) { void finish(); return; }
      const existing = document.querySelector<HTMLScriptElement>('script[data-license-sizer-opencv]');
      const script = existing ?? document.createElement("script");
      const timeout = window.setTimeout(() => reject(new Error("The image analyzer took too long to start.")), 30_000);
      const ready = () => { window.clearTimeout(timeout); void finish(); };
      script.addEventListener("load", ready, { once: true });
      script.addEventListener("error", () => { window.clearTimeout(timeout); reject(new Error("The image analyzer could not be loaded.")); }, { once: true });
      if (!existing) {
        script.src = "/opencv.js";
        script.async = true;
        script.dataset.licenseSizerOpencv = "true";
        document.head.appendChild(script);
      }
    }).catch((error) => { openCvPromise = null; throw error; });
  }
  return openCvPromise;
}

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

function polygonArea(points: Point[]) {
  return Math.abs(points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + point.x * next.y - next.x * point.y;
  }, 0) / 2);
}

export async function detectDocumentWithOpenCv(
  canvas: HTMLCanvasElement,
  hint?: [Point, Point, Point, Point],
): Promise<DetectionResult | null> {
  const cv = await loadOpenCv();
  const src = cv.imread(canvas);
  const rgb = new cv.Mat();
  const lab = new cv.Mat();
  const mask = new cv.Mat();
  const closed = new cv.Mat();
  const kernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(11, 11));

  try {
    // Treat the outer rim as background, then segment the object that differs
    // from it. This avoids searching every texture and printed edge in the photo.
    cv.cvtColor(src, rgb, cv.COLOR_RGBA2RGB);
    cv.cvtColor(rgb, lab, cv.COLOR_RGB2Lab);
    mask.create(canvas.height, canvas.width, cv.CV_8UC1);
    const borderSamples: number[][] = [[], [], []];
    const rim = Math.max(4, Math.round(Math.min(canvas.width, canvas.height) * 0.035));
    for (let y = 0; y < canvas.height; y += 3) {
      for (let x = 0; x < canvas.width; x += 3) {
        if (x >= rim && x < canvas.width - rim && y >= rim && y < canvas.height - rim) continue;
        const offset = (y * canvas.width + x) * 3;
        borderSamples[0].push(lab.data[offset]);
        borderSamples[1].push(lab.data[offset + 1]);
        borderSamples[2].push(lab.data[offset + 2]);
      }
    }
    const median = (values: number[]) => values.sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0;
    const background = borderSamples.map(median);
    for (let pixel = 0; pixel < canvas.width * canvas.height; pixel += 1) {
      const offset = pixel * 3;
      const dl = lab.data[offset] - background[0];
      const da = lab.data[offset + 1] - background[1];
      const db = lab.data[offset + 2] - background[2];
      mask.data[pixel] = Math.sqrt(dl * dl * 0.7 + da * da + db * db) > 24 ? 255 : 0;
    }
    cv.morphologyEx(mask, closed, cv.MORPH_OPEN, kernel, new cv.Point(-1, -1), 1);
    cv.morphologyEx(closed, closed, cv.MORPH_CLOSE, kernel, new cv.Point(-1, -1), 2);

    const imageArea = canvas.width * canvas.height;
    const hintCenter = hint
      ? { x: hint.reduce((sum, point) => sum + point.x, 0) / 4, y: hint.reduce((sum, point) => sum + point.y, 0) / 4 }
      : { x: 0.5, y: 0.5 };
    let best: { points: [Point, Point, Point, Point]; score: number; confidence: number; rotated: boolean } | null = null;

    const analyzeForeground = (input: any) => {
      const contours = new cv.MatVector();
      const hierarchy = new cv.Mat();
      try {
        cv.findContours(input, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);
        for (let index = 0; index < contours.size(); index += 1) {
          const contour = contours.get(index);
          try {
            const area = Math.abs(cv.contourArea(contour, false));
            if (area < imageArea * 0.055 || area > imageArea * 0.94) continue;
            const hull = new cv.Mat();
            cv.convexHull(contour, hull, false, true);
            const hullPerimeter = cv.arcLength(hull, true);
            for (const epsilon of [0.018, 0.025, 0.035, 0.05, 0.07]) {
              const approximation = new cv.Mat();
              try {
                cv.approxPolyDP(hull, approximation, hullPerimeter * epsilon, true);
                if (approximation.rows !== 4 || !cv.isContourConvex(approximation)) continue;
                const raw: Point[] = [];
                for (let pointIndex = 0; pointIndex < 4; pointIndex += 1) {
                  raw.push({
                    x: approximation.data32S[pointIndex * 2] / canvas.width,
                    y: approximation.data32S[pointIndex * 2 + 1] / canvas.height,
                  });
                }
                const ordered = orderDocumentPoints(raw);
                const top = distance(ordered[0], ordered[1]);
                const bottom = distance(ordered[3], ordered[2]);
                const left = distance(ordered[0], ordered[3]);
                const right = distance(ordered[1], ordered[2]);
                const ratio = ((top + bottom) / 2) / Math.max(0.001, (left + right) / 2);
                const ratioScore = Math.max(0, 1 - Math.abs(ratio - 1.58577) / 0.9);
                const normalizedArea = polygonArea(ordered);
                const areaScore = Math.min(1, normalizedArea / 0.32);
                const center = { x: ordered.reduce((sum, point) => sum + point.x, 0) / 4, y: ordered.reduce((sum, point) => sum + point.y, 0) / 4 };
                const centerScore = Math.max(0, 1 - Math.hypot(center.x - hintCenter.x, center.y - hintCenter.y) / 0.55);
                const parallelScore = Math.max(0, 1 - Math.abs(top - bottom) - Math.abs(left - right));
                const confidence = areaScore * 0.35 + ratioScore * 0.32 + centerScore * 0.23 + parallelScore * 0.1;
                const score = confidence * area;
                if (!best || score > best.score) best = { points: ordered, score, confidence, rotated: verticalCard(raw) };
              } finally {
                approximation.delete();
              }
            }
            hull.delete();
          } finally {
            contour.delete();
          }
        }
      } finally {
        hierarchy.delete();
        contours.delete();
      }
    };

    analyzeForeground(closed);

    if (!best) return null;
    return {
      corners: best.points,
      confidence: best.confidence,
      found: best.confidence >= 0.64,
      rotated: best.rotated,
      aspectRatio: canvas.width / canvas.height,
    };
  } finally {
    kernel.delete();
    closed.delete();
    mask.delete();
    lab.delete();
    rgb.delete();
    src.delete();
  }
}

function verticalCard(points: Point[]) {
  const ordered = orderDocumentPoints(points);
  return (distance(ordered[0], ordered[3]) + distance(ordered[1], ordered[2])) >
    (distance(ordered[0], ordered[1]) + distance(ordered[3], ordered[2]));
}

export async function warpDocumentWithOpenCv(
  canvas: HTMLCanvasElement,
  corners: [Point, Point, Point, Point],
  outputWidth: number,
  outputHeight: number,
) {
  const cv = await loadOpenCv();
  const ordered = orderDocumentPoints(corners);
  const fullSource = cv.imread(canvas);
  const pixelPoints = ordered.map((point) => ({ x: point.x * (canvas.width - 1), y: point.y * (canvas.height - 1) }));
  const padding = Math.max(3, Math.round(Math.min(canvas.width, canvas.height) * 0.01));
  const left = Math.max(0, Math.floor(Math.min(...pixelPoints.map((point) => point.x)) - padding));
  const top = Math.max(0, Math.floor(Math.min(...pixelPoints.map((point) => point.y)) - padding));
  const right = Math.min(canvas.width, Math.ceil(Math.max(...pixelPoints.map((point) => point.x)) + padding));
  const bottom = Math.min(canvas.height, Math.ceil(Math.max(...pixelPoints.map((point) => point.y)) + padding));
  const roi = fullSource.roi(new cv.Rect(left, top, Math.max(1, right - left), Math.max(1, bottom - top)));
  const src = roi.clone();
  const destination = new cv.Mat();
  const sourcePoints = cv.matFromArray(4, 1, cv.CV_32FC2, pixelPoints.flatMap((point) => [point.x - left, point.y - top]));
  const destinationPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, outputWidth - 1, 0, outputWidth - 1, outputHeight - 1, 0, outputHeight - 1]);
  const transform = cv.getPerspectiveTransform(sourcePoints, destinationPoints);
  try {
    cv.warpPerspective(src, destination, transform, new cv.Size(outputWidth, outputHeight), cv.INTER_CUBIC, cv.BORDER_REPLICATE, new cv.Scalar());
    return { width: destination.cols, height: destination.rows, data: new Uint8ClampedArray(destination.data), corners: ordered };
  } finally {
    transform.delete();
    destinationPoints.delete();
    sourcePoints.delete();
    destination.delete();
    src.delete();
    roi.delete();
    fullSource.delete();
  }
}
