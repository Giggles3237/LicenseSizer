import type * as PdfJs from "pdfjs-dist";

const MAX_RENDERED_DIMENSION = 2400;

let pdfJsPromise: Promise<typeof PdfJs> | null = null;

function loadPdfJs() {
  pdfJsPromise ??= import("pdfjs-dist/legacy/webpack.mjs") as Promise<typeof PdfJs>;
  return pdfJsPromise;
}

function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob(
    (blob) => blob ? resolve(blob) : reject(new Error("Unable to prepare this PDF page for cropping.")),
    "image/jpeg",
    0.92,
  ));
}

export async function renderPdfFirstPageToImage(file: File | Blob): Promise<Blob> {
  const pdfjs = await loadPdfJs();
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    disableFontFace: true,
    isImageDecoderSupported: false,
    maxImageSize: 60_000_000,
    useWorkerFetch: false,
  });

  let pdf: PdfJs.PDFDocumentProxy | null = null;
  try {
    pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(MAX_RENDERED_DIMENSION / Math.max(baseViewport.width, baseViewport.height), 4);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Unable to render this PDF page.");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    return await canvasToJpeg(canvas);
  } finally {
    if (pdf) await pdf.cleanup();
    await loadingTask.destroy();
  }
}
