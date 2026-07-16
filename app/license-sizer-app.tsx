"use client";

import { ChangeEvent, KeyboardEvent, PointerEvent, useCallback, useEffect, useRef, useState } from "react";
import { analyzeImage, correctPerspective, DEFAULT_CORNERS, detectDocument, DetectionResult, Point, QualityResult, sourceToCanvas, validateImage } from "../lib/image-processing";
import { mapGuideToVideoCorners } from "../lib/camera-geometry";
import { cornersToEdgeLines, edgeLinesToCorners, extendLineToBounds, type EdgeLine } from "../lib/document-geometry";
import type { PdfOptions } from "../lib/pdf";

type Side = "front" | "back";
type Stage = "start" | "capture" | "review" | "ready" | "export" | "complete";
type CapturedSide = {
  source: Blob;
  sourceUrl: string;
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

function Progress({ stage }: { stage: Stage }) {
  const steps = ["Capture", "Review", "Export"];
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

function PreviewCard({ item, label }: { item: CapturedSide; label: string }) {
  return (
    <figure className="saved-card">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={item.correctedUrl} alt={`Corrected ${label} of license`} />
      <figcaption><span className="status-dot" />{label} ready</figcaption>
    </figure>
  );
}

function EdgeLineHandles({
  lines,
  onKey,
  onStart,
}: {
  lines: [EdgeLine, EdgeLine, EdgeLine, EdgeLine];
  onKey: (event: KeyboardEvent<HTMLButtonElement>, lineIndex: number, end: "start" | "end") => void;
  onStart: (event: PointerEvent<HTMLButtonElement>, lineIndex: number, end: "start" | "end") => void;
}) {
  return lines.flatMap((line, lineIndex) => (["start", "end"] as const).map((end, endIndex) => {
    const point = line[end];
    return <button key={`${lineIndex}-${end}`} className="crop-handle line-handle" style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }} aria-label={`${LINE_NAMES[lineIndex]} edge, end ${endIndex + 1}. Use arrow keys to adjust.`} onKeyDown={(event) => onKey(event, lineIndex, end)} onPointerDown={(event) => onStart(event, lineIndex, end)}><span>{LINE_NAMES[lineIndex][0]}</span></button>;
  }));
}

