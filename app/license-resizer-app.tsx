"use client";

import { ChangeEvent, KeyboardEvent, PointerEvent, useCallback, useEffect, useRef, useState } from "react";
import { analyzeImage, correctPerspective, CropCandidate, DEFAULT_CORNERS, detectDocumentCandidates, DetectionResult, Point, QualityResult, sourceToCanvas, validateImage } from "../lib/image-processing";
import { mapGuideToVideoCorners } from "../lib/camera-geometry";
import { cornersToEdgeLines, edgeLinesToCorners, type EdgeLine } from "../lib/document-geometry";
import { createDevelopmentAnalysisView, DEVELOPMENT_ANALYSIS_VIEWS, type DevelopmentAnalysisView } from "../lib/development-analysis";
import type { PdfOptions } from "../lib/pdf";
import { DEFAULT_DELIVERY_PROFILE, type ActivityEventType, type DealerDeliveryProfile } from "../lib/dealer";

type Side = "front" | "back";
type Stage = "start" | "capture" | "review" | "ready" | "complete";
type CapturedSide = {
  source: Blob;
  sourceUrl: string;
  sourceAspect: number;
  corrected: Blob;
  correctedUrl: string;
  corners: [Point, Point, Point, Point];
};

const sideLabel = (side: Side) => (side === "front" ? "front" : "back");
const LINE_NAMES = ["Top", "Right", "Bottom", "Left"] as const;
const pdfFilename = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `license-copy-${year}-${month}-${day}.pdf`;
};

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

function cropSuggestionName(candidate: CropCandidate, index: number) {
  if (index === 0) return "Recommended";
  if (candidate.id === "framing") return "Camera guide";
  return `Option ${index + 1}`;
}

function cropSuggestionDetail(candidate: CropCandidate, index: number) {
  if (index === 0) return "Our best framing";
  if (candidate.id === "framing") return "As photographed";
  return "Compare framing";
}

