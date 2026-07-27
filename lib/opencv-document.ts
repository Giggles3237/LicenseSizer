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
    type BestQuadrilateral = {
      points: [Point, Point, Point, Point];
      score: number;
      confidence: number;
      rotated: boolean;
      signal: "canny-contour" | "canny-lines" | "equalized-contour" | "equalized-lines" | "lab-foreground";
    };
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
      const edgeRatios: number[] = [];
      const radius = Math.max(2, Math.round(Math.min(canvas.width, canvas.height) * 0.004));
      for (let edge = 0; edge < 4; edge += 1) {
        let edgeSupported = 0;
        let edgeSamples = 0;
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
          edgeSupported += Number(hit);
          samples += 1;
          edgeSamples += 1;
        }
        edgeRatios.push(edgeSupported / Math.max(1, edgeSamples));
      }
      return {
        average: supported / Math.max(1, samples),
        minimum: Math.min(...edgeRatios),
      };
    };
    const cornerDistance = (first: [Point, Point, Point, Point], second: [Point, Point, Point, Point]) =>
      first.reduce((sum, point, index) => sum + Math.hypot(point.x - second[index].x, point.y - second[index].y), 0) / 4;
    const scoreQuadrilateral = (
      points: [Point, Point, Point, Point],
      evidence: any,
      signal: BestQuadrilateral["signal"],
    ): BestQuadrilateral | null => {
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
      const guideCornerScore = hint
        ? Math.max(0, 1 - cornerDistance(points, orderDocumentPoints(hint)) / 0.22)
        : centerScore;
      const topBottomAngle = radiansBetween(segmentAngle(points[0], points[1]), segmentAngle(points[3], points[2]));
      const leftRightAngle = radiansBetween(segmentAngle(points[0], points[3]), segmentAngle(points[1], points[2]));
      const parallelScore = (
        Math.max(0, 1 - topBottomAngle / (Math.PI / 7)) +
        Math.max(0, 1 - leftRightAngle / (Math.PI / 7))
      ) / 2;
      const lengthSymmetry = Math.max(0, 1 - Math.abs(top - bottom) / Math.max(top, bottom) - Math.abs(left - right) / Math.max(left, right));
      const edgeScores = edgeSupport(points, evidence);
      const boundaryScore = edgeScores.average * 0.7 + edgeScores.minimum * 0.3;
      const frameClearance = Math.min(...points.flatMap((point) => [point.x, point.y, 1 - point.x, 1 - point.y]));
      const frameScore = Math.max(0, Math.min(1, frameClearance / 0.025));
      const confidence = hint
        ? areaScore * 0.1 + ratioScore * 0.18 + centerScore * 0.05 + guideCornerScore * 0.25 + parallelScore * 0.13 + lengthSymmetry * 0.06 + boundaryScore * 0.15 + frameScore * 0.08
        : areaScore * 0.13 + ratioScore * 0.23 + centerScore * 0.1 + parallelScore * 0.16 + lengthSymmetry * 0.08 + boundaryScore * 0.2 + frameScore * 0.1;
      const score = confidence * (0.78 + areaScore * 0.22) * (0.35 + frameScore * 0.65);
      return { points, score, confidence, rotated: verticalCard(points), signal };
    };
    const analyzeForeground = (input: any, evidence: any, signal: BestQuadrilateral["signal"]) => {
      let best: BestQuadrilateral | null = null;
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
                const scored = scoreQuadrilateral(ordered, evidence, signal);
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

    const analyzeLinePairs = (evidence: any, signal: BestQuadrilateral["signal"]): BestQuadrilateral | null => {
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
        const strongest = segments.sort((first, second) => second.length - first.length).slice(0, 40);
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
            const scored = scoreQuadrilateral(ordered, evidence, signal);
            if (scored && (!best || scored.score > best.score)) best = scored;
          }
        }
        return best;
      } finally {
        lines.delete();
      }
    };

    const rankCandidates = (rawCandidates: BestQuadrilateral[]) => {
      const unique: BestQuadrilateral[] = [];
      for (const candidate of rawCandidates.sort((first, second) => second.score - first.score)) {
        const duplicate = unique.find((existing) => existing.signal === candidate.signal && cornerDistance(existing.points, candidate.points) < 0.025);
        if (!duplicate) unique.push(candidate);
      }
      const ranked = unique.map((candidate) => {
        const agreeingSignals = new Set(
          unique
            .filter((other) => cornerDistance(candidate.points, other.points) < 0.065)
            .map((other) => other.signal),
        ).size;
        const agreement = Math.min(1, agreeingSignals / 3);
        return { candidate, agreement, rank: candidate.score * (0.82 + agreement * 0.18) };
      }).sort((first, second) => second.rank - first.rank);
      const winner = ranked[0];
      if (!winner) return null;
      const runnerUp = ranked.find((entry) => cornerDistance(winner.candidate.points, entry.candidate.points) >= 0.055);
      const margin = runnerUp
        ? Math.max(0, Math.min(1, (winner.rank - runnerUp.rank) / 0.12))
        : 1;
      return {
        ...winner.candidate,
        confidence: Math.max(0, Math.min(1, winner.candidate.confidence * (0.84 + winner.agreement * 0.1 + margin * 0.06))),
        ambiguous: Boolean(runnerUp) && margin < 0.22,
      };
    };
    const toDetection = (best: (BestQuadrilateral & { ambiguous: boolean }) | null): DetectionResult | null => best ? ({
      corners: best.points,
      confidence: best.confidence,
      found: best.confidence >= 0.64 && !best.ambiguous,
      rotated: best.rotated,
      aspectRatio: canvas.width / canvas.height,
    }) : null;
    const rawCandidates: BestQuadrilateral[] = [];
    let primaryEdges: any = null;

    for (let passIndex = 0; passIndex < cannyPasses.length; passIndex += 1) {
      const pass = cannyPasses[passIndex];
      const blurred = new cv.Mat();
      const canny = new cv.Mat();
      const cannyClosed = new cv.Mat();
      const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(pass.kernel, pass.kernel));
      try {
        cv.GaussianBlur(gray, blurred, new cv.Size(pass.blur, pass.blur), 0, 0, cv.BORDER_DEFAULT);
        cv.Canny(blurred, canny, pass.low, pass.high);
        cv.morphologyEx(canny, cannyClosed, cv.MORPH_CLOSE, kernel, new cv.Point(-1, -1), pass.close);
        if (pass.dilate > 0) cv.dilate(cannyClosed, cannyClosed, kernel, new cv.Point(-1, -1), pass.dilate);
        if (passIndex === 0) primaryEdges = canny.clone();
        const contourCanny = analyzeForeground(cannyClosed, canny, "canny-contour");
        const pairedLines = analyzeLinePairs(canny, "canny-lines");
        if (contourCanny) rawCandidates.push(contourCanny);
        if (pairedLines) rawCandidates.push(pairedLines);
      } finally {
        kernel.delete();
        cannyClosed.delete();
        canny.delete();
        blurred.delete();
      }
    }

    const equalized = new cv.Mat();
    const equalizedBlurred = new cv.Mat();
    const equalizedEdges = new cv.Mat();
    const equalizedClosed = new cv.Mat();
    const equalizedKernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));
    try {
      cv.equalizeHist(gray, equalized);
      cv.GaussianBlur(equalized, equalizedBlurred, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);
      cv.Canny(equalizedBlurred, equalizedEdges, 45, 140);
      cv.morphologyEx(equalizedEdges, equalizedClosed, cv.MORPH_CLOSE, equalizedKernel, new cv.Point(-1, -1), 2);
      const equalizedContour = analyzeForeground(equalizedClosed, equalizedEdges, "equalized-contour");
      const equalizedLines = analyzeLinePairs(equalizedEdges, "equalized-lines");
      if (equalizedContour) rawCandidates.push(equalizedContour);
      if (equalizedLines) rawCandidates.push(equalizedLines);
    } finally {
      equalizedKernel.delete();
      equalizedClosed.delete();
      equalizedEdges.delete();
      equalizedBlurred.delete();
      equalized.delete();
    }

    const rgb = new cv.Mat();
    const lab = new cv.Mat();
    const foregroundMask = new cv.Mat();
    const cleanedMask = new cv.Mat();
    const foregroundKernel = cv.getStructuringElement(
      cv.MORPH_ELLIPSE,
      new cv.Size(Math.max(5, Math.round(Math.min(canvas.width, canvas.height) * 0.012) | 1), Math.max(5, Math.round(Math.min(canvas.width, canvas.height) * 0.012) | 1)),
    );
    try {
      cv.cvtColor(src, rgb, cv.COLOR_RGBA2RGB);
      cv.cvtColor(rgb, lab, cv.COLOR_RGB2Lab);
      foregroundMask.create(canvas.height, canvas.width, cv.CV_8UC1);
      const rim = Math.max(4, Math.round(Math.min(canvas.width, canvas.height) * 0.035));
      const samples: number[][] = [[], [], []];
      for (let y = 0; y < canvas.height; y += 4) {
        for (let x = 0; x < canvas.width; x += 4) {
          if (x >= rim && x < canvas.width - rim && y >= rim && y < canvas.height - rim) continue;
          const offset = (y * canvas.width + x) * 3;
          samples[0].push(lab.data[offset]);
          samples[1].push(lab.data[offset + 1]);
          samples[2].push(lab.data[offset + 2]);
        }
      }
      const median = (values: number[]) => values.sort((first, second) => first - second)[Math.floor(values.length / 2)] ?? 0;
      const background = samples.map(median);
      for (let pixel = 0; pixel < canvas.width * canvas.height; pixel += 1) {
        const offset = pixel * 3;
        const dl = lab.data[offset] - background[0];
        const da = lab.data[offset + 1] - background[1];
        const db = lab.data[offset + 2] - background[2];
        foregroundMask.data[pixel] = Math.sqrt(dl * dl * 0.7 + da * da + db * db) > 22 ? 255 : 0;
      }
      cv.morphologyEx(foregroundMask, cleanedMask, cv.MORPH_OPEN, foregroundKernel, new cv.Point(-1, -1), 1);
      cv.morphologyEx(cleanedMask, cleanedMask, cv.MORPH_CLOSE, foregroundKernel, new cv.Point(-1, -1), 2);
      const foreground = analyzeForeground(cleanedMask, primaryEdges ?? foregroundMask, "lab-foreground");
      if (foreground) rawCandidates.push(foreground);
    } finally {
      foregroundKernel.delete();
      cleanedMask.delete();
      foregroundMask.delete();
      lab.delete();
      rgb.delete();
      primaryEdges?.delete();
    }

    const cannyDetection = toDetection(rankCandidates(rawCandidates));
    const candidates: OpenCvCropCandidate[] = [];
    if (cannyDetection) candidates.push({ id: "canny", label: "Combined edge detection", detail: "Combines grayscale, contrast-normalized, background-segmentation, contour, and line evidence.", detection: cannyDetection });
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
