import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export const MM_TO_POINTS = 72 / 25.4;
export const CARD_WIDTH_POINTS = 85.6 * MM_TO_POINTS;
export const CARD_HEIGHT_POINTS = 53.98 * MM_TO_POINTS;

export type PdfOptions = {
  pageSize: "letter" | "a4";
  layout: "front-only" | "stacked" | "separate-pages";
  labels: boolean;
  cropMarks: boolean;
};

const PAGE_SIZES = {
  letter: { width: 612, height: 792 },
  a4: { width: 210 * MM_TO_POINTS, height: 297 * MM_TO_POINTS },
};

export function cardPlacement(pageWidth: number, pageHeight: number, count: 1 | 2) {
  const gap = 36;
  const groupHeight = count === 2 ? CARD_HEIGHT_POINTS * 2 + gap : CARD_HEIGHT_POINTS;
  const firstY = (pageHeight + groupHeight) / 2 - CARD_HEIGHT_POINTS;
  return {
    x: (pageWidth - CARD_WIDTH_POINTS) / 2,
    firstY,
    secondY: firstY - gap - CARD_HEIGHT_POINTS,
  };
}

export async function composePdf(front: Blob, back: Blob | null, options: PdfOptions): Promise<Blob> {
  const pdf = await PDFDocument.create();
  pdf.setTitle("License copy");
  pdf.setCreator("LicenseResizer");
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const pageSize = PAGE_SIZES[options.pageSize];
  const frontImage = await pdf.embedJpg(await front.arrayBuffer());
  const backImage = back ? await pdf.embedJpg(await back.arrayBuffer()) : null;

  const drawCropMarks = (page: ReturnType<typeof pdf.addPage>, x: number, y: number) => {
    if (!options.cropMarks) return;
    const length = 9;
    const offset = 4;
    const color = rgb(0.25, 0.3, 0.34);
    const lines = [
      [x - offset - length, y, x - offset, y], [x, y - offset - length, x, y - offset],
      [x + CARD_WIDTH_POINTS + offset, y, x + CARD_WIDTH_POINTS + offset + length, y], [x + CARD_WIDTH_POINTS, y - offset - length, x + CARD_WIDTH_POINTS, y - offset],
      [x - offset - length, y + CARD_HEIGHT_POINTS, x - offset, y + CARD_HEIGHT_POINTS], [x, y + CARD_HEIGHT_POINTS + offset, x, y + CARD_HEIGHT_POINTS + offset + length],
      [x + CARD_WIDTH_POINTS + offset, y + CARD_HEIGHT_POINTS, x + CARD_WIDTH_POINTS + offset + length, y + CARD_HEIGHT_POINTS], [x + CARD_WIDTH_POINTS, y + CARD_HEIGHT_POINTS + offset, x + CARD_WIDTH_POINTS, y + CARD_HEIGHT_POINTS + offset + length],
    ];
    for (const [startX, startY, endX, endY] of lines) page.drawLine({ start: { x: startX, y: startY }, end: { x: endX, y: endY }, thickness: 0.5, color });
  };

  const drawSide = (page: ReturnType<typeof pdf.addPage>, image: typeof frontImage, label: string, x: number, y: number) => {
    page.drawImage(image, { x, y, width: CARD_WIDTH_POINTS, height: CARD_HEIGHT_POINTS });
    drawCropMarks(page, x, y);
    if (options.labels) page.drawText(label, { x, y: y + CARD_HEIGHT_POINTS + 8, size: 8, font, color: rgb(0.2, 0.24, 0.28) });
  };

  if (options.layout === "separate-pages" && backImage) {
    const frontPage = pdf.addPage([pageSize.width, pageSize.height]);
    const placement = cardPlacement(pageSize.width, pageSize.height, 1);
    drawSide(frontPage, frontImage, "Front", placement.x, placement.firstY);
    const backPage = pdf.addPage([pageSize.width, pageSize.height]);
    drawSide(backPage, backImage, "Back", placement.x, placement.firstY);
  } else {
    const includeBack = options.layout === "stacked" && Boolean(backImage);
    const page = pdf.addPage([pageSize.width, pageSize.height]);
    const placement = cardPlacement(pageSize.width, pageSize.height, includeBack ? 2 : 1);
    drawSide(page, frontImage, "Front", placement.x, placement.firstY);
    if (includeBack && backImage) drawSide(page, backImage, "Back", placement.x, placement.secondY);
  }

  const bytes = await pdf.save();
  return new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
}

export function pdfFilename() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `license-copy-${year}-${month}-${day}.pdf`;
}
