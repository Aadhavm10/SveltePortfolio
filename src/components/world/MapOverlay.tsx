import { useEffect, useMemo, useRef } from 'react';
import { X } from 'lucide-react';
import { projects } from '../../data/portfolio';
import { pathCurves, pathPoints, streamCurves } from './env/mask';
import { treeLayout } from './env/Foliage';
import { bridges } from './env/Streams';
import { Icon } from './icons';
import { clearInput, input } from './input';
import {
  BOUNDS,
  COURT,
  FAIR,
  FIELD,
  GOAL,
  POND,
  PROPS,
  stallX,
  STALL_COLORS,
  STATIONS,
  STREAMS,
  WATERFALL,
  ZEN_GARDEN,
  type Station
} from './layout';
import { playerCommands } from './Player';
import { playClose, playOpen, playTick } from './sound';
import { bodies, fx, useWorld, world } from './store';

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

const line = (points: { x: number; z: number }[]) => points.map((p) => `${p.x.toFixed(1)},${p.z.toFixed(1)}`).join(' ');

/** Everything that doesn't move, drawn once. */
function Terrain() {
  const trees = useMemo(() => {
    const { round, pine } = treeLayout();
    const inside = (t: { x: number; z: number }) => t.x > BOUNDS.minX - 4 && t.x < BOUNDS.maxX + 4 && t.z > BOUNDS.minZ - 4 && t.z < BOUNDS.maxZ + 4;
    return { round: round.filter(inside), pine: pine.filter(inside) };
  }, []);
  const stripes = 9;
  const stripeH = (FIELD.halfwayZ - FIELD.goalZ) / stripes;
  return (
    <>
      {/* Paths: a darker edge under a sandy middle */}
      {pathCurves.map((curve, i) => (
        <polyline key={`pe${i}`} points={line(pathPoints(curve))} fill="none" stroke="#d6b985" strokeWidth={3.1} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {pathCurves.map((curve, i) => (
        <polyline key={`p${i}`} points={line(pathPoints(curve))} fill="none" stroke="#f0dcb0" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {/* Streams with sandy banks, then the pond and falls */}
      {streamCurves.map((curve, i) => (
        <polyline key={`sb${i}`} points={line(pathPoints(curve))} fill="none" stroke="#ead9ad" strokeWidth={STREAMS[i].width + 1.3} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      <ellipse cx={POND.x} cy={POND.z} rx={POND.rx * 1.12} ry={POND.rz * 1.15} fill="#ead9ad" />
      {streamCurves.map((curve, i) => (
        <polyline key={`s${i}`} points={line(pathPoints(curve))} fill="none" stroke="#86cfe3" strokeWidth={STREAMS[i].width} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      <ellipse cx={POND.x} cy={POND.z} rx={POND.rx} ry={POND.rz} fill="#86cfe3" />
      <ellipse cx={POND.x - 2} cy={POND.z - 1} rx={POND.rx * 0.55} ry={POND.rz * 0.45} fill="#9ad8ea" />
      {[
        [10, -41],
        [19, -37.5],
        [16.5, -43.5]
      ].map(([x, z], i) => (
        <circle key={i} cx={x} cy={z} r={0.7} fill="#7fb85f" />
      ))}
      <rect x={WATERFALL.x - 8} y={WATERFALL.z - 4.5} width={16} height={4.4} rx={1} fill="#b8ad9c" />
      <rect x={WATERFALL.x - WATERFALL.width * 0.35} y={WATERFALL.z - 4.5} width={WATERFALL.width * 0.7} height={4.6} fill="#c8eef7" />
      {bridges.map((b, i) => (
        <rect
          key={`br${i}`}
          x={-b.width / 2}
          y={-b.length / 2}
          width={b.width}
          height={b.length}
          rx={0.3}
          fill={b.red ? '#e0604a' : '#b98656'}
          transform={`translate(${b.x} ${b.z}) rotate(${(-b.yaw * 180) / Math.PI})`}
        />
      ))}
      {/* The pitch, striped, with its lines */}
      {Array.from({ length: stripes }, (_, i) => (
        <rect key={`f${i}`} x={FIELD.minX} y={FIELD.goalZ + i * stripeH} width={FIELD.maxX - FIELD.minX} height={stripeH} fill={i % 2 ? '#8acb6c' : '#96d277'} />
      ))}
      <g fill="none" stroke="#ffffff" strokeWidth={0.3}>
        <rect x={FIELD.minX} y={FIELD.goalZ} width={FIELD.maxX - FIELD.minX} height={FIELD.halfwayZ - FIELD.goalZ} />
        <rect x={-FIELD.box.width / 2} y={FIELD.goalZ} width={FIELD.box.width} height={FIELD.box.depth} />
        <path d={`M ${-FIELD.centreRadius} ${FIELD.halfwayZ} A ${FIELD.centreRadius} ${FIELD.centreRadius} 0 0 1 ${FIELD.centreRadius} ${FIELD.halfwayZ}`} />
      </g>
      <rect x={GOAL.x - GOAL.width / 2} y={GOAL.z - 1.4} width={GOAL.width} height={1.4} fill="#ffffff" opacity={0.85} />
      {/* The court */}
      <rect x={COURT.minX} y={COURT.minZ} width={COURT.maxX - COURT.minX} height={COURT.maxZ - COURT.minZ} rx={0.6} fill="#5b93b0" />
      <rect x={COURT.x - COURT.keyWidth / 2} y={COURT.baselineZ} width={COURT.keyWidth} height={COURT.freeThrowZ - COURT.baselineZ} fill="#e8894a" />
      <path
        d={`M ${COURT.x - COURT.threeRadius} ${COURT.baselineZ} L ${COURT.x - COURT.threeRadius} ${COURT.rim.z} A ${COURT.threeRadius} ${COURT.threeRadius} 0 0 0 ${COURT.x + COURT.threeRadius} ${COURT.rim.z} L ${COURT.x + COURT.threeRadius} ${COURT.baselineZ}`}
        fill="none"
        stroke="#ffffff"
        strokeWidth={0.3}
      />
      {/* Zen garden: raked sand and three stones */}
      <rect x={ZEN_GARDEN.x - ZEN_GARDEN.w / 2} y={ZEN_GARDEN.z - ZEN_GARDEN.d / 2} width={ZEN_GARDEN.w} height={ZEN_GARDEN.d} rx={0.4} fill="#f1e8d4" stroke="#b4ac9d" strokeWidth={0.35} />
      {[-1.8, -0.6, 0.6, 1.8].map((dz) => (
        <line key={dz} x1={ZEN_GARDEN.x - ZEN_GARDEN.w / 2 + 0.6} x2={ZEN_GARDEN.x + ZEN_GARDEN.w / 2 - 0.6} y1={ZEN_GARDEN.z + dz} y2={ZEN_GARDEN.z + dz} stroke="#d8ccb0" strokeWidth={0.18} />
      ))}
      {[
        [-2.3, -0.7, 0.85],
        [1.5, 0.8, 0.6],
        [2.8, -1.4, 0.42]
      ].map(([dx, dz, r], i) => (
        <circle key={i} cx={ZEN_GARDEN.x + dx} cy={ZEN_GARDEN.z + dz} r={r} fill="#9d978c" />
      ))}
      <text x={PROPS.letters.x} y={PROPS.letters.z + 0.9} textAnchor="middle" className="world-map-letters">
        AADHAV
      </text>
      {/* Desk: laptop and monitor joined by a cable */}
      <path d={`M ${PROPS.laptop.x + 2.9} ${PROPS.laptop.z} Q ${(PROPS.laptop.x + PROPS.monitor.x) / 2} ${PROPS.laptop.z + 1.6} ${PROPS.monitor.x - 0.5} ${PROPS.monitor.z}`} fill="none" stroke="#ffb3a1" strokeWidth={0.3} />
      <rect x={PROPS.laptop.x - 2.85} y={PROPS.laptop.z - 1.95} width={5.7} height={3.9} rx={0.4} fill="#cdd0d6" />
      <rect x={PROPS.monitor.x - 2.55} y={PROPS.monitor.z - 0.5} width={5.1} height={0.9} rx={0.3} fill="#4a4c55" />
      <rect x={PROPS.psp.x - 2.4} y={PROPS.psp.z - 0.6} width={4.8} height={1.6} rx={0.8} fill="#d5d8de" />
      {/* Globe on its stand */}
      <circle cx={PROPS.globe.x} cy={PROPS.globe.z} r={2.1} fill="#8fd0e6" stroke="#d9a441" strokeWidth={0.35} />
      <path d={`M ${PROPS.globe.x - 1.2} ${PROPS.globe.z - 0.6} q 0.8 -1 1.6 -0.2 q 0.4 0.9 -0.4 1.4 q -1 0.3 -1.2 -1.2 z`} fill="#bfe3a0" />
      {/* My room: a little cutaway square on its plinth, with its hallway */}
      <g transform={`translate(${PROPS.room.x} ${PROPS.room.z}) rotate(${(-PROPS.room.yaw * 180) / Math.PI})`}>
        <rect x={-2.3} y={-2.2} width={4.6} height={5.4} rx={0.4} fill="#3a3346" />
        <rect x={-1.9} y={-1.8} width={3.8} height={3.6} fill="#cdb99c" />
        <rect x={-1.9} y={1.8} width={0.9} height={0.9} fill="#c4966a" />
        <rect x={-1.9} y={-1.8} width={3.8} height={0.14} fill="#eadfcd" />
        <rect x={-1.9} y={-1.8} width={0.14} height={4.5} fill="#eadfcd" />
        <rect x={0.25} y={-1.65} width={1.65} height={2.1} rx={0.15} fill="#f4f1ea" />
      </g>
      <rect x={-31.3} y={18.2} width={3.6} height={2.6} fill="#6b4a33" stroke="#fffaee" strokeWidth={0.2} />
      {/* Campsite */}
      <path d="M -45.8 -27.6 L -43.2 -27.6 L -44.5 -30 Z" fill="#ffb36b" />
      <circle cx={-40.5} cy={-25.5} r={0.7} fill="#ff7a3d" />
      {/* The fair street */}
      {projects.map((_, i) => (
        <g key={`st${i}`} transform={`translate(${stallX(i)} ${FAIR.z})`}>
          <rect x={-FAIR.width / 2} y={-FAIR.depth / 2} width={FAIR.width} height={FAIR.depth} rx={0.3} fill="#fffaee" />
          {[0, 1, 2, 3].map((k) => (
            <rect key={k} x={-FAIR.width / 2 + k * (FAIR.width / 4)} y={-FAIR.depth / 2} width={FAIR.width / 8} height={FAIR.depth} fill={STALL_COLORS[i % STALL_COLORS.length]} />
          ))}
        </g>
      ))}
      {/* Trees: round canopies and little pines */}
      {trees.round.map((t, i) => (
        <g key={`t${i}`}>
          <circle cx={t.x + 0.25} cy={t.z + 0.35} r={1.35 * t.s} fill="rgba(60, 90, 40, 0.18)" />
          <circle cx={t.x} cy={t.z} r={1.3 * t.s} fill={t.color} stroke="rgba(0,0,0,0.08)" strokeWidth={0.2} />
        </g>
      ))}
      {trees.pine.map((t, i) => (
        <path key={`pi${i}`} d={`M ${t.x} ${t.z - 1.6 * t.s} L ${t.x + 1.1 * t.s} ${t.z + 0.9 * t.s} L ${t.x - 1.1 * t.s} ${t.z + 0.9 * t.s} Z`} fill={t.color} />
      ))}
    </>
  );
}

/** Top-down park map; pick a place to hop there. */
export function MapOverlay() {
  const open = useWorld((s) => s.mapOpen);
  const dot = useRef<SVGGElement>(null);
  const arrow = useRef<SVGPathElement>(null);

  useEffect(() => {
    if (!open) return;
    let raf = 0;
    const loop = () => {
      const p = bodies.player?.translation();
      if (p && dot.current) dot.current.setAttribute('transform', `translate(${p.x.toFixed(2)} ${p.z.toFixed(2)})`);
      if (arrow.current) arrow.current.setAttribute('transform', `rotate(${((Math.atan2(fx.facing.x, -fx.facing.z) * 180) / Math.PI).toFixed(1)})`);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [open]);

  if (!open) return null;
  const pad = 3;
  const { minX, maxX, minZ, maxZ } = BOUNDS;
  const pins = STATIONS.filter((s) => !s.id.startsWith('stall-'));
  const stalls = STATIONS.filter((s) => s.id.startsWith('stall-'));
  return (
    <div className="world-map-backdrop" onClick={() => toggleMap(false)}>
      <section className="world-map" role="dialog" aria-label="Park map" onClick={(e) => e.stopPropagation()}>
        <header className="world-map-header">
          <p className="world-map-title">Aadhav's park</p>
          <button type="button" className="world-map-close" onClick={() => toggleMap(false)} aria-label="Close map">
            <X size={20} />
          </button>
        </header>
        <svg viewBox={`${minX - pad} ${minZ - pad} ${maxX - minX + pad * 2} ${maxZ - minZ + pad * 2}`} className="world-map-svg">
          <rect x={minX - pad} y={minZ - pad} width={maxX - minX + pad * 2} height={maxZ - minZ + pad * 2} fill="#9fcf83" />
          <rect x={minX} y={minZ} width={maxX - minX} height={maxZ - minZ} rx={6} fill="#b5df95" />
          {[
            [-30, -12, 9],
            [30, 6, 10],
            [-20, 18, 8],
            [35, -30, 9]
          ].map(([x, z, r], i) => (
            <circle key={i} cx={x} cy={z} r={r} fill="#aad78a" />
          ))}
          <Terrain />
          {/* Compass */}
          <g transform={`translate(${maxX - 4} ${minZ + 5})`} className="world-map-compass">
            <circle r={3.2} fill="#fffaee" stroke="#d6b985" strokeWidth={0.3} />
            <path d="M 0 -2.6 L 1 0 L 0 -0.6 L -1 0 Z" fill="#e0604a" />
            <path d="M 0 2.6 L 1 0 L 0 0.6 L -1 0 Z" fill="#8a7a68" />
            <text y={-3.8} textAnchor="middle" className="world-map-label">
              N
            </text>
          </g>
          {/* Stall badges along the fair, one label for the street */}
          {stalls.map((s, i) => (
            <g
              key={s.id}
              className="world-map-pin"
              transform={`translate(${s.x} ${s.z - 1.6})`}
              role="button"
              tabIndex={0}
              aria-label={`Travel to the ${s.name} stall`}
              onClick={() => travel(s)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && travel(s)}
            >
              <circle r={4} fill="transparent" />
              <circle r={1.7} fill="#fffaee" stroke={s.color} strokeWidth={0.6} />
              <text y={0.75} textAnchor="middle" className="world-map-number">
                {i + 1}
              </text>
            </g>
          ))}
          <text x={(stallX(0) + stallX(projects.length - 1)) / 2} y={FAIR.streetZ + 4.2} textAnchor="middle" className="world-map-label">
            Project fair
          </text>
          {pins.map((s) => (
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
              <circle r={5.5} fill="transparent" />
              <circle r={3.1} fill="#fffaee" stroke={s.color === '#ffffff' ? '#d6b985' : s.color} strokeWidth={0.7} />
              <Icon name={s.icon} x={-1.7} y={-1.7} width={3.4} height={3.4} size={3.4} color="#4a3b2c" strokeWidth={2.2} />
              <text y={6} textAnchor="middle" className="world-map-label">
                {s.name}
              </text>
            </g>
          ))}
          <g ref={dot} className="world-map-you">
            <circle r={2.6} fill="#ff7a59" opacity={0.3} />
            <path ref={arrow} d="M 0 -2 L 1.4 1.4 L 0 0.6 L -1.4 1.4 Z" fill="#ff7a59" stroke="#ffffff" strokeWidth={0.45} strokeLinejoin="round" />
          </g>
        </svg>
        <p className="world-map-hint">Tap a place to hop over there.</p>
      </section>
    </div>
  );
}
