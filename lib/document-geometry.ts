import type { Point } from "./image-processing";

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
