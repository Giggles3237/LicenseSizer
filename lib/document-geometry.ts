import type { Point } from "./image-processing";

export type EdgeLine = { start: Point; end: Point };

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

const clamp = (value: number) => Math.max(0, Math.min(1, value));

export function cornersToEdgeLines(corners: [Point, Point, Point, Point]): [EdgeLine, EdgeLine, EdgeLine, EdgeLine] {
  const ordered = orderDocumentPoints(corners);
  return ordered.map((point, index) => {
    const next = ordered[(index + 1) % ordered.length];
    return {
      start: { x: point.x * 0.75 + next.x * 0.25, y: point.y * 0.75 + next.y * 0.25 },
      end: { x: point.x * 0.25 + next.x * 0.75, y: point.y * 0.25 + next.y * 0.75 },
    };
  }) as [EdgeLine, EdgeLine, EdgeLine, EdgeLine];
}

function lineIntersection(first: EdgeLine, second: EdgeLine): Point | null {
  const x1 = first.start.x; const y1 = first.start.y;
  const x2 = first.end.x; const y2 = first.end.y;
  const x3 = second.start.x; const y3 = second.start.y;
  const x4 = second.end.x; const y4 = second.end.y;
  const divisor = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(divisor) < 0.00001) return null;
  return {
    x: ((x1 * y2 - y1 * x2) * (x3 - x4) - (x1 - x2) * (x3 * y4 - y3 * x4)) / divisor,
    y: ((x1 * y2 - y1 * x2) * (y3 - y4) - (y1 - y2) * (x3 * y4 - y3 * x4)) / divisor,
  };
}

export function edgeLinesToCorners(lines: [EdgeLine, EdgeLine, EdgeLine, EdgeLine]): [Point, Point, Point, Point] | null {
  const corners = [
    lineIntersection(lines[3], lines[0]),
    lineIntersection(lines[0], lines[1]),
    lineIntersection(lines[1], lines[2]),
    lineIntersection(lines[2], lines[3]),
  ];
  if (corners.some((point) => !point || point.x < -0.08 || point.x > 1.08 || point.y < -0.08 || point.y > 1.08)) return null;
  return corners.map((point) => ({ x: clamp(point!.x), y: clamp(point!.y) })) as [Point, Point, Point, Point];
}

/** Returns the visible segment of an infinite line clipped to the image bounds. */
export function extendLineToBounds(line: EdgeLine): EdgeLine {
  const dx = line.end.x - line.start.x;
  const dy = line.end.y - line.start.y;
  const candidates: Array<{ point: Point; t: number }> = [];
  const add = (t: number) => {
    const point = { x: line.start.x + dx * t, y: line.start.y + dy * t };
    if (point.x >= -0.0001 && point.x <= 1.0001 && point.y >= -0.0001 && point.y <= 1.0001) candidates.push({ point, t });
  };
  if (Math.abs(dx) > 0.00001) { add(-line.start.x / dx); add((1 - line.start.x) / dx); }
  if (Math.abs(dy) > 0.00001) { add(-line.start.y / dy); add((1 - line.start.y) / dy); }
  candidates.sort((a, b) => a.t - b.t);
  if (candidates.length < 2) return line;
  return { start: candidates[0].point, end: candidates[candidates.length - 1].point };
}

export function squareToQuadrilateral(points: [Point, Point, Point, Point], width: number, height: number) {
  const [p0, p1, p2, p3] = orderDocumentPoints(points).map((point) => ({ x: point.x * (width - 1), y: point.y * (height - 1) })) as [Point, Point, Point, Point];
  const dx1 = p1.x - p2.x;
  const dx2 = p3.x - p2.x;
  const dx3 = p0.x - p1.x + p2.x - p3.x;
  const dy1 = p1.y - p2.y;
  const dy2 = p3.y - p2.y;
  const dy3 = p0.y - p1.y + p2.y - p3.y;
  const divisor = dx1 * dy2 - dx2 * dy1;
  const g = Math.abs(divisor) > 0.000001 ? (dx3 * dy2 - dx2 * dy3) / divisor : 0;
  const h = Math.abs(divisor) > 0.000001 ? (dx1 * dy3 - dx3 * dy1) / divisor : 0;
  return {
    a: p1.x - p0.x + g * p1.x, b: p3.x - p0.x + h * p3.x, c: p0.x,
    d: p1.y - p0.y + g * p1.y, e: p3.y - p0.y + h * p3.y, f: p0.y,
    g, h,
  };
}
