"use client";

import { ChangeEvent, KeyboardEvent, PointerEvent, useCallback, useEffect, useRef, useState } from "react";
import { analyzeImage, correctPerspective, DEFAULT_CORNERS, detectDocumentCandidates, DetectionResult, enhanceImage, Point, QualityResult, sourceToCanvas, validateImage } from "../lib/image-processing";
import { mapGuideToVideoCorners } from "../lib/camera-geometry";
import { cornersToEdgeLines, coveredViewportCornersToSource, edgeLinesToCorners, type EdgeLine } from "../lib/document-geometry";
import { createDevelopmentAnalysisView, DEVELOPMENT_ANALYSIS_VIEWS, type DevelopmentAnalysisView } from "../lib/development-analysis";
import type { PdfOptions } from "../lib/pdf";
import { DEFAULT_DELIVERY_PROFILE, type ActivityEventType, type DealerDeliveryProfile } from "../lib/dealer";
import LicenseResizerBrand from "./brand-logo";

type Side = "front" | "back";
type Stage = "start" | "capture" | "review" | "ready" | "complete";
type CapturedSide = {
  source: Blob;
  sourceUrl: string;
  sourceAspect: number;
  cropAspect: number;
  corrected: Blob;
  correctedUrl: string;
  enhanced: boolean;
  corners: [Point, Point, Point, Point];
};
type PdfQuota = { allowed: boolean; used: number; limit: number | null; resetsAt: string | null };

const sideLabel = (side: Side) => (side === "front" ? "front" : "back");
const LINE_NAMES = ["Top", "Right", "Bottom", "Left"] as const;
const framingCopy = (detection: DetectionResult | null) => {
  if (detection?.automaticStatus === "analyzer-unavailable") {
    return {
      intro: "We found your license. Adjust if needed, then continue.",
      badge: "Automatic framing unavailable — manual adjustment required",
      ready: false,
    };
  }
  if (detection?.found) {
    return {
      intro: "We found your license. Adjust if needed, then continue.",
      badge: detection.automaticStatus === "fallback-detected" ? "Fallback framing ready to review" : "Framing ready to review",
      ready: true,
    };
  }
  return {
    intro: "We found your license. Adjust if needed, then continue.",
    badge: "Manual framing required",
    ready: false,
  };
};
const MAX_UPLOADED_PDF_BYTES = 25 * 1024 * 1024;
const pdfFilename = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `license-copy-${year}-${month}-${day}.pdf`;
};
const isPdfFile = (file: File) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

async function rotateImageClockwise(source: Blob): Promise<Blob> {
  const input = await sourceToCanvas(source);
  const output = document.createElement("canvas");
  output.width = input.height;
  output.height = input.width;
  const context = output.getContext("2d");
  if (!context) throw new Error("Unable to rotate the photo.");
  context.translate(output.width, 0);
  context.rotate(Math.PI / 2);
  context.drawImage(input, 0, 0);
  return new Promise((resolve, reject) => output.toBlob(
    (blob) => blob ? resolve(blob) : reject(new Error("Unable to rotate the photo.")),
    "image/jpeg",
    0.92,
  ));
}

async function rotateImageCounterClockwise(source: Blob): Promise<Blob> {
  const input = await sourceToCanvas(source);
  const output = document.createElement("canvas");
  output.width = input.height;
  output.height = input.width;
  const context = output.getContext("2d");
  if (!context) throw new Error("Unable to rotate the photo.");
  context.translate(0, output.height);
  context.rotate(-Math.PI / 2);
  context.drawImage(input, 0, 0);
  return new Promise((resolve, reject) => output.toBlob(
    (blob) => blob ? resolve(blob) : reject(new Error("Unable to rotate the photo.")),
    "image/jpeg",
    0.92,
  ));
}

const rotateCornersCounterClockwise = (
  corners: [Point, Point, Point, Point],
): [Point, Point, Point, Point] => corners.map(({ x, y }) => ({ x: y, y: 1 - x })) as [Point, Point, Point, Point];

function Progress({ stage }: { stage: Stage }) {
  const steps = ["Take a photo", "Looks good?", "Share your PDF"];
  const current = stage === "start" || stage === "capture" ? 0 : stage === "review" || stage === "ready" ? 1 : 2;
  return (
    <ol className="progress" aria-label={`Step ${current + 1} of 3: ${steps[current]}`}>
      {steps.map((step, index) => (
        <li key={step} className={index <= current ? "active" : ""} aria-current={index === current ? "step" : undefined}>
          <span>{index + 1}</span>{step}
        </li>
      ))}
    </ol>
  );
}

const CORNER_LABELS = ["Top left", "Top right", "Bottom right", "Bottom left"] as const;

function CornerHandles({
  corners,
  onKey,
  onStart,
}: {
  corners: [Point, Point, Point, Point];
  onKey: (event: KeyboardEvent<HTMLButtonElement>, cornerIndex: number) => void;
  onStart: (event: PointerEvent<HTMLButtonElement>, cornerIndex: number) => void;
}) {
  return corners.map((point, cornerIndex) => (
    <button
      key={CORNER_LABELS[cornerIndex]}
      className="crop-handle corner-handle"
      style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}
      aria-label={`${CORNER_LABELS[cornerIndex]} corner. Drag to adjust the framing, or use arrow keys.`}
      onKeyDown={(event) => onKey(event, cornerIndex)}
      onPointerDown={(event) => onStart(event, cornerIndex)}
    >
      <span aria-hidden="true" />
    </button>
  ));
}

