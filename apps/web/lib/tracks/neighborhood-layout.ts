export type NeighborhoodLayoutPoint = { x: number; y: number };

export type NeighborhoodLayout = {
  width: number;
  height: number;
  current: NeighborhoodLayoutPoint;
  neighbors: Array<NeighborhoodLayoutPoint & { id: string }>;
  /** Neighbors beyond the drawn set — listed below, not plotted. */
  overflow: number;
};

const VIEW_WIDTH = 720;
const VIEW_HEIGHT = 220;
export const NEIGHBORHOOD_MAX_VISIBLE = 10;

/**
 * Left-current → right-column layout for one neighborhood.
 * Pure + deterministic — no force simulation, no graph library.
 */
export function layoutNeighborhood(
  neighborIds: string[],
  options?: { width?: number; height?: number; maxVisible?: number },
): NeighborhoodLayout {
  const width = options?.width ?? VIEW_WIDTH;
  const height = options?.height ?? VIEW_HEIGHT;
  const maxVisible = options?.maxVisible ?? NEIGHBORHOOD_MAX_VISIBLE;
  const visible = neighborIds.slice(0, maxVisible);
  const overflow = Math.max(0, neighborIds.length - visible.length);

  const current = { x: width * 0.16, y: height * 0.5 };
  const rightX = width * 0.72;
  const top = height * 0.16;
  const bottom = height * 0.84;
  const span = bottom - top;

  const neighbors = visible.map((id, index) => {
    const t = visible.length === 1 ? 0.5 : index / (visible.length - 1);
    return { id, x: rightX, y: top + span * t };
  });

  return { width, height, current, neighbors, overflow };
}

export function neighborhoodEdgePath(
  from: NeighborhoodLayoutPoint,
  to: NeighborhoodLayoutPoint,
  fromR: number,
  toR: number,
): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const start = { x: from.x + ux * fromR, y: from.y + uy * fromR };
  const end = { x: to.x - ux * (toR + 6), y: to.y - uy * (toR + 6) };
  const midX = (start.x + end.x) / 2;
  return `M ${start.x} ${start.y} C ${midX} ${start.y}, ${midX} ${end.y}, ${end.x} ${end.y}`;
}
