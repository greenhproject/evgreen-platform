export type GalleryDirection = "previous" | "next";

export function wrapGalleryIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return ((index % length) + length) % length;
}

export function moveGalleryIndex(
  currentIndex: number,
  length: number,
  direction: GalleryDirection,
): number {
  return wrapGalleryIndex(currentIndex + (direction === "next" ? 1 : -1), length);
}

export function getHorizontalSwipeDirection(
  start: { x: number; y: number },
  end: { x: number; y: number },
  threshold = 48,
): GalleryDirection | null {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  if (Math.abs(deltaX) < threshold || Math.abs(deltaX) <= Math.abs(deltaY) * 1.2) return null;
  return deltaX < 0 ? "next" : "previous";
}