export default function LicenseSizerApp() {
  const [stage, setStage] = useState<Stage>("start");
  const [activeSide, setActiveSide] = useState<Side>("front");
  const [front, setFront] = useState<CapturedSide | null>(null);
  const [back, setBack] = useState<CapturedSide | null>(null);
  const [draft, setDraft] = useState<Blob | null>(null);
  const [draftUrl, setDraftUrl] = useState("");
  const [edgeLines, setEdgeLines] = useState<[EdgeLine, EdgeLine, EdgeLine, EdgeLine]>(() => cornersToEdgeLines(DEFAULT_CORNERS));
  const [quality, setQuality] = useState<QualityResult | null>(null);
  const [detection, setDetection] = useState<DetectionResult | null>(null);
  const [draftAspect, setDraftAspect] = useState(1.333);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfUrl, setPdfUrl] = useState("");
  const [options, setOptions] = useState<PdfOptions & { quality: "standard" | "high" }>({
    pageSize: "letter",
    layout: "stacked",
    labels: false,
    cropMarks: false,
    quality: "high",
  });
  const videoRef = useRef<HTMLVideoElement>(null);
  const guideRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cropRef = useRef<HTMLDivElement>(null);
  const dragHandle = useRef<{ line: number; end: "start" | "end" } | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOpen(false);
    setCameraReady(false);
  }, []);

  const clearDraft = useCallback(() => {
    if (draftUrl) URL.revokeObjectURL(draftUrl);
    setDraft(null);
    setDraftUrl("");
    setQuality(null);
    setDetection(null);
    setEdgeLines(cornersToEdgeLines(DEFAULT_CORNERS));
  }, [draftUrl]);

  const startOver = useCallback(() => {
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
  }, [back, clearDraft, front, pdfUrl, stopCamera]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) stopCamera();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [stopCamera]);

  useEffect(() => {
    if ("serviceWorker" in navigator && window.isSecureContext) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
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
  }, []);

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
    setMessage("Separating the license from the background, then checking focus and glare…");
    try {
      await validateImage(blob);
      stopCamera();
      clearDraft();
      const url = URL.createObjectURL(blob);
      setDraft(blob);
      setDraftUrl(url);
      const [qualityResult, detectionResult] = await Promise.all([analyzeImage(blob), detectDocument(blob, guideCorners)]);
      setQuality(qualityResult);
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
    setMessage("Rotating photo…");
    try {
      const source = await sourceToCanvas(draft);
      const canvas = document.createElement("canvas");
      canvas.width = source.height;
      canvas.height = source.width;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Unable to rotate the photo.");
      context.translate(canvas.width, 0);
      context.rotate(Math.PI / 2);
      context.drawImage(source, 0, 0);
      const rotated = await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Unable to rotate the photo.")), "image/jpeg", 0.94));
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
    dragHandle.current = { line: lineIndex, end };
    event.currentTarget.setPointerCapture(event.pointerId);
    moveFromPointer(event, lineIndex, end);
  };

  const acceptCrop = async () => {
    if (!draft) return;
    const corners = edgeLinesToCorners(edgeLines);
    if (!corners) {
      setMessage("Adjust the line ends so all four sides meet around the license.");
      return;
    }
    setBusy(true);
    setMessage("Correcting perspective…");
    try {
      const corrected = await correctPerspective(draft, corners, "high");
      const item: CapturedSide = {
        source: draft,
        sourceUrl: draftUrl,
        corrected,
        correctedUrl: URL.createObjectURL(corrected),
        corners: corners.map((point) => ({ ...point })) as [Point, Point, Point, Point],
      };
      if (activeSide === "front") {
        if (front) { URL.revokeObjectURL(front.sourceUrl); URL.revokeObjectURL(front.correctedUrl); }
        setFront(item);
      } else {
        if (back) { URL.revokeObjectURL(back.sourceUrl); URL.revokeObjectURL(back.correctedUrl); }
        setBack(item);
      }
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

  const beginCapture = (side: Side) => {
    stopCamera();
    clearDraft();
    setActiveSide(side);
    setMessage("");
    setStage("capture");
  };

  const generatePdf = async () => {
    if (!front) return;
    setBusy(true);
    setMessage("Creating your true-size PDF…");
    try {
      const [frontOutput, backOutput] = await Promise.all([
        correctPerspective(front.source, front.corners, options.quality),
        back ? correctPerspective(back.source, back.corners, options.quality) : Promise.resolve(null),
      ]);
      const { composePdf } = await import("../lib/pdf");
      const pdf = await composePdf(frontOutput, backOutput, options);
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      setPdfBlob(pdf);
      setPdfUrl(URL.createObjectURL(pdf));
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
    const file = new File([pdfBlob], pdfFilename(), { type: "application/pdf" });
    if (!navigator.share || !navigator.canShare?.({ files: [file] })) return;
    try {
      await navigator.share({ files: [file], title: "License copy" });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setMessage("Sharing was not completed. Your download is still available below.");
    }
  };

  const canShare = Boolean(typeof navigator !== "undefined" && pdfBlob && navigator.share && navigator.canShare?.({ files: [new File([pdfBlob], pdfFilename(), { type: "application/pdf" })] }));
  const cropCorners = edgeLinesToCorners(edgeLines);
  const cropLines = edgeLines.map((line) => {
    const visible = extendLineToBounds(line);
    const dx = (visible.end.x - visible.start.x) * 100;
    const dy = (visible.end.y - visible.start.y) * 100;
    return { left: `${visible.start.x * 100}%`, top: `${visible.start.y * 100}%`, width: `${Math.sqrt(dx * dx + dy * dy)}%`, transform: `rotate(${Math.atan2(dy, dx)}rad)` };
  });

  return (
    <main className="app-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="LicenseSizer home">
          <span className="brand-mark" aria-hidden="true"><i /></span>
          <span>License<span>Sizer</span></span>
        </a>
        <div className="privacy-pill"><span /> Processed on this device</div>
      </header>

      <section className="workspace" id="top">
        {stage !== "start" && <Progress stage={stage} />}
        {message && <div className="notice" role="status">{busy && <span className="spinner" aria-hidden="true" />}{message}</div>}

        {stage === "start" && (
          <div className="start-screen">
            <div className="eyebrow">Private • precise • print-ready</div>
            <h1>A true-size license copy, <em>without the scanner.</em></h1>
            <p className="lede">Take or choose a photo. LicenseSizer straightens it and creates a clean PDF at the nominal ID-1 card size.</p>
            <button className="primary large" onClick={() => beginCapture("front")}>Scan a license <span aria-hidden="true">→</span></button>
            <p className="microcopy"><span className="lock" aria-hidden="true">●</span> Your photos stay in this browser during processing. Nothing is uploaded.</p>
            <div className="trust-row" aria-label="Product benefits">
              <div><strong>85.60 × 53.98 mm</strong><span>Nominal ID-1 size</span></div>
              <div><strong>Front + back</strong><span>One tidy PDF</span></div>
              <div><strong>No account</strong><span>Clear when finished</span></div>
            </div>
          </div>
        )}

        {stage === "capture" && (
          <div className="panel capture-panel">
            <div className="panel-heading">
              <div><span className="step-kicker">{activeSide === "front" ? "First" : "Optional"}</span><h1>Capture the {sideLabel(activeSide)}</h1></div>
              {activeSide === "back" && <button className="text-button" onClick={() => setStage("ready")}>Skip back</button>}
            </div>
            <p>Place the license on a contrasting surface. Keep all four corners visible and avoid direct glare.</p>
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
                  <strong>{cameraReady ? "Keep the full card near the frame" : "Starting camera…"}</strong>
                  <span>{cameraReady ? "We’ll analyze its actual edges after capture" : "Camera access stays on this device"}</span>
                </div>
                <div className="camera-actions">
                  <button className="gallery-shortcut" onClick={() => fileRef.current?.click()}><span aria-hidden="true">▧</span> Photos</button>
                  <button className="shutter" onClick={capturePhoto} disabled={!cameraReady} aria-label="Take photo"><span /></button>
                  <span className="action-spacer" />
                </div>
              </div>
            ) : (
              <div className="capture-choices">
                <button className="choice-card" onClick={openCamera}><span className="choice-icon camera-icon" aria-hidden="true" /><strong>Use camera</strong><small>Take a new photo</small></button>
                <button className="choice-card" onClick={() => fileRef.current?.click()}><span className="choice-icon upload-icon" aria-hidden="true">↑</span><strong>Choose photo</strong><small>Use an existing image</small></button>
              </div>
            )}
            <input ref={fileRef} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" capture="environment" onChange={chooseFile} />
            <button className="back-link" onClick={() => activeSide === "front" && !front ? setStage("start") : setStage("ready")}>← Go back</button>
          </div>
        )}

        {stage === "review" && draftUrl && (
          <div className="panel review-panel">
            <div className="panel-heading"><div><span className="step-kicker">Review {sideLabel(activeSide)}</span><h1>Check the automatic crop</h1></div><button className="text-button" onClick={() => beginCapture(activeSide)}>Retake</button></div>
            <p>{detection?.found ? "We separated the license from its background and placed a line on each edge." : "The background separation was uncertain. Move either end of each line until the four lines follow the license edges."} The lines extend across the photo; their intersections define the area that will be resized.</p>
            <div className={`detection-badge ${detection?.found ? "found" : "manual"}`}><span aria-hidden="true">{detection?.found ? "✓" : "!"}</span>{detection?.found ? `Background-isolated crop${detection.rotated ? " + rotation" : ""} • ${Math.round(detection.confidence * 100)}%` : "Manual line adjustment"}</div>
            <div className="crop-stage" style={{ aspectRatio: draftAspect, width: `min(100%, calc(65vh * ${draftAspect}))` }} ref={cropRef} onPointerMove={(event) => { const active = dragHandle.current; if (active) moveFromPointer(event, active.line, active.end); }} onPointerUp={() => { dragHandle.current = null; }} onPointerCancel={() => { dragHandle.current = null; }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={draftUrl} alt={`Uncropped license ${sideLabel(activeSide)}`} draggable={false} />
              {cropCorners && <svg className="crop-selection" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polygon points={cropCorners.map((point) => `${point.x * 100},${point.y * 100}`).join(" ")} /></svg>}
              {cropLines.map((style, index) => <span className="crop-line" style={style} key={index} />)}
              <EdgeLineHandles lines={edgeLines} onKey={onHandleKey} onStart={startLineDrag} />
            </div>
            {quality && <div className={`quality ${quality.status}`}><span aria-hidden="true">{quality.status === "pass" ? "✓" : "!"}</span><div><strong>{quality.title}</strong><p>{quality.detail}</p></div></div>}
            <div className="review-actions"><button className="secondary" onClick={rotateDraft} disabled={busy}>Rotate 90°</button><button className="primary" onClick={acceptCrop} disabled={busy}>{detection?.found ? "Looks good" : "Use this crop"} <span aria-hidden="true">→</span></button></div>
          </div>
        )}

        {stage === "ready" && front && (
          <div className="panel ready-panel">
            <span className="step-kicker">Photos ready</span><h1>Looking good</h1><p>Check that the text is readable and each edge is complete before creating the PDF.</p>
            <div className="saved-grid"><PreviewCard item={front} label="Front" />{back && <PreviewCard item={back} label="Back" />}</div>
            <div className="ready-actions">
              {!back && <button className="secondary" onClick={() => beginCapture("back")}>+ Add the back</button>}
              <button className="primary" onClick={() => setStage("export")}>Set up PDF <span aria-hidden="true">→</span></button>
            </div>
            <div className="edit-links"><button onClick={() => beginCapture("front")}>Retake front</button>{back && <button onClick={() => beginCapture("back")}>Retake back</button>}</div>
          </div>
        )}

        {stage === "export" && front && (
          <div className="panel export-panel">
            <span className="step-kicker">Final step</span><h1>Set up your PDF</h1><p>The card is placed at its nominal physical size. Print using 100% or Actual size.</p>
            <fieldset><legend>Paper size</legend><div className="segmented"><label><input type="radio" name="pageSize" checked={options.pageSize === "letter"} onChange={() => setOptions({ ...options, pageSize: "letter" })} /><span>US Letter<small>8.5 × 11 in</small></span></label><label><input type="radio" name="pageSize" checked={options.pageSize === "a4"} onChange={() => setOptions({ ...options, pageSize: "a4" })} /><span>A4<small>210 × 297 mm</small></span></label></div></fieldset>
            {back && <fieldset><legend>Layout</legend><div className="segmented three"><label><input type="radio" name="layout" checked={options.layout === "stacked"} onChange={() => setOptions({ ...options, layout: "stacked" })} /><span>Stacked<small>One page</small></span></label><label><input type="radio" name="layout" checked={options.layout === "separate-pages"} onChange={() => setOptions({ ...options, layout: "separate-pages" })} /><span>Separate<small>Two pages</small></span></label><label><input type="radio" name="layout" checked={options.layout === "front-only"} onChange={() => setOptions({ ...options, layout: "front-only" })} /><span>Front only<small>Skip back</small></span></label></div></fieldset>}
            <fieldset><legend>Image detail</legend><div className="segmented"><label><input type="radio" name="quality" checked={options.quality === "standard"} onChange={() => setOptions({ ...options, quality: "standard" })} /><span>Standard<small>Smaller file</small></span></label><label><input type="radio" name="quality" checked={options.quality === "high"} onChange={() => setOptions({ ...options, quality: "high" })} /><span>High<small>Best for print</small></span></label></div></fieldset>
            <div className="toggle-row"><label><input type="checkbox" checked={options.labels} onChange={(event) => setOptions({ ...options, labels: event.target.checked })} /><span>Label front and back</span></label><label><input type="checkbox" checked={options.cropMarks} onChange={(event) => setOptions({ ...options, cropMarks: event.target.checked })} /><span>Add crop marks</span></label></div>
            <div className="print-tip"><span aria-hidden="true">100%</span><div><strong>For true-size printing</strong><p>Choose <b>Actual size</b> or <b>100%</b> in the print dialog. Turn off Fit to page.</p></div></div>
            <div className="review-actions"><button className="secondary" onClick={() => setStage("ready")}>Back</button><button className="primary" onClick={generatePdf} disabled={busy}>Create PDF <span aria-hidden="true">→</span></button></div>
          </div>
        )}

        {stage === "complete" && pdfUrl && (
          <div className="panel complete-panel">
            <div className="success-mark" aria-hidden="true">✓</div><span className="step-kicker">PDF ready</span><h1>Your license copy is ready</h1><p>Save it or share it directly. LicenseSizer does not keep a copy.</p>
            <div className="file-card"><div className="pdf-badge">PDF</div><div><strong>{pdfFilename()}</strong><span>{options.pageSize === "letter" ? "US Letter" : "A4"} • True-size card placement</span></div></div>
            <div className="complete-actions">{canShare && <button className="primary large" onClick={sharePdf}>Share PDF <span aria-hidden="true">↗</span></button>}<a className={canShare ? "secondary download" : "primary large download"} href={pdfUrl} download={pdfFilename()}>Download PDF <span aria-hidden="true">↓</span></a></div>
            <div className="print-warning"><strong>Before printing:</strong> select Actual size / 100% and turn off Fit or Scale to page.</div>
            <button className="clear-button" onClick={startOver}>Start over & clear images</button>
          </div>
        )}
      </section>

      <footer>
        <details><summary>Privacy details</summary><p>Photos are processed locally in volatile browser memory. They are not sent to LicenseSizer. Downloaded and shared files are controlled by your browser, device, and chosen destination. Starting over removes the app’s references to your session.</p></details>
        <p>LicenseSizer creates a resized copy. It does not verify identity or document authenticity.</p>
      </footer>
    </main>
  );
}
