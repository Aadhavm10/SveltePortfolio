import { useEffect, useRef } from 'react';
import { pathCurves, pathPoints, streamCurves } from './env/mask';
import { clearInput, input } from './input';
import { BOUNDS, COURT, FIELD, GOAL, POND, STATIONS, ZEN_GARDEN, type Station } from './layout';
import { playerCommands } from './Player';
import { playClose, playOpen, playTick } from './sound';
import { bodies, useWorld, world } from './store';

export function toggleMap(open = !world.get().mapOpen, silent = false) {
  if (open && world.get().mode !== 'play') return;
  if (open === world.get().mapOpen) return;
  clearInput();
  if (!silent) (open ? playTick : playClose)();
  world.set({ mapOpen: open });
}

/** Jump to a station's interaction point, facing it, with the ball at your feet. */
function travel(station: Station) {
  playerCommands.teleport = { x: station.x, z: station.z + 1.2, yaw: Math.PI };
  input.resetBall = true;
  playOpen();
  toggleMap(false, true);
}

const polyline = (points: { x: number; z: number }[]) => points.map((p) => `${p.x.toFixed(1)},${p.z.toFixed(1)}`).join(' ');

/** Top-down park map; pick a place to fast-travel there. */
export function MapOverlay() {
  const open = useWorld((s) => s.mapOpen);
  const dot = useRef<SVGGElement>(null);

  useEffect(() => {
    if (!open) return;
    let raf = 0;
    const loop = () => {
      const p = bodies.player?.translation();
      if (p && dot.current) dot.current.setAttribute('transform', `translate(${p.x.toFixed(2)} ${p.z.toFixed(2)})`);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [open]);

  if (!open) return null;
  const pad = 3;
  const { minX, maxX, minZ, maxZ } = BOUNDS;
  return (
    <div className="world-map-backdrop" onClick={() => toggleMap(false)}>
      <section className="world-map" role="dialog" aria-label="Park map" onClick={(e) => e.stopPropagation()}>
        <header className="world-map-header">
          <p className="world-map-title">Park map</p>
          <button type="button" className="world-map-close" onClick={() => toggleMap(false)} aria-label="Close map">
            ×
          </button>
        </header>
        <svg viewBox={`${minX - pad} ${minZ - pad} ${maxX - minX + pad * 2} ${maxZ - minZ + pad * 2}`} className="world-map-svg">
          <rect x={minX} y={minZ} width={maxX - minX} height={maxZ - minZ} rx={7} fill="#a9d98b" />
          {pathCurves.map((curve, i) => (
            <polyline key={i} points={polyline(pathPoints(curve))} fill="none" stroke="#ead6ad" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
          ))}
          {streamCurves.map((curve, i) => (
            <polyline key={i} points={polyline(pathPoints(curve))} fill="none" stroke="#86cfe3" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
          ))}
          <ellipse cx={POND.x} cy={POND.z} rx={POND.rx} ry={POND.rz} fill="#86cfe3" />
          <rect x={FIELD.minX} y={FIELD.goalZ} width={FIELD.maxX - FIELD.minX} height={FIELD.halfwayZ - FIELD.goalZ} rx={1} fill="#8acb6c" stroke="#ffffff" strokeWidth={0.35} />
          <rect x={GOAL.x - GOAL.width / 2} y={GOAL.z - 1.6} width={GOAL.width} height={1.6} fill="#ffffff" opacity={0.8} />
          <rect x={COURT.minX} y={COURT.minZ} width={COURT.maxX - COURT.minX} height={COURT.maxZ - COURT.minZ} rx={1} fill="#5b93b0" />
          <rect x={ZEN_GARDEN.x - ZEN_GARDEN.w / 2} y={ZEN_GARDEN.z - ZEN_GARDEN.d / 2} width={ZEN_GARDEN.w} height={ZEN_GARDEN.d} rx={1} fill="#efe6d2" />
          {STATIONS.map((s) => (
            <g
              key={s.id}
              className="world-map-pin"
              transform={`translate(${s.x} ${s.z - 1.5})`}
              role="button"
              tabIndex={0}
              aria-label={`Travel to ${s.name}`}
              onClick={() => travel(s)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && travel(s)}
            >
              {/* Bigger invisible hit area for fingers */}
              <circle r={5.5} fill="transparent" />
              <circle r={3.1} fill="#fffaf0" stroke={s.color} strokeWidth={0.7} />
              <text y={1.15} textAnchor="middle" fontSize={3.2}>
                {s.icon}
              </text>
              <text y={6} textAnchor="middle" className="world-map-label">
                {s.name}
              </text>
            </g>
          ))}
          <g ref={dot} className="world-map-you">
            <circle r={2.4} fill="#ff7a59" opacity={0.3} />
            <circle r={1.3} fill="#ff7a59" stroke="#ffffff" strokeWidth={0.5} />
          </g>
        </svg>
        <p className="world-map-hint">Pick a place to hop over there.</p>
      </section>
    </div>
  );
}
