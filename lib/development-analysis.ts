/* eslint-disable @typescript-eslint/no-explicit-any */
import type { DetectionResult, Point } from "./image-processing";
import { sourceToCanvas } from "./image-processing";
import { loadOpenCv } from "./opencv-document";

export const DEVELOPMENT_ANALYSIS_VIEWS = [
  { id: "original", label: "Original image", detail: "The resized image supplied to the detector." },
  { id: "grayscale", label: "Grayscale", detail: "Luminance-only image used by edge detectors." },
  { id: "gaussian-blur", label: "Gaussian blur", detail: "Noise-reduced grayscale experiment before edge detection." },
  { id: "background-mask", label: "Background difference mask", detail: "Pixels whose Lab color differs from the outer rim of the photo." },
  { id: "cleaned-mask", label: "Cleaned foreground mask", detail: "The actual mask searched by the primary document detector after open/close morphology." },
  { id: "canny", label: "Canny edges", detail: "An experimental thin edge map after Gaussian blur." },
  { id: "sobel", label: "Sobel edge strength", detail: "Gradient strength used by the lightweight fallback detector." },
  { id: "dilated-edges", label: "Thresholded + dilated edges", detail: "Connected edge regions used by the lightweight fallback detector." },
  { id: "contour-skin", label: "Contour skin", detail: "Contours extracted from the cleaned foreground mask, drawn as a wireframe." },
  { id: "detected-overlay", label: "Contours + detected crop", detail: "Candidate contours over the photo with the detector's chosen quadrilateral in red." },
] as const;

export type DevelopmentAnalysisView = (typeof DEVELOPMENT_ANALYSIS_VIEWS)[number]["id"];

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob(
    (blob) => blob ? resolve(blob) : reject(new Error("Unable to render this analysis view.")),
    "image/png",
  ));
}

function displayMat(cv: any, mat: any) {
  const canvas = document.createElement("canvas");
  canvas.width = mat.cols;
  canvas.height = mat.rows;
  cv.imshow(canvas, mat);
  return canvas;
}

function drawPolygon(cv: any, target: any, points: Point[], width: number, height: number) {
  if (points.length !== 4) return;
  const pixels = points.flatMap((point) => [
    Math.round(point.x * (width - 1)),
    Math.round(point.y * (height - 1)),
  ]);
  const polygon = cv.matFromArray(4, 1, cv.CV_32SC2, pixels);
  const polygons = new cv.MatVector();
  polygons.push_back(polygon);
  try {
    cv.polylines(target, polygons, true, new cv.Scalar(255, 72, 72, 255), 5, cv.LINE_AA);
  } finally {
    polygons.delete();
    polygon.delete();
  }
}

/** Creates a selected, on-demand diagnostic image. Nothing leaves the browser. */
export async function createDevelopmentAnalysisView(
  source: Blob,
  view: DevelopmentAnalysisView,
  detection?: DetectionResult | null,
): Promise<Blob> {
  const canvas = await sourceToCanvas(source, 960);
  if (view === "original") return canvasToBlob(canvas);

  const cv = await loadOpenCv();
  const src = cv.imread(canvas);
  const rgb = new cv.Mat();
  const gray = new cv.Mat();
  const blurred = new cv.Mat();
  const lab = new cv.Mat();
  const mask = new cv.Mat();
  const cleaned = new cv.Mat();
  const canny = new cv.Mat();
  const gradX = new cv.Mat();
  const gradY = new cv.Mat();
  const absX = new cv.Mat();
  const absY = new cv.Mat();
  const sobel = new cv.Mat();
  const thresholded = new cv.Mat();
  const dilated = new cv.Mat();
  const morphologyKernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(11, 11));
  const edgeKernel = cv.getStructuringElement(cv.MORPH_CROSS, new cv.Size(3, 3));

  try {
    cv.cvtColor(src, rgb, cv.COLOR_RGBA2RGB);
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, blurred, new cv.Size(7, 7), 0, 0, cv.BORDER_DEFAULT);
    cv.Canny(blurred, canny, 55, 150);

    // Keep this segmentation in lockstep with detectDocumentWithOpenCv.
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
    cv.morphologyEx(mask, cleaned, cv.MORPH_OPEN, morphologyKernel, new cv.Point(-1, -1), 1);
    cv.morphologyEx(cleaned, cleaned, cv.MORPH_CLOSE, morphologyKernel, new cv.Point(-1, -1), 2);

    cv.Sobel(gray, gradX, cv.CV_16S, 1, 0, 3);
    cv.Sobel(gray, gradY, cv.CV_16S, 0, 1, 3);
    cv.convertScaleAbs(gradX, absX);
    cv.convertScaleAbs(gradY, absY);
    cv.addWeighted(absX, 0.5, absY, 0.5, 0, sobel);
    cv.threshold(sobel, thresholded, 42, 255, cv.THRESH_BINARY);
    cv.dilate(thresholded, dilated, edgeKernel, new cv.Point(-1, -1), 2);

    let rendered: any;
    if (view === "grayscale") rendered = gray;
    else if (view === "gaussian-blur") rendered = blurred;
    else if (view === "background-mask") rendered = mask;
    else if (view === "cleaned-mask") rendered = cleaned;
    else if (view === "canny") rendered = canny;
    else if (view === "sobel") rendered = sobel;
    else if (view === "dilated-edges") rendered = dilated;
    else {
      const contourInput = cleaned.clone();
      const contours = new cv.MatVector();
      const hierarchy = new cv.Mat();
      const overlay = view === "contour-skin"
        ? cv.Mat.zeros(src.rows, src.cols, cv.CV_8UC4)
        : src.clone();
      try {
        cv.findContours(contourInput, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);
        cv.drawContours(
          overlay,
          contours,
          -1,
          view === "contour-skin" ? new cv.Scalar(84, 255, 199, 255) : new cv.Scalar(55, 225, 178, 255),
          view === "contour-skin" ? 2 : 3,
          cv.LINE_AA,
        );
        if (view === "detected-overlay" && detection?.corners) {
          drawPolygon(cv, overlay, detection.corners, canvas.width, canvas.height);
        }
        const outputCanvas = displayMat(cv, overlay);
        return await canvasToBlob(outputCanvas);
      } finally {
        overlay.delete();
        hierarchy.delete();
        contours.delete();
        contourInput.delete();
      }
    }

    return canvasToBlob(displayMat(cv, rendered));
  } finally {
    edgeKernel.delete();
    morphologyKernel.delete();
    dilated.delete();
    thresholded.delete();
    sobel.delete();
    absY.delete();
    absX.delete();
    gradY.delete();
    gradX.delete();
    canny.delete();
    cleaned.delete();
    mask.delete();
    lab.delete();
    blurred.delete();
    gray.delete();
    rgb.delete();
    src.delete();
  }
}
