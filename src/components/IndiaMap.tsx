"use client";

import { INDIA_OUTLINE, INDIA_VIEWBOX } from "@/data/indiaOutline";
import { arc, inFrame, project, towardsEdge, type Point } from "@/lib/geo";

export interface MapPlace {
  id: string;
  name: string;
  lat: number;
  lon: number;
  /** Fits the budget: drawn solid. Otherwise hollow. */
  fits: boolean;
}

const { width: W, height: H } = INDIA_VIEWBOX;
const pct = (p: Point) => ({ left: `${(p.x / W) * 100}%`, top: `${(p.y / H) * 100}%` });
// Hairlines stay hairlines at any size.
const hair = { vectorEffect: "non-scaling-stroke" } as const;
const TROPIC_Y = project(23.44, 70).y;

/**
 * A thin-line map of India. Shows where you start, the places on the board, and a dotted route to the
 * one in focus. Places abroad sit outside the outline, so their route runs to the edge and points the way.
 */
export function IndiaMap({
  origin,
  places = [],
  activeId = null,
  labelIds = [],
  onHover,
  onSelect,
  drawing = false,
  className = "",
  label,
}: {
  origin: { lat: number; lon: number; city: string };
  places?: MapPlace[];
  activeId?: string | null;
  /** Places to name on the map (the top picks), besides the one in focus. */
  labelIds?: string[];
  onHover?: (id: string | null) => void;
  onSelect?: (id: string) => void;
  /** Animate the route, for the planning screen. */
  drawing?: boolean;
  className?: string;
  /** What the map shows, for screen readers. */
  label: string;
}) {
  const from = project(origin.lat, origin.lon);
  const pts = places.map((p) => ({ ...p, at: project(p.lat, p.lon) }));
  const active = pts.find((p) => p.id === activeId);
  const activeEnd = active ? (inFrame(active.at, 6) ? active.at : towardsEdge(from, active.at)) : null;
  const activeAbroad = Boolean(active && !inFrame(active.at, 6));

  // Name the top picks, skipping any that would sit on top of another label.
  const placed: Point[] = [from];
  if (activeEnd) placed.push(activeEnd);
  const labels = pts.filter((p) => {
    if (p.id === activeId || !labelIds.includes(p.id) || !inFrame(p.at, 6)) return false;
    if (placed.some((q) => Math.abs(q.y - p.at.y) < 22 && Math.abs(q.x - p.at.x) < 120)) return false;
    placed.push(p.at);
    return true;
  });

  return (
    <figure className={`relative mx-auto aspect-[612/696] w-full ${className}`} aria-label={label} role="img">
      <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
        <path d={INDIA_OUTLINE} fill="none" stroke="var(--soft)" strokeOpacity={0.55} strokeWidth={1} strokeLinejoin="round" style={hair} />
        <line x1={0} x2={W} y1={TROPIC_Y} y2={TROPIC_Y} stroke="var(--line)" strokeWidth={1} strokeDasharray="2 5" style={hair} />

        {pts.map((p) =>
          inFrame(p.at, 2) ? (
            <g
              key={p.id}
              className={onSelect ? "cursor-pointer" : undefined}
              onMouseEnter={() => onHover?.(p.id)}
              onMouseLeave={() => onHover?.(null)}
              onClick={() => onSelect?.(p.id)}
            >
              <circle cx={p.at.x} cy={p.at.y} r={12} fill="transparent" />
              <circle
                cx={p.at.x}
                cy={p.at.y}
                r={p.id === activeId ? 5 : 3.6}
                fill={p.fits ? "var(--ink)" : "var(--bg)"}
                stroke={p.fits ? "none" : "var(--faint)"}
                strokeWidth={1.2}
                style={hair}
              />
            </g>
          ) : null,
        )}

        {activeEnd && (
          <>
            <path
              key={`${activeId}-${drawing}`}
              d={arc(from, activeEnd)}
              fill="none"
              stroke="var(--ink)"
              strokeWidth={1.6}
              strokeLinecap="round"
              style={hair}
              {...(drawing ? { pathLength: 1, strokeDasharray: "1", className: "animate-draw" } : { strokeDasharray: "0.5 6" })}
            />
            {activeAbroad ? (
              <circle cx={activeEnd.x} cy={activeEnd.y} r={4.5} fill="var(--bg)" stroke="var(--ink)" strokeWidth={1.4} style={hair} />
            ) : (
              <circle cx={activeEnd.x} cy={activeEnd.y} r={9} fill="none" stroke="var(--ink)" strokeWidth={1} style={hair} />
            )}
          </>
        )}

        <circle cx={from.x} cy={from.y} r={5} fill="var(--ink)" />
        <circle cx={from.x} cy={from.y} r={5} fill="none" stroke="var(--ink)" strokeWidth={1} style={hair}>
          <animate attributeName="r" values="5;16" dur="2.4s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.5;0" dur="2.4s" repeatCount="indefinite" />
        </circle>
      </svg>

      <MapLabel at={from} strong>
        {origin.city}
      </MapLabel>
      {labels.map((p) => (
        <MapLabel key={p.id} at={p.at}>
          {p.name}
        </MapLabel>
      ))}
      {active && activeEnd && (
        <MapLabel at={activeEnd} strong>
          {activeAbroad ? `${active.name} →` : active.name}
        </MapLabel>
      )}
    </figure>
  );
}

/** Text placed over the map in real pixels, so it stays readable however small the map is drawn. */
function MapLabel({ at, children, strong = false }: { at: Point; children: string; strong?: boolean }) {
  const right = at.x > W * 0.72;
  return (
    <span
      className={`pointer-events-none absolute -translate-y-1/2 whitespace-nowrap font-mono text-[11px] leading-none ${
        strong ? "text-ink" : "text-faint"
      } ${right ? "-translate-x-full pr-3" : "pl-3"}`}
      style={pct(at)}
    >
      <span className="rounded bg-bg/80 px-0.5">{children}</span>
    </span>
  );
}