function Progress({ stage }: { stage: Stage }) {
  const steps = ["Capture", "Refine", "Finish"];
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

function EdgeLineHandles({
  lines,
  selectedLine,
  onKey,
  onStart,
}: {
  lines: [EdgeLine, EdgeLine, EdgeLine, EdgeLine];
  selectedLine: number;
  onKey: (event: KeyboardEvent<HTMLButtonElement>, lineIndex: number, end: "start" | "end") => void;
  onStart: (event: PointerEvent<HTMLButtonElement>, lineIndex: number, end: "start" | "end") => void;
}) {
  return lines.flatMap((line, lineIndex) => (["start", "end"] as const).map((end, endIndex) => {
    const point = line[end];
    return <button key={`${lineIndex}-${end}`} className={`crop-handle line-handle${selectedLine === lineIndex ? " selected" : ""}`} style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }} aria-label={`${LINE_NAMES[lineIndex]} edge, handle ${endIndex + 1} of 2. Drag to tilt this line, or use arrow keys.`} onKeyDown={(event) => onKey(event, lineIndex, end)} onPointerDown={(event) => onStart(event, lineIndex, end)}><span aria-hidden="true" /></button>;
  }));
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
  const [cropCandidates, setCropCandidates] = useState<CropCandidate[]>([]);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [draftAspect, setDraftAspect] = useState(1.333);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfUrl, setPdfUrl] = useState("");
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
  const dragHandle = useRef<
    | { kind: "handle"; line: number; end: "start" | "end" }
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
    void fetch("/api/activity", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ publicSlug: deliveryProfile.publicSlug, eventType, deliveryChannel }),
      keepalive: true,
    }).catch(() => undefined);
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
    setCropCandidates([]);
    setCandidateIndex(0);
    setEdgeLines(cornersToEdgeLines(DEFAULT_CORNERS));
  }, [draftUrl, releaseAnalysisView]);

  const startOver = useCallback(() => {
    postActivity("session_cleared");
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
    setActiveSide("front");
    setMessage("");
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

  const openCamera = async () => {
    setMessage("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setMessage("Camera access is not available here. Choose a photo instead.");
      fileRef.current?.click();
      return;
    }
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
      streamRef.current = stream;
      setCameraOpen(true);
    } catch {
      setMessage("Camera permission was not granted. You can still choose a photo from this device.");
    }
  };

  const prepareDraft = async (blob: Blob, guideCorners?: [Point, Point, Point, Point]) => {
    setBusy(true);
    setMessage("Preparing your photo and finding the cleanest framing…");
    try {
      await validateImage(blob);
      stopCamera();
      clearDraft();
      const url = URL.createObjectURL(blob);
      setDraft(blob);
      setDraftUrl(url);
      const [qualityResult, candidates] = await Promise.all([analyzeImage(blob), detectDocumentCandidates(blob, guideCorners)]);
      const detectionResult = candidates[0].detection;
      setQuality(qualityResult);
      setCropCandidates(candidates);
      setCandidateIndex(0);
      setDetection(detectionResult);
      setDraftAspect(detectionResult.aspectRatio);
      setEdgeLines(cornersToEdgeLines(detectionResult.corners));
      setStage("review");
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "That image could not be opened.");
    } finally {
      setBusy(false);
    }
  };

  const chooseFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void prepareDraft(file);
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
    setBusy(true);
    setMessage("Rotating the photo…");
    try {
      const rotated = await rotateImageClockwise(draft);
      await prepareDraft(rotated);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to rotate the photo.");
      setBusy(false);
    }
  };

  const updateLineEnd = (lineIndex: number, end: "start" | "end", x: number, y: number) => {
    setEdgeLines((current) => current.map((line, index) => index === lineIndex
      ? { ...line, [end]: { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) } }
      : line) as [EdgeLine, EdgeLine, EdgeLine, EdgeLine]);
  };

  const moveFromPointer = (event: PointerEvent<HTMLElement>, lineIndex: number, end: "start" | "end") => {
    const bounds = cropRef.current?.getBoundingClientRect();
    if (!bounds) return;
    updateLineEnd(lineIndex, end, (event.clientX - bounds.left) / bounds.width, (event.clientY - bounds.top) / bounds.height);
  };

  const onHandleKey = (event: KeyboardEvent<HTMLButtonElement>, lineIndex: number, end: "start" | "end") => {
    const step = event.shiftKey ? 0.025 : 0.006;
    const point = edgeLines[lineIndex][end];
    if (event.key === "ArrowLeft") updateLineEnd(lineIndex, end, point.x - step, point.y);
    else if (event.key === "ArrowRight") updateLineEnd(lineIndex, end, point.x + step, point.y);
    else if (event.key === "ArrowUp") updateLineEnd(lineIndex, end, point.x, point.y - step);
    else if (event.key === "ArrowDown") updateLineEnd(lineIndex, end, point.x, point.y + step);
    else return;
    event.preventDefault();
  };

  const startLineDrag = (event: PointerEvent<HTMLButtonElement>, lineIndex: number, end: "start" | "end") => {
    setSelectedLine(lineIndex);
    dragHandle.current = { kind: "handle", line: lineIndex, end };
    event.currentTarget.setPointerCapture(event.pointerId);
    moveFromPointer(event, lineIndex, end);
  };

  const chooseCropCandidate = (index: number) => {
    if (!cropCandidates.length) return;
    const normalized = (index + cropCandidates.length) % cropCandidates.length;
    const candidate = cropCandidates[normalized];
    setCandidateIndex(normalized);
    setDetection(candidate.detection);
    setEdgeLines(cornersToEdgeLines(candidate.detection.corners));
    setSelectedLine(0);
    setMessage("");
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
    if (active.kind === "handle") {
      moveFromPointer(event, active.line, active.end);
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
    const corners = edgeLinesToCorners(edgeLines);
    if (!corners) {
      setMessage("Adjust the line ends so all four sides meet around the license.");
      return;
    }
    setBusy(true);
    setMessage("Straightening and refining your image…");
    try {
      const corrected = await correctPerspective(draft, corners, "high");
      const item: CapturedSide = {
        source: draft,
        sourceUrl: draftUrl,
        sourceAspect: draftAspect,
        corrected,
        correctedUrl: URL.createObjectURL(corrected),
        corners: corners.map((point) => ({ ...point })) as [Point, Point, Point, Point],
      };
      if (activeSide === "front") {
        if (front) { URL.revokeObjectURL(front.sourceUrl); URL.revokeObjectURL(front.correctedUrl); }
        setFront(item);
        postActivity("front_captured");
      } else {
        if (back) { URL.revokeObjectURL(back.sourceUrl); URL.revokeObjectURL(back.correctedUrl); }
        setBack(item);
        postActivity("back_captured");
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
    setDraftAspect(item.sourceAspect);
    setEdgeLines(cornersToEdgeLines(item.corners));
    const savedDetection: DetectionResult = { corners: item.corners, confidence: 1, found: true, rotated: false, aspectRatio: item.sourceAspect };
    setCropCandidates([{ id: "framing", label: "Saved crop", detail: "The crop previously used for this image.", detection: savedDetection }]);
    setCandidateIndex(0);
    setDetection(savedDetection);
    setQuality(null);
    setMessage("");
    setStage("review");
  };

  const beginCapture = (side: Side) => {
    stopCamera();
    clearDraft();
    setActiveSide(side);
    setMessage("");
    setStage("capture");
    if (side === "front" && !front) postActivity("session_started");
  };

  const generatePdf = async () => {
    if (!front) return;
    setBusy(true);
    setMessage("Preparing your true-size PDF…");
    try {
      const { composePdf } = await import("../lib/pdf");
      const pdf = await composePdf(front.corrected, back?.corrected ?? null, options);
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      setPdfBlob(pdf);
      setPdfUrl(URL.createObjectURL(pdf));
      setStage("complete");
      postActivity("pdf_created");
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The PDF could not be created.");
    } finally {
      setBusy(false);
    }
  };

  const sharePdf = async () => {
    if (!pdfBlob) return;
    const file = new File([pdfBlob], pdfFilename(), { type: "application/pdf" });
    if (typeof navigator.share !== "function" || typeof navigator.canShare !== "function" || !navigator.canShare({ files: [file] })) return;
    try {
      const destination = deliveryEmail ? `\n\nRequested destination: ${deliveryEmail}` : "";
      await navigator.share({ files: [file], title: deliverySubject, text: `${deliveryMessage}${destination}` });
      postActivity("share_opened", "native-share");
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

  const canShare = Boolean(typeof navigator !== "undefined" && pdfBlob && typeof navigator.share === "function" && typeof navigator.canShare === "function" && navigator.canShare({ files: [new File([pdfBlob], pdfFilename(), { type: "application/pdf" })] }));
  const cropCorners = edgeLinesToCorners(edgeLines);
  const cropLines = edgeLines.map((line) => {
    const dx = (line.end.x - line.start.x) * 100;
    const dy = (line.end.y - line.start.y) * 100;
    return { left: `${line.start.x * 100}%`, top: `${line.start.y * 100}%`, width: `${Math.sqrt(dx * dx + dy * dy)}%`, transform: `rotate(${Math.atan2(dy, dx)}rad)` };
  });
  const selectedCandidate = cropCandidates[candidateIndex] ?? null;
  const activeItem = activeSide === "front" ? front : back;

  return (
    <main className="app-shell">
      <header className="site-header">
        {deliveryProfile.publicSlug ? (
          <a className="brand dealer-scan-brand" href={`/d/${deliveryProfile.publicSlug}`} aria-label={`${deliveryProfile.dealerName} customer page`}>
            {deliveryProfile.logoUrl ? <span className="dealer-scan-logo" role="img" aria-label={`${deliveryProfile.dealerName} logo`} style={{ backgroundImage: `url(${deliveryProfile.logoUrl})` }} /> : <span className="brand-mark" aria-hidden="true"><i /></span>}
            <span>{deliveryProfile.dealerName}</span>
          </a>
        ) : (
          <a className="brand" href="#top" aria-label="LicenseResizer home">
            <span className="brand-mark" aria-hidden="true"><i /></span>
            <span>License<span>Resizer</span></span>
          </a>
        )}
        <div className="header-actions">{!deliveryProfile.publicSlug && <a className="dealer-link" href="/dashboard">Dealer console</a>}<div className="privacy-pill"><span /> Processed on this device</div></div>
      </header>

      <section className="workspace" id="top">
        {stage !== "start" && <Progress stage={stage} />}
        {message && <div className="notice" role="status">{busy && <span className="spinner" aria-hidden="true" />}{message}</div>}

        {stage === "start" && (
          <div className="start-screen">
            <div className="eyebrow">{deliveryProfile.publicSlug ? `Private request from ${deliveryProfile.dealerName}` : "Private • precise • prepared on your device"}</div>
            <h1>{deliveryProfile.publicSlug ? "Prepare your license for the dealership." : <>Your license copy, <em>perfectly prepared.</em></>}</h1>
            <p className="lede">Photograph the front of your license. We’ll straighten it and create a true-size PDF, ready for you to share with {deliveryProfile.publicSlug ? deliveryProfile.dealerName : "the recipient you choose"}.</p>
            <button className="primary large" type="button" disabled={!interactive} aria-busy={!interactive} onClick={() => beginCapture("front")}>Begin securely <span aria-hidden="true">→</span></button>
            <p className="microcopy"><span className="lock" aria-hidden="true">●</span> Your images stay on this device and are cleared when you finish.</p>
            <div className="trust-row" aria-label="Product benefits">
              <div><strong>85.60 × 53.98 mm</strong><span>Nominal ID-1 size</span></div>
              <div><strong>Front first</strong><span>Back is always optional</span></div>
              <div><strong>No account</strong><span>Clear when finished</span></div>
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
            <p>Set the license on a plain, contrasting surface. Keep every corner in view and use soft, even light.</p>
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
                  <strong>{cameraReady ? "Center the full license inside the frame" : "Preparing your camera…"}</strong>
                  <span>{cameraReady ? "Hold steady—we’ll refine the edges next" : "Camera access remains on this device"}</span>
                </div>
                <div className="camera-actions">
                  <button className="gallery-shortcut" onClick={() => fileRef.current?.click()}><span aria-hidden="true">▧</span> Photos</button>
                  <button className="shutter" onClick={capturePhoto} disabled={!cameraReady} aria-label="Take photo"><span /></button>
                  <span className="action-spacer" />
                </div>
              </div>
            ) : (
              <div className="capture-choices">
                <button className="choice-card" onClick={openCamera}><span className="choice-icon camera-icon" aria-hidden="true" /><strong>Open camera</strong><small>Photograph the license now</small></button>
                <button className="choice-card" onClick={() => fileRef.current?.click()}><span className="choice-icon upload-icon" aria-hidden="true">↑</span><strong>Choose from photos</strong><small>Select a photo already on this device</small></button>
              </div>
            )}
            <input ref={fileRef} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" capture="environment" onChange={chooseFile} />
            <button className="back-link" onClick={() => {
              if (activeSide === "front" && !front) setStage("start");
              else { setActiveSide("front"); setStage("ready"); }
            }}>← Go back</button>
          </div>
        )}

        {stage === "review" && draftUrl && (
          <div className="panel review-panel">
            <div className="panel-heading"><div><span className="step-kicker">Refine {sideLabel(activeSide)}</span><h1>Fine-tune the framing</h1></div></div>
            <div className="photo-toolbar" aria-label="Photo actions"><span>Original photo</span><div><button type="button" onClick={() => void rotateDraft()} disabled={busy} aria-label="Rotate photo 90 degrees clockwise"><span aria-hidden="true">↻</span> Rotate</button><button type="button" onClick={() => beginCapture(activeSide)} disabled={busy}><span aria-hidden="true">↺</span> Replace</button></div></div>
            <p>We’ve selected the strongest framing. The outline should sit just inside all four edges; drag any line or round handle for a precise fit.</p>
            {selectedCandidate && cropCandidates.length > 1 && <section className="crop-candidate-picker" aria-labelledby="crop-suggestions-title">
              <div className="candidate-heading"><div><strong id="crop-suggestions-title">Framing</strong><span>Compare only if the recommended outline misses an edge.</span></div></div>
              <div className="candidate-options" role="radiogroup" aria-label="Framing options">{cropCandidates.map((candidate, index) => <button type="button" role="radio" key={candidate.id} className={index === candidateIndex ? "active" : ""} aria-checked={index === candidateIndex} onClick={() => chooseCropCandidate(index)}><span className="candidate-frame" aria-hidden="true"><i /></span><strong>{cropSuggestionName(candidate, index)}</strong><small>{cropSuggestionDetail(candidate, index)}</small>{index === candidateIndex && <b>Selected</b>}</button>)}</div>
            </section>}
            <div className={`detection-badge ${detection?.found ? "found" : "manual"}`}><span aria-hidden="true">{detection?.found ? "✓" : "!"}</span>{detection?.found ? "Framing ready to review" : "A quick adjustment may be needed"}</div>
            <div className="crop-stage" style={{ aspectRatio: draftAspect, width: `min(100%, calc(65vh * ${draftAspect}))` }} ref={cropRef} onPointerMove={moveActiveDrag} onPointerUp={() => { dragHandle.current = null; }} onPointerCancel={() => { dragHandle.current = null; }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={draftUrl} alt={`Uncropped license ${sideLabel(activeSide)}`} draggable={false} />
              {cropCorners && <svg className="crop-selection" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path className="crop-mask" fillRule="evenodd" d={`M0 0H100V100H0Z M${cropCorners.map((point) => `${point.x * 100} ${point.y * 100}`).join("L")}Z`} /><polygon className="crop-boundary-halo" points={cropCorners.map((point) => `${point.x * 100},${point.y * 100}`).join(" ")} /><polygon className="crop-boundary" points={cropCorners.map((point) => `${point.x * 100},${point.y * 100}`).join(" ")} /></svg>}
              {cropLines.map((style, index) => <button type="button" className={`crop-line${selectedLine === index ? " selected" : ""}`} style={style} key={LINE_NAMES[index]} aria-label={`Select and move ${LINE_NAMES[index]} crop line`} aria-pressed={selectedLine === index} onPointerDown={(event) => startWholeLineDrag(event, index)} />)}
              <EdgeLineHandles lines={edgeLines} selectedLine={selectedLine} onKey={onHandleKey} onStart={startLineDrag} />
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
            <div className="review-actions"><button className="primary" onClick={acceptCrop} disabled={busy}>Confirm framing <span aria-hidden="true">→</span></button></div>
          </div>
        )}

        {stage === "ready" && front && activeItem && (
          <div className="panel ready-panel">
            <span className="step-kicker">{sideLabel(activeSide)} prepared</span><h1>Your image is ready</h1><p>We’ve straightened the perspective and preserved the detail. Make any final framing adjustment before creating your PDF.</p>
            <figure className="adjusted-preview">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={activeItem.correctedUrl} alt={`Adjusted license ${sideLabel(activeSide)}`} />
              <figcaption><span className="status-dot" />Straightened and ready</figcaption>
            </figure>
            <div className="adjusted-tools">
              <button className="secondary" onClick={() => editCrop(activeSide)} disabled={busy}>Adjust framing</button>
              <button className="text-button" onClick={() => beginCapture(activeSide)} disabled={busy}>Replace photo</button>
            </div>
            <div className="ready-actions">{activeSide === "front" && !back && deliveryProfile.backMode !== "front-only" ? <><button className="secondary optional-back" onClick={() => beginCapture("back")} disabled={busy}><span>＋</span><span>Add the back<small>Optional</small></span></button><button className="primary" onClick={generatePdf} disabled={busy}>Create my PDF <span aria-hidden="true">→</span></button></> : <button className="primary" onClick={generatePdf} disabled={busy}>Create my PDF <span aria-hidden="true">→</span></button>}</div>
          </div>
        )}

        {stage === "complete" && pdfUrl && (
          <div className="panel complete-panel">
            <div className="success-mark" aria-hidden="true">OK</div><span className="step-kicker">Ready to share</span><h1>Your PDF is prepared</h1><p>Your true-size copy is ready on this device. Copy a destination if needed, then share the attached PDF.</p>
            <div className="file-card"><div className="pdf-badge">PDF</div><div><a className="pdf-filename-link" href={pdfUrl} download={pdfFilename()} onClick={() => postActivity("pdf_downloaded", "download")}>{pdfFilename()}</a><span>{options.pageSize === "letter" ? "US Letter" : "A4"} - True-size card placement</span></div></div>
            <div className="delivery-card simplified"><div><span className="step-kicker">Send to</span><strong>{deliveryProfile.publicSlug ? deliveryProfile.destinationName : "Your recipient"}</strong></div><div className="destination-list">{deliveryEmail && <div className="destination-value"><span>Email</span><code>{deliveryEmail}</code><button className="text-button" type="button" onClick={() => void copyDestination(deliveryEmail, "Email")}>Copy</button></div>}{deliveryPhone && <div className="destination-value"><span>Text</span><code>{deliveryPhone}</code><button className="text-button" type="button" onClick={() => void copyDestination(deliveryPhone, "Text")}>Copy</button></div>}</div>{copiedDestination && <span className="copy-status" role="status">{copiedDestination}</span>}</div>
            <div className="complete-actions">{canShare && <button className="primary large" onClick={sharePdf}>Share <span aria-hidden="true">↗</span></button>}<a className={canShare ? "secondary download" : "primary large download"} href={pdfUrl} download={pdfFilename()} onClick={() => postActivity("pdf_downloaded", "download")}>Download PDF <span aria-hidden="true">↓</span></a></div>
            <button className="clear-button" onClick={startOver}>Start over & clear images</button>
          </div>
        )}
      </section>

      <footer>
        <details><summary>Privacy details</summary><p>Photos are processed locally in volatile browser memory. They are not sent to LicenseResizer. Downloaded and shared files are controlled by your browser, device, and chosen destination. Starting over removes the app’s references to your session.</p></details>
        <nav className="product-legal-links" aria-label="Legal and support"><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/security">Security</a><a href="/support">Support</a></nav>
        <p>LicenseResizer creates a resized copy. It does not verify identity or document authenticity.</p>
      </footer>
    </main>
  );
}
