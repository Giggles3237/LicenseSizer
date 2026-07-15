import type { Point } from "./image-processing";

type RectLike = { left: number; top: number; width: number; height: number };

const clamp = (value: number) => Math.max(0, Math.min(1, value));

export function mapGuideToVideoCorners(
  guide: RectLike,
  videoElement: RectLike,
  videoWidth: number,
  videoHeight: number,
): [Point, Point, Point, Point] {
  const scale = Math.max(videoElement.width / videoWidth, videoElement.height / videoHeight);
  const renderedWidth = videoWidth * scale;
  const renderedHeight = videoHeight * scale;
  const croppedX = (renderedWidth - videoElement.width) / 2;
  const croppedY = (renderedHeight - videoElement.height) / 2;
  const normalize = (screenX: number, screenY: number): Point => ({
    x: clamp((screenX - videoElement.left + croppedX) / renderedWidth),
    y: clamp((screenY - videoElement.top + croppedY) / renderedHeight),
  });

  return [
    normalize(guide.left, guide.top),
    normalize(guide.left + guide.width, guide.top),
    normalize(guide.left + guide.width, guide.top + guide.height),
    normalize(guide.left, guide.top + guide.height),
  ];
}
