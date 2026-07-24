/* eslint-disable @typescript-eslint/no-explicit-any */
import type { DetectionResult, Point } from "./image-processing";
import { orderDocumentPoints } from "./document-geometry.ts";

export type OpenCvCropCandidate = {
  id: "canny";
  label: string;
  detail: string;
  detection: DetectionResult;
};

let openCvPromise: Promise<any> | null = null;

export async function loadOpenCv() {
  if (!openCvPromise) {
    openCvPromise = new Promise((resolve, reject) => {
      const browserWindow = window as Window & { cv?: Promise<any> | any };
      const finish = () => Promise.resolve(browserWindow.cv).then((cv) => cv?.Mat ? resolve(cv) : reject(new Error("The image analyzer did not initialize.")), reject);
      if (browserWindow.cv) { void finish(); return; }
      const existing = document.querySelector<HTMLScriptElement>('script[data-license-resizer-opencv]');
      const script = existing ?? document.createElement("script");
      const timeout = window.setTimeout(() => reject(new Error("The image analyzer took too long to start.")), 30_000);
      const ready = () => { window.clearTimeout(timeout); void finish(); };
      script.addEventListener("load", ready, { once: true });
      script.addEventListener("error", () => { window.clearTimeout(timeout); reject(new Error("The image analyzer could not be loaded.")); }, { once: true });
      if (!existing) {
        script.src = "/opencv.js";
        script.async = true;
        script.dataset.licenseResizerOpencv = "true";
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

const radiansBetween = (first: number, second: number) => {
  const difference = Math.abs(first - second) % Math.PI;
  return Math.min(difference, Math.PI - difference);
};

const segmentAngle = (first: Point, second: Point) => Math.atan2(second.y - first.y, second.x - first.x);

const averageParallelAngle = (first: number, second: number) => {
  const angle = Math.atan2(Math.sin(first * 2) + Math.sin(second * 2), Math.cos(first * 2) + Math.cos(second * 2)) / 2;
  return angle < 0 ? angle + Math.PI : angle;
};

function lineIntersection(first: [Point, Point], second: [Point, Point]): Point | null {
  const [a, b] = first;
  const [c, d] = second;
  const denominator = (a.x - b.x) * (c.y - d.y) - (a.y - b.y) * (c.x - d.x);
  if (Math.abs(denominator) < 0.0001) return null;
  const firstCross = a.x * b.y - a.y * b.x;
  const secondCross = c.x * d.y - c.y * d.x;
  return {
    x: (firstCross * (c.x - d.x) - (a.x - b.x) * secondCross) / denominator,
    y: (firstCross * (c.y - d.y) - (a.y - b.y) * secondCross) / denominator,
  };
}

export async function detectDocumentWithOpenCv(
  canvas: HTMLCanvasElement,
  hint?: [Point, Point, Point, Point],
): Promise<DetectionResult | null> {
  const candidates = await detectDocumentCandidatesWithOpenCv(canvas, hint);
  return candidates
    .filter((candidate) => candidate.detection.found)
    .sort((first, second) => second.detection.confidence - first.detection.confidence)[0]?.detection
    ?? candidates.sort((first, second) => second.detection.confidence - first.detection.confidence)[0]?.detection
    ?? null;
}

export async function detectDocumentCandidatesWithOpenCv(
  canvas: HTMLCanvasElement,
  hint?: [Point, Point, Point, Point],
): Promise<OpenCvCropCandidate[]> {
  const cv = await loadOpenCv();
  const src = cv.imread(canvas);
  const gray = new cv.Mat();

  try {
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    const imageArea = canvas.width * canvas.height;
    const hintCenter = hint
      ? { x: hint.reduce((sum, point) => sum + point.x, 0) / 4, y: hint.reduce((sum, point) => sum + point.y, 0) / 4 }
      : { x: 0.5, y: 0.5 };
    type BestQuadrilateral = { points: [Point, Point, Point, Point]; score: number; confidence: number; rotated: boolean };
    type CannyPass = { blur: number; low: number; high: number; kernel: number; close: number; dilate: number };
    const cannyPasses: CannyPass[] = [
      { blur: 7, low: 45, high: 135, kernel: 7, close: 2, dilate: 1 },
      { blur: 5, low: 30, high: 95, kernel: 5, close: 2, dilate: 1 },
      { blur: 5, low: 55, high: 165, kernel: 5, close: 1, dilate: 1 },
      { blur: 9, low: 35, high: 110, kernel: 9, close: 2, dilate: 0 },
      { blur: 3, low: 70, high: 210, kernel: 3, close: 1, dilate: 1 },
    ];
    const edgeSupport = (points: [Point, Point, Point, Point], evidence: any) => {
      let supported = 0;
      let samples = 0;
      const radius = Math.max(2, Math.round(Math.min(canvas.width, canvas.height) * 0.004));
      for (let edge = 0; edge < 4; edge += 1) {
        const start = points[edge];
        const end = points[(edge + 1) % 4];
        const sampleCount = Math.max(24, Math.round(distance(start, end) * Math.max(canvas.width, canvas.height) / 12));
        for (let sample = 0; sample <= sampleCount; sample += 1) {
          const progress = sample / sampleCount;
          const x = Math.round((start.x + (end.x - start.x) * progress) * (canvas.width - 1));
          const y = Math.round((start.y + (end.y - start.y) * progress) * (canvas.height - 1));
          let hit = false;
          for (let offsetY = -radius; offsetY <= radius && !hit; offsetY += 1) {
            for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
              const sampleX = x + offsetX;
              const sampleY = y + offsetY;
              if (sampleX < 0 || sampleY < 0 || sampleX >= canvas.width || sampleY >= canvas.height) continue;
              if (evidence.data[sampleY * canvas.width + sampleX] > 0) { hit = true; break; }
            }
          }
          supported += Number(hit);
          samples += 1;
        }
      }
      return supported / Math.max(1, samples);
    };
    const scoreQuadrilateral = (points: [Point, Point, Point, Point], evidence: any): BestQuadrilateral | null => {
      const pixelDistance = (first: Point, second: Point) => Math.hypot(
        (first.x - second.x) * canvas.width,
        (first.y - second.y) * canvas.height,
      );
      const top = pixelDistance(points[0], points[1]);
      const bottom = pixelDistance(points[3], points[2]);
      const left = pixelDistance(points[0], points[3]);
      const right = pixelDistance(points[1], points[2]);
      const rawRatio = ((top + bottom) / 2) / Math.max(0.001, (left + right) / 2);
      const measuredRatio = Math.max(rawRatio, 1 / Math.max(0.001, rawRatio));
      const ratioScore = Math.max(0, 1 - Math.abs(measuredRatio - 1.58577) / 0.72);
      const normalizedArea = polygonArea(points);
      if (normalizedArea < 0.055 || normalizedArea > 0.94) return null;
      const areaScore = Math.min(1, normalizedArea / 0.34);
      const center = { x: points.reduce((sum, point) => sum + point.x, 0) / 4, y: points.reduce((sum, point) => sum + point.y, 0) / 4 };
      const centerScore = Math.max(0, 1 - Math.hypot(center.x - hintCenter.x, center.y - hintCenter.y) / 0.55);
      const topBottomAngle = radiansBetween(segmentAngle(points[0], points[1]), segmentAngle(points[3], points[2]));
      const leftRightAngle = radiansBetween(segmentAngle(points[0], points[3]), segmentAngle(points[1], points[2]));
      const parallelScore = (
        Math.max(0, 1 - topBottomAngle / (Math.PI / 7)) +
        Math.max(0, 1 - leftRightAngle / (Math.PI / 7))
      ) / 2;
      const lengthSymmetry = Math.max(0, 1 - Math.abs(top - bottom) / Math.max(top, bottom) - Math.abs(left - right) / Math.max(left, right));
      const boundaryScore = edgeSupport(points, evidence);
      const frameClearance = Math.min(...points.flatMap((point) => [point.x, point.y, 1 - point.x, 1 - point.y]));
      const frameScore = Math.max(0, Math.min(1, frameClearance / 0.025));
      const confidence = areaScore * 0.13 + ratioScore * 0.23 + centerScore * 0.1 + parallelScore * 0.16 + lengthSymmetry * 0.08 + boundaryScore * 0.2 + frameScore * 0.1;
      const score = confidence * (0.78 + areaScore * 0.22) * (0.35 + frameScore * 0.65);
      return { points, score, confidence, rotated: verticalCard(points) };
    };
    const analyzeForeground = (input: any, evidence: any) => {
      let best: { points: [Point, Point, Point, Point]; score: number; confidence: number; rotated: boolean } | null = null;
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
                const scored = scoreQuadrilateral(ordered, evidence);
                if (scored && (!best || scored.score > best.score)) best = scored;
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
      return best;
    };

    const analyzeLinePairs = (evidence: any): BestQuadrilateral | null => {
      const lines = new cv.Mat();
      try {
        const minimumDimension = Math.min(canvas.width, canvas.height);
        cv.HoughLinesP(evidence, lines, 1, Math.PI / 180, Math.max(28, Math.round(minimumDimension * 0.1)), Math.round(minimumDimension * 0.16), Math.round(minimumDimension * 0.055));
        const segments: Array<{ line: [Point, Point]; length: number; angle: number; midpoint: Point }> = [];
        const lineCount = Math.floor(lines.data32S.length / 4);
        for (let row = 0; row < lineCount; row += 1) {
          const offset = row * 4;
          const first = { x: lines.data32S[offset] / canvas.width, y: lines.data32S[offset + 1] / canvas.height };
          const second = { x: lines.data32S[offset + 2] / canvas.width, y: lines.data32S[offset + 3] / canvas.height };
          segments.push({
            line: [first, second],
            length: distance(first, second),
            angle: ((segmentAngle(first, second) % Math.PI) + Math.PI) % Math.PI,
            midpoint: { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 },
          });
        }
        const strongest = segments.sort((first, second) => second.length - first.length).slice(0, 22);
        const pairs: Array<{ first: typeof strongest[number]; second: typeof strongest[number]; angle: number; score: number }> = [];
        for (let firstIndex = 0; firstIndex < strongest.length; firstIndex += 1) {
          for (let secondIndex = firstIndex + 1; secondIndex < strongest.length; secondIndex += 1) {
            const first = strongest[firstIndex];
            const second = strongest[secondIndex];
            const angleDifference = radiansBetween(first.angle, second.angle);
            if (angleDifference > Math.PI / 10) continue;
            const averageAngle = averageParallelAngle(first.angle, second.angle);
            const midpointDelta = { x: second.midpoint.x - first.midpoint.x, y: second.midpoint.y - first.midpoint.y };
            const separation = Math.abs(midpointDelta.x * -Math.sin(averageAngle) + midpointDelta.y * Math.cos(averageAngle));
            if (separation < 0.12) continue;
            pairs.push({ first, second, angle: averageAngle, score: separation * (first.length + second.length) * (1 - angleDifference / (Math.PI / 10)) });
          }
        }
        // Retain enough pairs to preserve both long horizontal edges and the
        // usually shorter vertical edges of a landscape ID card.
        const strongestPairs = pairs.sort((first, second) => second.score - first.score).slice(0, 80);
        let best: BestQuadrilateral | null = null;
        for (let firstIndex = 0; firstIndex < strongestPairs.length; firstIndex += 1) {
          for (let secondIndex = firstIndex + 1; secondIndex < strongestPairs.length; secondIndex += 1) {
            const firstPair = strongestPairs[firstIndex];
            const secondPair = strongestPairs[secondIndex];
            const orthogonalError = Math.abs(radiansBetween(firstPair.angle, secondPair.angle) - Math.PI / 2);
            if (orthogonalError > Math.PI / 7) continue;
            const intersections = [
              lineIntersection(firstPair.first.line, secondPair.first.line),
              lineIntersection(firstPair.first.line, secondPair.second.line),
              lineIntersection(firstPair.second.line, secondPair.second.line),
              lineIntersection(firstPair.second.line, secondPair.first.line),
            ];
            if (intersections.some((point) => !point || point.x < -0.08 || point.x > 1.08 || point.y < -0.08 || point.y > 1.08)) continue;
            const ordered = orderDocumentPoints(intersections as Point[]);
            const scored = scoreQuadrilateral(ordered, evidence);
            if (scored && (!best || scored.score > best.score)) best = scored;
          }
        }
        return best;
      } finally {
        lines.delete();
      }
    };

    const toDetection = (best: { points: [Point, Point, Point, Point]; confidence: number; rotated: boolean } | null): DetectionResult | null => best ? ({
      corners: best.points,
      confidence: best.confidence,
      found: best.confidence >= 0.58,
      rotated: best.rotated,
      aspectRatio: canvas.width / canvas.height,
    }) : null;
    let bestCanny: BestQuadrilateral | null = null;

    for (const pass of cannyPasses) {
      const blurred = new cv.Mat();
      const canny = new cv.Mat();
      const cannyClosed = new cv.Mat();
      const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(pass.kernel, pass.kernel));
      try {
        cv.GaussianBlur(gray, blurred, new cv.Size(pass.blur, pass.blur), 0, 0, cv.BORDER_DEFAULT);
        cv.Canny(blurred, canny, pass.low, pass.high);
        cv.morphologyEx(canny, cannyClosed, cv.MORPH_CLOSE, kernel, new cv.Point(-1, -1), pass.close);
        if (pass.dilate > 0) cv.dilate(cannyClosed, cannyClosed, kernel, new cv.Point(-1, -1), pass.dilate);
        const contourCanny = analyzeForeground(cannyClosed, canny);
        const pairedLines = analyzeLinePairs(canny);
        const passBest = pairedLines && (!contourCanny || pairedLines.score > contourCanny.score) ? pairedLines : contourCanny;
        if (passBest && (!bestCanny || passBest.score > bestCanny.score)) bestCanny = passBest;
      } finally {
        kernel.delete();
        cannyClosed.delete();
        canny.delete();
        blurred.delete();
      }
    }

    const cannyDetection = toDetection(bestCanny);
    const candidates: OpenCvCropCandidate[] = [];
    if (cannyDetection) candidates.push({ id: "canny", label: "Canny edges", detail: "Compares multiple edge passes, follows supported outer edges, and reinforces long opposite line pairs.", detection: cannyDetection });
    return candidates;
  } finally {
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
