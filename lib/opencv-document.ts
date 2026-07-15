/* eslint-disable @typescript-eslint/no-explicit-any */
import type { DetectionResult, Point } from "./image-processing";

let openCvPromise: Promise<any> | null = null;

async function loadOpenCv() {
  if (!openCvPromise) {
    openCvPromise = import("@techstark/opencv-js").then(async (module) => {
      const candidate = await Promise.resolve(module.default);
      if (candidate?.Mat) return candidate;
      return new Promise((resolve, reject) => {
        const timeout = window.setTimeout(() => reject(new Error("The image analyzer took too long to start.")), 15_000);
        candidate.onRuntimeInitialized = () => {
          window.clearTimeout(timeout);
          resolve(candidate);
        };
      });
    });
  }
  return openCvPromise;
}

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

export function orderDocumentPoints(points: Point[]): [Point, Point, Point, Point] {
  if (points.length !== 4) throw new Error("Four card corners are required.");
  const topLeft = points.reduce((best, point) => point.x + point.y < best.x + best.y ? point : best);
  const bottomRight = points.reduce((best, point) => point.x + point.y > best.x + best.y ? point : best);
  const topRight = points.reduce((best, point) => point.x - point.y > best.x - best.y ? point : best);
  const bottomLeft = points.reduce((best, point) => point.x - point.y < best.x - best.y ? point : best);
  const ordered = [topLeft, topRight, bottomRight, bottomLeft] as [Point, Point, Point, Point];
  const horizontal = (distance(ordered[0], ordered[1]) + distance(ordered[3], ordered[2])) / 2;
  const vertical = (distance(ordered[0], ordered[3]) + distance(ordered[1], ordered[2])) / 2;
  return vertical > horizontal ? [ordered[3], ordered[0], ordered[1], ordered[2]] : ordered;
}

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
  const gray = new cv.Mat();
  const blurred = new cv.Mat();
  const mask = new cv.Mat();
  const closed = new cv.Mat();
  const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(7, 7));

  try {
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);

    const imageArea = canvas.width * canvas.height;
    const hintCenter = hint
      ? { x: hint.reduce((sum, point) => sum + point.x, 0) / 4, y: hint.reduce((sum, point) => sum + point.y, 0) / 4 }
      : { x: 0.5, y: 0.5 };
    let best: { points: [Point, Point, Point, Point]; score: number; confidence: number; rotated: boolean } | null = null;

    const analyzeContours = (input: any) => {
      const contours = new cv.MatVector();
      const hierarchy = new cv.Mat();
      try {
        cv.findContours(input, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);
        for (let index = 0; index < contours.size(); index += 1) {
          const contour = contours.get(index);
          try {
            const area = Math.abs(cv.contourArea(contour, false));
            if (area < imageArea * 0.055 || area > imageArea * 0.94) continue;
            const perimeter = cv.arcLength(contour, true);
            for (const epsilon of [0.015, 0.022, 0.03, 0.04, 0.055]) {
              const approximation = new cv.Mat();
              try {
                cv.approxPolyDP(contour, approximation, perimeter * epsilon, true);
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
          } finally {
            contour.delete();
          }
        }
      } finally {
        hierarchy.delete();
        contours.delete();
      }
    };

    for (const [low, high] of [[24, 72], [45, 135], [70, 200]]) {
      cv.Canny(blurred, mask, low, high, 3, false);
      cv.morphologyEx(mask, closed, cv.MORPH_CLOSE, kernel, new cv.Point(-1, -1), 2);
      analyzeContours(closed);
    }
    cv.threshold(blurred, mask, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU);
    cv.morphologyEx(mask, closed, cv.MORPH_CLOSE, kernel, new cv.Point(-1, -1), 1);
    analyzeContours(closed);
    cv.bitwise_not(mask, mask);
    cv.morphologyEx(mask, closed, cv.MORPH_CLOSE, kernel, new cv.Point(-1, -1), 1);
    analyzeContours(closed);

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
    blurred.delete();
    gray.delete();
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
  const src = cv.imread(canvas);
  const destination = new cv.Mat();
  const sourcePoints = cv.matFromArray(4, 1, cv.CV_32FC2, ordered.flatMap((point) => [point.x * (canvas.width - 1), point.y * (canvas.height - 1)]));
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
  }
}