export default function LicenseResizerApp({ deliveryProfile = DEFAULT_DELIVERY_PROFILE }: { deliveryProfile?: DealerDeliveryProfile }) {
  const [interactive, setInteractive] = useState(false);
  const [stage, setStage] = useState<Stage>("start");
  const [activeSide, setActiveSide] = useState<Side>("front");
  const [front, setFront] = useState<CapturedSide | null>(null);
  const [back, setBack] = useState<CapturedSide | null>(null);
  const [draft, setDraft] = useState<Blob | null>(null);
  const [draftUrl, setDraftUrl] = useState("");
  const [edgeLines, setEdgeLines] = useState<[EdgeLine, EdgeLine, EdgeLine, EdgeLine]>(() => cornersToEdgeLines(DEFAULT_CORNERS));
  const [selectedLine, setSelectedLine] = useState(0);
  const [quality, setQuality] = useState<QualityResult | null>(null);
  const [detection, setDetection] = useState<DetectionResult | null>(null);
  const [draftAspect, setDraftAspect] = useState(1.333);
  const [draftSourceAspect, setDraftSourceAspect] = useState(1.333);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preparingImage, setPreparingImage] = useState(false);
  const [message, setMessage] = useState("");
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfUrl, setPdfUrl] = useState("");
  const [pdfDownloadName, setPdfDownloadName] = useState("");
  const [developmentOpen, setDevelopmentOpen] = useState(false);
  const [analysisView, setAnalysisView] = useState<DevelopmentAnalysisView>("contour-skin");
  const [analysisUrl, setAnalysisUrl] = useState("");
  const [analysisBusy, setAnalysisBusy] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const [options] = useState<PdfOptions & { quality: "standard" | "high" }>({
    pageSize: deliveryProfile.pageSize,
    layout: deliveryProfile.backMode === "front-only" ? "front-only" : deliveryProfile.layout,
    labels: deliveryProfile.labels,
    cropMarks: deliveryProfile.cropMarks,
    quality: deliveryProfile.quality,
  });
  const [deliveryEmail] = useState(deliveryProfile.destinationEmail);
  const [deliveryPhone] = useState(deliveryProfile.destinationPhone);
  const [deliverySubject] = useState(deliveryProfile.messageSubject);
  const [deliveryMessage] = useState(deliveryProfile.messageBody);
  const [copiedDestination, setCopiedDestination] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const guideRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cropRef = useRef<HTMLDivElement>(null);
  const analysisUrlRef = useRef("");
  const analysisRequestRef = useRef(0);
  const preparationRequestRef = useRef(0);
  const dragHandle = useRef<
    | { kind: "corner"; corner: number }
    | { kind: "line"; line: number; pointer: Point; initial: EdgeLine }
    | null
  >(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOpen(false);
    setCameraReady(false);
  }, []);

  const postActivity = useCallback((eventType: ActivityEventType, deliveryChannel?: string) => {
    return fetch("/api/activity", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ publicSlug: deliveryProfile.publicSlug, eventType, deliveryChannel }),
      keepalive: true,
    }).catch(() => undefined);
  }, [deliveryProfile.publicSlug]);

  const checkPdfQuota = useCallback(async () => {
    const response = await fetch("/api/activity/quota", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ publicSlug: deliveryProfile.publicSlug }),
    });
    if (!response.ok) throw new Error("Usage could not be checked. Please try again.");
    const quota = await response.json() as PdfQuota;
    if (!quota.allowed) throw new Error(`This plan has reached its ${quota.limit} PDF monthly limit. It resets ${quota.resetsAt ? new Date(quota.resetsAt).toLocaleDateString() : "next month"}.`);
  }, [deliveryProfile.publicSlug]);

  const releaseAnalysisView = useCallback(() => {
    analysisRequestRef.current += 1;
    if (analysisUrlRef.current) URL.revokeObjectURL(analysisUrlRef.current);
    analysisUrlRef.current = "";
    setAnalysisUrl("");
    setAnalysisBusy(false);
    setAnalysisError("");
  }, []);

  const clearDraft = useCallback(() => {
    releaseAnalysisView();
    setDevelopmentOpen(false);
    if (draftUrl) URL.revokeObjectURL(draftUrl);
    setDraft(null);
    setDraftUrl("");
    setQuality(null);
    setDetection(null);
    setEdgeLines(cornersToEdgeLines(DEFAULT_CORNERS));
  }, [draftUrl, releaseAnalysisView]);

  const startOver = useCallback(() => {
    preparationRequestRef.current += 1;
    void postActivity("session_cleared");
    stopCamera();
    clearDraft();
    if (front) {
      URL.revokeObjectURL(front.sourceUrl);
      URL.revokeObjectURL(front.correctedUrl);
    }
    if (back) {
      URL.revokeObjectURL(back.sourceUrl);
      URL.revokeObjectURL(back.correctedUrl);
    }
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setFront(null);
    setBack(null);
    setPdfBlob(null);
    setPdfUrl("");
    setPdfDownloadName("");
    setActiveSide("front");
    setMessage("");
    setPreparingImage(false);
    setBusy(false);
    setStage("start");
  }, [back, clearDraft, front, pdfUrl, postActivity, stopCamera]);

  useEffect(() => {
    const readyTimer = window.setTimeout(() => setInteractive(true), 0);
    return () => window.clearTimeout(readyTimer);
  }, []);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) stopCamera();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [stopCamera]);

  useEffect(() => {
    if ("serviceWorker" in navigator && window.isSecureContext) {
      let refreshing = false;
      const onControllerChange = () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      };
      navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
      navigator.serviceWorker.register("/sw.js").then((registration) => registration.update()).catch(() => undefined);
      return () => navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    }
  }, []);

  useEffect(() => {
    if (!cameraOpen || !videoRef.current || !streamRef.current) return;
    const video = videoRef.current;
    video.srcObject = streamRef.current;
    const beginPreview = () => {
      void video.play().then(() => setCameraReady(true)).catch(() => setMessage("Tap the preview to start the camera."));
    };
    if (video.readyState >= 1) beginPreview();
    else video.addEventListener("loadedmetadata", beginPreview, { once: true });
    return () => video.removeEventListener("loadedmetadata", beginPreview);
  }, [cameraOpen]);

  useEffect(() => {
    document.body.classList.toggle("camera-active", cameraOpen);
    return () => document.body.classList.remove("camera-active");
  }, [cameraOpen]);

  useEffect(() => () => {
    preparationRequestRef.current += 1;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (analysisUrlRef.current) URL.revokeObjectURL(analysisUrlRef.current);
  }, []);

  const generateDevelopmentView = async (view: DevelopmentAnalysisView) => {
    if (!draft) return;
    const request = analysisRequestRef.current + 1;
    analysisRequestRef.current = request;
    setAnalysisBusy(true);
    setAnalysisError("");
    try {
      const blob = await createDevelopmentAnalysisView(draft, view, detection);
      if (analysisRequestRef.current !== request) return;
      const objectUrl = URL.createObjectURL(blob);
      if (analysisUrlRef.current) URL.revokeObjectURL(analysisUrlRef.current);
      analysisUrlRef.current = objectUrl;
      setAnalysisUrl(objectUrl);
    } catch (error) {
      if (analysisRequestRef.current === request) setAnalysisError(error instanceof Error ? error.message : "This analysis view could not be generated.");
    } finally {
      if (analysisRequestRef.current === request) setAnalysisBusy(false);
    }
  };

  const toggleDevelopmentView = () => {
    if (developmentOpen) {
      setDevelopmentOpen(false);
      releaseAnalysisView();
      return;
    }
    setDevelopmentOpen(true);
    void generateDevelopmentView(analysisView);
  };

  const prepareDraft = async (
    blob: Blob,
    guideCorners?: [Point, Point, Point, Point],
    options: { normalizeOrientation?: boolean; initialMessage?: string } = {},
  ) => {
    const normalizeOrientation = options.normalizeOrientation ?? true;
    const request = preparationRequestRef.current + 1;
    preparationRequestRef.current = request;
    setBusy(true);
    setPreparingImage(true);
    setMessage(options.initialMessage ?? "Checking the photo orientation…");
    try {
      await validateImage(blob);
      if (preparationRequestRef.current !== request) return;
      stopCamera();
      clearDraft();
      const initialCandidates = await detectDocumentCandidates(blob, guideCorners);
      if (preparationRequestRef.current !== request) return;
      const initialDetection = initialCandidates[0].detection;
      const shouldNormalizeOrientation = normalizeOrientation && initialDetection.found && initialDetection.rotated;
      const preparedBlob = shouldNormalizeOrientation ? await rotateImageCounterClockwise(blob) : blob;
      if (preparationRequestRef.current !== request) return;
      const preparedGuide = shouldNormalizeOrientation && guideCorners
        ? rotateCornersCounterClockwise(guideCorners)
        : guideCorners;
      setMessage(shouldNormalizeOrientation
        ? "Rotated. Finding the cleanest framing…"
        : "Finding the cleanest framing…");
      const url = URL.createObjectURL(preparedBlob);
      setDraft(preparedBlob);
      setDraftUrl(url);
      const [qualityResult, candidates] = shouldNormalizeOrientation
        ? await Promise.all([analyzeImage(preparedBlob), detectDocumentCandidates(preparedBlob, preparedGuide)])
        : [await analyzeImage(preparedBlob), initialCandidates];
      if (preparationRequestRef.current !== request) {
        URL.revokeObjectURL(url);
        return;
      }
      const detectionResult = candidates[0].detection;
      setQuality(qualityResult);
      setDetection(detectionResult);
      setDraftAspect(detectionResult.aspectRatio);
      setDraftSourceAspect(detectionResult.aspectRatio);
      setEdgeLines(cornersToEdgeLines(detectionResult.corners));
      setStage("review");
      setMessage("");
    } catch (error) {
      if (preparationRequestRef.current === request) {
        setMessage(error instanceof Error ? error.message : "That image could not be opened.");
      }
    } finally {
      if (preparationRequestRef.current === request) {
        setPreparingImage(false);
        setBusy(false);
      }
    }
  };

  const preparePdfDraft = async (file: File) => {
    setBusy(true);
    setMessage("Rendering the first PDF page for cropping on this device…");
    try {
      if (file.size > MAX_UPLOADED_PDF_BYTES) throw new Error("This PDF is larger than 25 MB. Choose a smaller file.");
      const { renderPdfFirstPageToImage } = await import("../lib/pdf-rendering");
      const renderedPage = await renderPdfFirstPageToImage(file);
      await prepareDraft(renderedPage);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "That PDF could not be prepared for cropping.");
      setBusy(false);
    }
  };

  const chooseFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (isPdfFile(file)) void preparePdfDraft(file);
    else void prepareDraft(file);
  };

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setMessage("This browser does not support the guided camera. Choose a photo or PDF from this device instead.");
      fileRef.current?.click();
      return;
    }
    setBusy(true);
    setMessage("Opening the guided camera...");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = stream;
      setCameraReady(false);
      setCameraOpen(true);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof DOMException && error.name === "NotAllowedError"
        ? "Camera access was blocked. Choose a photo or PDF from this device, or allow camera access in your browser settings."
        : "The guided camera could not be opened. Choose a photo or PDF from this device instead.");
    } finally {
      setBusy(false);
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    const guide = guideRef.current;
    if (!video || !guide || video.videoWidth === 0) return;
    const guideCorners = mapGuideToVideoCorners(
      guide.getBoundingClientRect(),
      video.getBoundingClientRect(),
      video.videoWidth,
      video.videoHeight,
    );
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob((blob) => blob && void prepareDraft(blob, guideCorners), "image/jpeg", 0.94);
  };

  const rotateDraft = async () => {
    if (!draft) return;
    try {
      const rotated = await rotateImageClockwise(draft);
      await prepareDraft(rotated, undefined, {
        normalizeOrientation: false,
        initialMessage: "Rotating and reprocessing the photo…",
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to rotate the photo.");
    }
  };

  const updateCorner = (cornerIndex: number, x: number, y: number) => {
    const point = { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
    setEdgeLines((current) => {
      const next = current.map((line) => ({ start: { ...line.start }, end: { ...line.end } })) as [EdgeLine, EdgeLine, EdgeLine, EdgeLine];
      if (cornerIndex === 0) {
        next[0].start = point;
        next[3].end = point;
      } else if (cornerIndex === 1) {
        next[0].end = point;
        next[1].start = point;
      } else if (cornerIndex === 2) {
        next[1].end = point;
        next[2].start = point;
      } else {
        next[2].end = point;
        next[3].start = point;
      }
      return next;
    });
  };

  const moveCornerFromPointer = (event: PointerEvent<HTMLElement>, cornerIndex: number) => {
    const bounds = cropRef.current?.getBoundingClientRect();
    if (!bounds) return;
    updateCorner(cornerIndex, (event.clientX - bounds.left) / bounds.width, (event.clientY - bounds.top) / bounds.height);
  };

  const onCornerKey = (event: KeyboardEvent<HTMLButtonElement>, cornerIndex: number) => {
    const step = event.shiftKey ? 0.025 : 0.006;
    const corners = edgeLinesToCorners(edgeLines);
    const point = corners?.[cornerIndex];
    if (!point) return;
    if (event.key === "ArrowLeft") updateCorner(cornerIndex, point.x - step, point.y);
    else if (event.key === "ArrowRight") updateCorner(cornerIndex, point.x + step, point.y);
    else if (event.key === "ArrowUp") updateCorner(cornerIndex, point.x, point.y - step);
    else if (event.key === "ArrowDown") updateCorner(cornerIndex, point.x, point.y + step);
    else return;
    event.preventDefault();
  };

  const startCornerDrag = (event: PointerEvent<HTMLButtonElement>, cornerIndex: number) => {
    setSelectedLine(cornerIndex);
    dragHandle.current = { kind: "corner", corner: cornerIndex };
    event.currentTarget.setPointerCapture(event.pointerId);
    moveCornerFromPointer(event, cornerIndex);
  };

  const startWholeLineDrag = (event: PointerEvent<HTMLButtonElement>, lineIndex: number) => {
    const bounds = cropRef.current?.getBoundingClientRect();
    if (!bounds) return;
    setSelectedLine(lineIndex);
    dragHandle.current = {
      kind: "line",
      line: lineIndex,
      pointer: { x: (event.clientX - bounds.left) / bounds.width, y: (event.clientY - bounds.top) / bounds.height },
      initial: edgeLines[lineIndex],
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const moveActiveDrag = (event: PointerEvent<HTMLDivElement>) => {
    const active = dragHandle.current;
    const bounds = cropRef.current?.getBoundingClientRect();
    if (!active || !bounds) return;
    if (active.kind === "corner") {
      moveCornerFromPointer(event, active.corner);
      return;
    }
    const pointer = { x: (event.clientX - bounds.left) / bounds.width, y: (event.clientY - bounds.top) / bounds.height };
    const requestedX = pointer.x - active.pointer.x;
    const requestedY = pointer.y - active.pointer.y;
    const minX = Math.min(active.initial.start.x, active.initial.end.x);
    const maxX = Math.max(active.initial.start.x, active.initial.end.x);
    const minY = Math.min(active.initial.start.y, active.initial.end.y);
    const maxY = Math.max(active.initial.start.y, active.initial.end.y);
    const dx = Math.max(-minX, Math.min(1 - maxX, requestedX));
    const dy = Math.max(-minY, Math.min(1 - maxY, requestedY));
    setEdgeLines((current) => current.map((line, index) => index === active.line ? {
      start: { x: active.initial.start.x + dx, y: active.initial.start.y + dy },
      end: { x: active.initial.end.x + dx, y: active.initial.end.y + dy },
    } : line) as [EdgeLine, EdgeLine, EdgeLine, EdgeLine]);
  };

  const acceptCrop = async () => {
    if (!draft) return;
    const viewportCorners = edgeLinesToCorners(edgeLines);
    if (!viewportCorners) {
      setMessage("Adjust the line ends so all four sides meet around the license.");
      return;
    }
    const sourceCorners = coveredViewportCornersToSource(viewportCorners, draftAspect, draftSourceAspect);
    setBusy(true);
    setMessage("Straightening and refining your image…");
    try {
      const corrected = await correctPerspective(draft, sourceCorners, "high");
      const item: CapturedSide = {
        source: draft,
        sourceUrl: draftUrl,
        sourceAspect: draftSourceAspect,
        cropAspect: draftAspect,
        corrected,
        correctedUrl: URL.createObjectURL(corrected),
        enhanced: false,
        corners: viewportCorners.map((point) => ({ ...point })) as [Point, Point, Point, Point],
      };
      if (activeSide === "front") {
        if (front) { URL.revokeObjectURL(front.sourceUrl); URL.revokeObjectURL(front.correctedUrl); }
        setFront(item);
        void postActivity("front_captured");
      } else {
        if (back) { URL.revokeObjectURL(back.sourceUrl); URL.revokeObjectURL(back.correctedUrl); }
        setBack(item);
        void postActivity("back_captured");
      }
      releaseAnalysisView();
      setDevelopmentOpen(false);
      setDraft(null);
      setDraftUrl("");
      setQuality(null);
      setStage("ready");
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The image could not be corrected.");
    } finally {
      setBusy(false);
    }
  };

  const editCrop = (side: Side) => {
    const item = side === "front" ? front : back;
    if (!item) return;
    if (draftUrl) URL.revokeObjectURL(draftUrl);
    setActiveSide(side);
    setDraft(item.source);
    setDraftUrl(URL.createObjectURL(item.source));
    setDraftAspect(item.cropAspect);
    setDraftSourceAspect(item.sourceAspect);
    setEdgeLines(cornersToEdgeLines(item.corners));
    const sourceCorners = coveredViewportCornersToSource(item.corners, item.cropAspect, item.sourceAspect);
    const savedDetection: DetectionResult = { corners: sourceCorners, confidence: 1, found: true, rotated: false, aspectRatio: item.sourceAspect };
    setDetection(savedDetection);
    setQuality(null);
    setMessage("");
    setStage("review");
  };

  const enhanceActiveImage = async () => {
    const item = activeSide === "front" ? front : back;
    if (!item || item.enhanced) return;
    setBusy(true);
    setMessage("Enhancing the image…");
    try {
      const enhanced = await enhanceImage(item.corrected);
      const enhancedItem: CapturedSide = {
        ...item,
        corrected: enhanced,
        correctedUrl: URL.createObjectURL(enhanced),
        enhanced: true,
      };
      URL.revokeObjectURL(item.correctedUrl);
      if (activeSide === "front") setFront(enhancedItem);
      else setBack(enhancedItem);
      setMessage("Enhanced with light color correction and contrast.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The image could not be enhanced.");
    } finally {
      setBusy(false);
    }
  };

  const beginCapture = (side: Side) => {
    stopCamera();
    clearDraft();
    setActiveSide(side);
    setMessage("");
    setStage("capture");
    if (side === "front" && !front) void postActivity("session_started");
  };

  const generatePdf = async () => {
    if (!front) return;
    setBusy(true);
    setMessage("Preparing your true-size PDF…");
    try {
      await checkPdfQuota();
      const { composePdf } = await import("../lib/pdf");
      const pdf = await composePdf(front.corrected, back?.corrected ?? null, options);
      const activityResponse = await postActivity("pdf_created");
      if (activityResponse && !activityResponse.ok) throw new Error("This plan has reached its monthly PDF limit.");
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      setPdfBlob(pdf);
      setPdfUrl(URL.createObjectURL(pdf));
      setPdfDownloadName(pdfFilename());
      setStage("complete");
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The PDF could not be created.");
    } finally {
      setBusy(false);
    }
  };

  const sharePdf = async () => {
    if (!pdfBlob) return;
    const file = new File([pdfBlob], pdfDownloadName || pdfFilename(), { type: "application/pdf" });
    if (typeof navigator.share !== "function" || typeof navigator.canShare !== "function" || !navigator.canShare({ files: [file] })) return;
    try {
      const destination = deliveryEmail ? `\n\nRequested destination: ${deliveryEmail}` : "";
      await navigator.share({ files: [file], title: deliverySubject, text: `${deliveryMessage}${destination}` });
      void postActivity("share_opened", "native-share");
      setMessage("The share sheet was opened. Confirm the correct app and recipient before sending; LicenseResizer cannot verify delivery.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setMessage("Sharing was not completed. Your download is still available below.");
    }
  };

  const copyDestination = async (value: string, label: string) => {
    try { await navigator.clipboard.writeText(value); setCopiedDestination(`${label} copied.`); }
    catch { setCopiedDestination(`Copy ${value} before opening the share sheet.`); }
  };

  const canShare = Boolean(typeof navigator !== "undefined" && pdfBlob && typeof navigator.share === "function" && typeof navigator.canShare === "function" && navigator.canShare({ files: [new File([pdfBlob], pdfDownloadName || pdfFilename(), { type: "application/pdf" })] }));
  const activePdfFilename = pdfDownloadName || pdfFilename();
  const cropCorners = edgeLinesToCorners(edgeLines);
  const cropLines = edgeLines.map((line) => {
    const dx = (line.end.x - line.start.x) * 100;
    const dy = (line.end.y - line.start.y) * 100;
    return { left: `${line.start.x * 100}%`, top: `${line.start.y * 100}%`, width: `${Math.sqrt(dx * dx + dy * dy)}%`, transform: `rotate(${Math.atan2(dy, dx)}rad)` };
  });
  const activeItem = activeSide === "front" ? front : back;
  const activeFramingCopy = framingCopy(detection);

  return (
    <main className="app-shell">
      <header className="site-header">
        {deliveryProfile.publicSlug ? (
          <a className="brand dealer-scan-brand" href={`/d/${deliveryProfile.publicSlug}`} aria-label={`${deliveryProfile.dealerName} customer page`}>
            {deliveryProfile.logoUrl ? <span className="dealer-scan-logo" role="img" aria-label={`${deliveryProfile.dealerName} logo`} style={{ backgroundImage: `url(${deliveryProfile.logoUrl})` }} /> : <span className="brand-mark" aria-hidden="true"><i /></span>}
            <span>{deliveryProfile.dealerName}</span>
          </a>
        ) : (
          <LicenseResizerBrand href="#top" />
        )}
        <div className="header-actions">{!deliveryProfile.publicSlug && <a className="dealer-link" href="/dashboard">Dealer console</a>}<div className="privacy-pill"><span /> Processed on this device</div></div>
      </header>

      {preparingImage && (
        <div className="orientation-progress-backdrop" role="status" aria-live="polite" aria-busy="true">
          <div className="orientation-progress">
            <div className="orientation-stage" aria-hidden="true">
              <div className="orientation-card">
                <span className="orientation-photo" />
                <span className="orientation-lines"><i /><i /><i /></span>
                <span className="orientation-scan" />
              </div>
            </div>
            <div><strong>Preparing your photo</strong><span>{message}</span></div>
          </div>
        </div>
      )}

      <section className="workspace" id="top">
        {stage !== "start" && <Progress stage={stage} />}
        {message && !preparingImage && <div className="notice" role="status">{busy && <span className="spinner" aria-hidden="true" />}{message}</div>}

        {stage === "start" && (
          <div className="start-screen">
            <div className="eyebrow">{deliveryProfile.publicSlug ? `Private request from ${deliveryProfile.dealerName}` : "Private • precise • prepared on your device"}</div>
            <h1>{deliveryProfile.publicSlug ? <>Send your license to <em>{deliveryProfile.dealerName}</em>.</> : <>Your license copy, <em>perfectly prepared.</em></>}</h1>
            <p className="lede">Take a photo, confirm it looks right, and share a clean PDF with {deliveryProfile.publicSlug ? deliveryProfile.dealerName : "the recipient you choose"}.</p>
            <button className="primary large" type="button" disabled={!interactive} aria-busy={!interactive} onClick={() => beginCapture("front")}>Take a photo <span aria-hidden="true">→</span></button>
            <p className="microcopy"><span className="lock" aria-hidden="true">●</span> Your images stay on this device and are cleared when you finish.</p>
            <div className="trust-row" aria-label="Product benefits">
              <div><strong>No app required</strong><span>Works in your browser</span></div>
              <div><strong>Private on this device</strong><span>Images are not uploaded</span></div>
              <div><strong>Ready in under 30 seconds</strong><span>Front first, back optional</span></div>
            </div>
            {!deliveryProfile.publicSlug && <div className="dealer-cta"><div><span className="step-kicker">For dealerships</span><strong>Give every customer a private, branded handoff link.</strong><p>Set document rules once, invite your team, and track PDF preparation and sharing options without storing license images.</p></div><a className="secondary" href="/dashboard">Start dealership trial</a></div>}
          </div>
        )}

        {stage === "capture" && (
          <div className="panel capture-panel">
            <div className="panel-heading">
              <div><span className="step-kicker">{activeSide === "front" ? "Front of license" : "Optional second side"}</span><h1>Photograph the {sideLabel(activeSide)}</h1></div>
              {activeSide === "back" && <button className="text-button" onClick={() => { setActiveSide("front"); setStage("ready"); }}>Skip this step</button>}
            </div>
            <p>Place the license on a plain surface and keep all four corners in view.</p>
            {cameraOpen ? (
              <div className={`camera-wrap ${cameraReady ? "camera-ready" : ""}`}>
                <video ref={videoRef} muted playsInline autoPlay onClick={() => void videoRef.current?.play()} aria-label={`Live camera preview for license ${sideLabel(activeSide)}`} />
                <div className="camera-topbar">
                  <button className="camera-close" onClick={stopCamera} aria-label="Close camera">×</button>
                  <span>{activeSide === "front" ? "License front" : "License back"}</span>
                  <span className="camera-private"><i /> On-device</span>
                </div>
                <div className="camera-guide" ref={guideRef} aria-hidden="true">
                  <i className="guide-corner top-left" /><i className="guide-corner top-right" /><i className="guide-corner bottom-right" /><i className="guide-corner bottom-left" />
                </div>
                <div className="camera-prompt" role="status">
                  <strong>{cameraReady ? "Center the license, then tap the button" : "Preparing your camera…"}</strong>
                  <span>{cameraReady ? "We will check the edges next" : "Camera access remains on this device"}</span>
                </div>
                <div className="camera-actions">
                  <button className="gallery-shortcut" onClick={() => fileRef.current?.click()}><span aria-hidden="true">▧</span> Files</button>
                  <button className="shutter" onClick={capturePhoto} disabled={!cameraReady} aria-label="Take photo"><span /></button>
                  <span className="action-spacer" />
                </div>
              </div>
            ) : (
              <div className="capture-choices">
                <button className="choice-card primary-choice" onClick={() => void startCamera()} disabled={busy}><span className="choice-icon camera-icon" aria-hidden="true" /><strong>Take a photo</strong><small>Use the camera on this device</small></button>
                <button className="choice-card secondary-choice" onClick={() => fileRef.current?.click()} disabled={busy}><span className="choice-icon upload-icon" aria-hidden="true">↑</span><strong>Choose existing file</strong><small>Photo library, files, or PDF</small></button>
              </div>
            )}
            <input ref={fileRef} className="visually-hidden" type="file" accept="image/*,application/pdf,.pdf" onChange={chooseFile} />
            <button className="back-link" onClick={() => {
              if (activeSide === "front" && !front) setStage("start");
              else { setActiveSide("front"); setStage("ready"); }
            }}>← Go back</button>
          </div>
        )}

        {stage === "review" && draftUrl && (
          <div className="panel review-panel">
            <div className="panel-heading"><div><span className="step-kicker">Looks good?</span><h1>Check the framing</h1></div></div>
            <p>{activeFramingCopy.intro}</p>
            <details className="photo-toolbar overflow-toolbar">
              <summary aria-label="More photo actions">More</summary>
              <div><button type="button" onClick={() => void rotateDraft()} disabled={busy} aria-label="Rotate photo 90 degrees clockwise"><span aria-hidden="true">↻</span> Rotate</button><button type="button" onClick={() => beginCapture(activeSide)} disabled={busy}><span aria-hidden="true">↺</span> Replace</button></div>
            </details>
            <div className="crop-stage" style={{ aspectRatio: draftAspect, width: `min(100%, calc(var(--crop-stage-height, 65vh) * ${draftAspect}))` }} ref={cropRef} onPointerMove={moveActiveDrag} onPointerUp={() => { dragHandle.current = null; }} onPointerCancel={() => { dragHandle.current = null; }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={draftUrl} alt={`Uncropped license ${sideLabel(activeSide)}`} draggable={false} />
              {cropCorners && <svg className="crop-selection" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path className="crop-mask" fillRule="evenodd" d={`M0 0H100V100H0Z M${cropCorners.map((point) => `${point.x * 100} ${point.y * 100}`).join("L")}Z`} /><polygon className="crop-boundary-halo" points={cropCorners.map((point) => `${point.x * 100},${point.y * 100}`).join(" ")} /><polygon className="crop-boundary" points={cropCorners.map((point) => `${point.x * 100},${point.y * 100}`).join(" ")} /></svg>}
              {cropLines.map((style, index) => <button type="button" className={`crop-line${selectedLine === index ? " selected" : ""}`} style={style} key={LINE_NAMES[index]} aria-label={`Select and move ${LINE_NAMES[index]} crop line`} aria-pressed={selectedLine === index} onPointerDown={(event) => startWholeLineDrag(event, index)} />)}
              {cropCorners && <CornerHandles corners={cropCorners} onKey={onCornerKey} onStart={startCornerDrag} />}
            </div>
            {quality && <div className={`quality ${quality.status}`}><span aria-hidden="true">{quality.status === "pass" ? "✓" : "!"}</span><div><strong>{quality.title}</strong><p>{quality.detail}</p></div></div>}
            {process.env.NODE_ENV === "development" && <section className="development-analysis" aria-label="Development image analysis">
              <button type="button" className="development-toggle" aria-expanded={developmentOpen} onClick={toggleDevelopmentView}>
                <span><b>DEV</b> Image analysis viewer</span><span aria-hidden="true">{developmentOpen ? "−" : "+"}</span>
              </button>
              {developmentOpen && (
                <div className="development-body">
                  <div className="development-controls">
                    <label htmlFor="analysis-view">Analyzer view</label>
                    <select id="analysis-view" value={analysisView} onChange={(event) => { const view = event.target.value as DevelopmentAnalysisView; setAnalysisView(view); void generateDevelopmentView(view); }}>
                      {DEVELOPMENT_ANALYSIS_VIEWS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                    </select>
                    <p>{DEVELOPMENT_ANALYSIS_VIEWS.find((option) => option.id === analysisView)?.detail}</p>
                  </div>
                  <div className="analysis-canvas" style={{ aspectRatio: draftAspect }} aria-live="polite">
                    {analysisBusy && <div className="analysis-loading"><span className="spinner" aria-hidden="true" /> Generating {DEVELOPMENT_ANALYSIS_VIEWS.find((option) => option.id === analysisView)?.label.toLowerCase()}…</div>}
                    {analysisError && <div className="analysis-error">{analysisError}</div>}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {analysisUrl && <img src={analysisUrl} alt={`${DEVELOPMENT_ANALYSIS_VIEWS.find((option) => option.id === analysisView)?.label} development analysis`} />}
                  </div>
                  {quality && <dl className="analysis-metrics"><div><dt>Brightness</dt><dd>{quality.brightness.toFixed(1)}</dd></div><div><dt>Glare pixels</dt><dd>{(quality.glare * 100).toFixed(2)}%</dd></div><div><dt>Sharpness</dt><dd>{quality.sharpness.toFixed(1)}</dd></div><div><dt>Detection</dt><dd>{detection ? `${Math.round(detection.confidence * 100)}%` : "—"}</dd></div></dl>}
                  <p className="development-note">Development diagnostics only. Views are generated on this device from the current photo and are not included in the PDF.</p>
                </div>
              )}
            </section>}
            <div className="review-actions"><button className="primary large" onClick={acceptCrop} disabled={busy}>Continue <span aria-hidden="true">→</span></button></div>
          </div>
        )}

        {stage === "ready" && front && activeItem && (
          <div className="panel ready-panel">
            <span className="step-kicker">Finish</span><h1>Looks good?</h1><p>We straightened the image and preserved the detail. Create your PDF when you are ready.</p>
            <figure className="adjusted-preview">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={activeItem.correctedUrl} alt={`Adjusted license ${sideLabel(activeSide)}`} />
              <figcaption><span className="status-dot" />Straightened and ready</figcaption>
            </figure>
            <div className="ready-actions"><button className="primary large create-pdf-button" onClick={generatePdf} disabled={busy}>Create PDF <span aria-hidden="true">→</span></button></div>
            <details className="optional-actions">
              <summary>Optional changes</summary>
              <div>
                {activeSide === "front" && !back && deliveryProfile.backMode !== "front-only" && <button className="secondary optional-back" onClick={() => beginCapture("back")} disabled={busy}><span>＋</span><span>Add back<small>Optional</small></span></button>}
                <button className="secondary" onClick={() => editCrop(activeSide)} disabled={busy}>Adjust framing</button>
                <button className="secondary" onClick={() => void enhanceActiveImage()} disabled={busy || activeItem.enhanced}>{activeItem.enhanced ? "Enhanced" : "Enhance"}</button>
                <button className="text-button" onClick={() => beginCapture(activeSide)} disabled={busy}>Replace photo</button>
              </div>
            </details>
          </div>
        )}

        {stage === "complete" && pdfUrl && (
          <div className="panel complete-panel">
            <div className="success-mark" aria-hidden="true">PDF</div><span className="step-kicker">Success</span><h1>Your PDF is ready</h1><p>Share it with {deliveryProfile.publicSlug ? deliveryProfile.dealerName : "your recipient"} now, or download a copy to this device.</p>
            <div className="file-card"><div className="pdf-badge">PDF</div><div><a className="pdf-filename-link" href={pdfUrl} download={activePdfFilename} onClick={() => postActivity("pdf_downloaded", "download")}>{activePdfFilename}</a><span>{options.pageSize === "letter" ? "US Letter" : "A4"} - True-size card placement</span></div></div>
            <details className="delivery-card simplified destination-details"><summary>Destination details</summary><div><span className="step-kicker">Send to</span><strong>{deliveryProfile.publicSlug ? deliveryProfile.destinationName : "Your recipient"}</strong></div><div className="destination-list">{deliveryEmail && <div className="destination-value"><span>Email</span><code>{deliveryEmail}</code><button className="text-button" type="button" onClick={() => void copyDestination(deliveryEmail, "Email")}>Copy</button></div>}{deliveryPhone && <div className="destination-value"><span>Text</span><code>{deliveryPhone}</code><button className="text-button" type="button" onClick={() => void copyDestination(deliveryPhone, "Text")}>Copy</button></div>}</div>{copiedDestination && <span className="copy-status" role="status">{copiedDestination}</span>}</details>
            <div className="complete-actions">{canShare && <button className="primary large" onClick={sharePdf}>Share <span aria-hidden="true">↗</span></button>}<a className={canShare ? "secondary download" : "primary large download"} href={pdfUrl} download={activePdfFilename} onClick={() => postActivity("pdf_downloaded", "download")}>Download PDF <span aria-hidden="true">↓</span></a></div>
            <button className="clear-button" onClick={startOver}>Start over & clear images</button>
          </div>
        )}
      </section>

      <footer>
        <details><summary>Privacy details</summary><p>Photos and PDFs are processed locally in volatile browser memory. They are not sent to LicenseResizer. Downloaded and shared files are controlled by your browser, device, and chosen destination. Starting over removes the app’s references to your session.</p></details>
        <nav className="product-legal-links" aria-label="Legal and support"><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/security">Security</a><a href="/support">Support</a></nav>
        <p>LicenseResizer creates a resized copy. It does not verify identity or document authenticity.</p>
      </footer>
    </main>
  );
}
