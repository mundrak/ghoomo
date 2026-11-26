import { INDIA_VIEWBOX } from "@/data/indiaOutline";

// The India outline uses a Mercator projection. These constants were fitted against the known
// extents of twelve states; places land within about 2 units of a 612-unit-wide frame.
const X_SCALE = 20.9373;
const X_OFFSET = -1427.72;
const Y_SCALE = -20.9347;
const Y_OFFSET = 836.87;

const mercator = (lat: number) => (Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * 180) / Math.PI;

export interface Point {
  x: number;
  y: number;
}

/** Where a place sits on the India map. Places abroad land outside the frame. */
export function project(lat: number, lon: number): Point {
  return { x: X_SCALE * lon + X_OFFSET, y: Y_SCALE * mercator(lat) + Y_OFFSET };
}

export const inFrame = ({ x, y }: Point, pad = 0) =>
  x >= pad && x <= INDIA_VIEWBOX.width - pad && y >= pad && y <= INDIA_VIEWBOX.height - pad;

/**
 * For a place outside the frame: the point where the line from `from` towards it leaves the frame
 * (inset by `pad`), so the map can point the way to places abroad.
 */
export function towardsEdge(from: Point, to: Point, pad = 18): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const limits = [
    dx > 0 ? (INDIA_VIEWBOX.width - pad - from.x) / dx : dx < 0 ? (pad - from.x) / dx : Infinity,
    dy > 0 ? (INDIA_VIEWBOX.height - pad - from.y) / dy : dy < 0 ? (pad - from.y) / dy : Infinity,
  ];
  const t = Math.min(1, ...limits.filter((v) => v > 0));
  return { x: from.x + dx * t, y: from.y + dy * t };
}

/** A gentle arc from one point to another, as an SVG path. Bows to the left of the direction of travel. */
export function arc(a: Point, b: Point, bend = 0.18): string {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const cx = mx + dy * bend;
  const cy = my - dx * bend;
  return `M${a.x.toFixed(1)} ${a.y.toFixed(1)}Q${cx.toFixed(1)} ${cy.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
}
