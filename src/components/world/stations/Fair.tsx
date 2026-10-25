import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier';
import {
  BoxGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  Group,
  InstancedMesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  Object3D,
  QuadraticBezierCurve3,
  SphereGeometry,
  TubeGeometry,
  Vector3
} from 'three';
import { projects, type Project } from '../../../data/portfolio';
import { mergeParts, tinted, type Part } from '../env/merge';
import { FAIR, STALL_COLORS, stallX } from '../layout';
import { world } from '../store';
import { canvasTexture, DISPLAY_FONT, loadImage } from '../textures';
import { useScreen } from './common';
import { drawStallBoard } from './screens';

const W = FAIR.width;
const D = FAIR.depth;
const BOARD_Z = -1.22;
const BOARD_Y = 2.0;

/** Wooden frame, counter and awning of one stall, merged into two meshes. */
function stallGeometry(color: string) {
  const wood = '#b98656';
  const darkWood = '#8a5a36';
  const pale = new Color(color).lerp(new Color('#ffffff'), 0.55).getStyle();
  const box = (w: number, h: number, d: number, c: string, position: [number, number, number], rotation?: [number, number, number]): Part => ({
    geometry: tinted(new BoxGeometry(w, h, d), c),
    position,
    rotation
  });
  const frame = mergeParts([
    box(W, 0.12, D, '#c9a27a', [0, 0.06, 0]),
    ...[-1, 1].flatMap((side) => [
      box(0.14, 3.75, 0.14, darkWood, [side * (W / 2 - 0.1), 1.88, D / 2 - 0.2]),
      box(0.14, 4.2, 0.14, darkWood, [side * (W / 2 - 0.1), 2.1, -D / 2 + 0.1]),
      box(0.06, 1.0, D - 0.4, wood, [side * (W / 2 - 0.1), 0.62, 0])
    ]),
    box(W - 0.2, 3.9, 0.08, '#d9b48a', [0, 2.05, -D / 2 + 0.06]),
    // Chalkboard frame
    box(3.62, 2.32, 0.06, darkWood, [0, BOARD_Y, BOARD_Z - 0.04]),
    // Counter: coloured front panel and a plank top
    box(W - 0.3, 1.0, 0.7, pale, [0, 0.56, 1.0]),
    box(W - 0.1, 0.08, 0.86, wood, [0, 1.1, 1.0]),
    // Sign plank and its hangers
    box(2.4, 0.56, 0.07, darkWood, [0, 3.72, D / 2 + 0.4]),
    ...[-1, 1].map((side) => box(0.04, 0.3, 0.04, darkWood, [side * 1.1, 3.97, D / 2 + 0.38])),
    // Two stools out front
    ...[-1.05, 1.05].flatMap((sx) => [
      { geometry: tinted(new CylinderGeometry(0.32, 0.3, 0.1, 16), color), position: [sx, 0.68, 2.5] } as Part,
      { geometry: tinted(new CylinderGeometry(0.06, 0.08, 0.64, 8), darkWood), position: [sx, 0.33, 2.5] } as Part
    ])
  ]);
  // Striped awning, sloping down to the front, with a scalloped edge.
  const stripes = 8;
  const awningParts: Part[] = [];
  const back = new Vector3(0, 4.25, -D / 2 - 0.05);
  const front = new Vector3(0, 3.72, D / 2 + 0.45);
  const length = back.distanceTo(front);
  const tilt = Math.atan2(back.y - front.y, front.z - back.z);
  const sw = (W + 0.3) / stripes;
  for (let i = 0; i < stripes; i++) {
    const x = -W / 2 - 0.15 + sw * (i + 0.5);
    const c = i % 2 ? '#fffaee' : color;
    awningParts.push(box(sw, 0.05, length, c, [x, (back.y + front.y) / 2, (back.z + front.z) / 2], [tilt, 0, 0]));
    awningParts.push({
      geometry: tinted(new CircleGeometry(sw / 2, 10, Math.PI, Math.PI), c),
      position: [x, front.y - 0.02, front.z + 0.005]
    });
  }
  return { frame, awning: mergeParts(awningParts) };
}

function signTexture(title: string, color: string) {
  return canvasTexture(640, 140, (ctx, w, h) => {
    ctx.fillStyle = '#e9d2ac';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(138, 90, 54, 0.18)';
    for (let y = 18; y < h; y += 26) ctx.fillRect(0, y, w, 3);
    ctx.fillStyle = '#5a3d27';
    ctx.font = `600 74px ${DISPLAY_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, w / 2, h / 2 + 4, w - 60);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(30, h / 2, 10, 0, Math.PI * 2);
    ctx.arc(w - 30, h / 2, 10, 0, Math.PI * 2);
    ctx.fill();
  });
}

/** A little prop on each counter that hints at the project. */
function CounterProp({ project }: { project: Project }) {
  const spinning = useRef<Group>(null);
  useFrame((_, delta) => {
    if (spinning.current) spinning.current.rotation.y += delta * 2.2;
  });
  const t = project.title.toLowerCase();
  if (t.includes('hack')) {
    // Light bulb moment, plus sticky notes.
    return (
      <group>
        <mesh position={[0, 0.42, 0]}>
          <sphereGeometry args={[0.26, 18, 14]} />
          <meshBasicMaterial color="#fff2b0" toneMapped={false} />
        </mesh>
        <mesh position={[0, 0.12, 0]}>
          <cylinderGeometry args={[0.12, 0.14, 0.22, 14]} />
          <meshStandardMaterial color="#b9bcc3" metalness={0.5} roughness={0.3} />
        </mesh>
        {[
          [0.5, 0.03, 0.1, '#ffe27a'],
          [0.75, 0.03, -0.12, '#ff9ec3'],
          [0.55, 0.06, -0.2, '#9fe3b0']
        ].map(([x, y, z, c], i) => (
          <mesh key={i} position={[x as number, y as number, z as number]} rotation={[-Math.PI / 2, 0, i * 0.4]}>
            <planeGeometry args={[0.24, 0.24]} />
            <meshStandardMaterial color={c as string} roughness={0.8} />
          </mesh>
        ))}
      </group>
    );
  }
  if (t.includes('scribble')) {
    return (
      <group rotation={[0, 0.3, 0]}>
        <mesh position={[0, 0.03, 0]}>
          <boxGeometry args={[0.6, 0.06, 0.8]} />
          <meshStandardMaterial color="#fffdf6" roughness={0.8} />
        </mesh>
        {[-0.2, -0.05, 0.1, 0.25].map((z) => (
          <mesh key={z} position={[0, 0.062, z]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.5, 0.012]} />
            <meshBasicMaterial color="#9fc6e8" />
          </mesh>
        ))}
        <group position={[0.38, 0.06, 0]} rotation={[Math.PI / 2, 0, 0.5]}>
          <mesh>
            <cylinderGeometry args={[0.035, 0.035, 0.6, 6]} />
            <meshStandardMaterial color="#ffc25c" roughness={0.6} />
          </mesh>
          <mesh position={[0, -0.34, 0]} rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[0.035, 0.08, 6]} />
            <meshStandardMaterial color="#e9c9a0" roughness={0.6} />
          </mesh>
        </group>
      </group>
    );
  }
  if (t.includes('flow')) {
    // A turntable with a spinning record.
    return (
      <group>
        <mesh position={[0, 0.06, 0]}>
          <boxGeometry args={[0.9, 0.12, 0.7]} />
          <meshStandardMaterial color="#c99a68" roughness={0.6} />
        </mesh>
        <group ref={spinning} position={[-0.08, 0.135, 0]}>
          <mesh>
            <cylinderGeometry args={[0.3, 0.3, 0.02, 28]} />
            <meshStandardMaterial color="#1d1b22" roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.012, 0]}>
            <cylinderGeometry args={[0.1, 0.1, 0.01, 18]} />
            <meshStandardMaterial color="#c9a6ff" roughness={0.6} />
          </mesh>
        </group>
        <mesh position={[0.33, 0.17, -0.15]} rotation={[0, 0.5, Math.PI / 2]}>
          <cylinderGeometry args={[0.012, 0.012, 0.36, 6]} />
          <meshStandardMaterial color="#d9d4c9" metalness={0.6} roughness={0.3} />
        </mesh>
      </group>
    );
  }
  if (t.includes('food')) {
    // A noodle bowl with chopsticks.
    return (
      <group>
        <mesh position={[0, 0.16, 0]}>
          <sphereGeometry args={[0.32, 18, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
          <meshStandardMaterial color="#ff8a7a" roughness={0.5} side={2} />
        </mesh>
        <mesh position={[0, 0.15, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.29, 18]} />
          <meshStandardMaterial color="#f3d38a" roughness={0.7} />
        </mesh>
        <mesh position={[0.08, 0.165, 0.05]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.09, 14]} />
          <meshStandardMaterial color="#fffaee" roughness={0.6} />
        </mesh>
        {[-0.03, 0.03].map((dx) => (
          <mesh key={dx} position={[0.05 + dx, 0.32, -0.02]} rotation={[0.3, 0, -0.5]}>
            <cylinderGeometry args={[0.012, 0.016, 0.62, 5]} />
            <meshStandardMaterial color="#c99a68" roughness={0.6} />
          </mesh>
        ))}
      </group>
    );
  }
  if (t.includes('gpu')) {
    // A graphics card with spinning fans.
    return (
      <group rotation={[0, -0.2, 0]}>
        <mesh position={[0, 0.1, 0]}>
          <boxGeometry args={[1.0, 0.18, 0.45]} />
          <meshStandardMaterial color="#2d3a33" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.2, 0]}>
          <boxGeometry args={[0.98, 0.03, 0.43]} />
          <meshStandardMaterial color="#4c4f58" metalness={0.5} roughness={0.35} />
        </mesh>
        {[-0.24, 0.24].map((fx) => (
          <group key={fx} position={[fx, 0.225, 0]} ref={fx < 0 ? spinning : undefined}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.18, 18]} />
              <meshStandardMaterial color="#1d1b22" roughness={0.6} />
            </mesh>
            {[0, 1, 2, 3, 4].map((b) => (
              <mesh key={b} position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, (b * Math.PI * 2) / 5]}>
                <planeGeometry args={[0.04, 0.32]} />
                <meshStandardMaterial color="#79c37d" roughness={0.6} />
              </mesh>
            ))}
          </group>
        ))}
        <mesh position={[-0.52, 0.12, 0]}>
          <boxGeometry args={[0.04, 0.3, 0.45]} />
          <meshStandardMaterial color="#c5ccd2" metalness={0.6} roughness={0.3} />
        </mesh>
      </group>
    );
  }
  if (t.includes('prem') || t.includes('fantasy')) {
    // A little trophy and a ball.
    return (
      <group>
        <mesh position={[0, 0.05, 0]}>
          <boxGeometry args={[0.3, 0.1, 0.3]} />
          <meshStandardMaterial color="#5a3d27" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.2, 0]}>
          <cylinderGeometry args={[0.04, 0.07, 0.2, 10]} />
          <meshStandardMaterial color="#f2c14e" metalness={0.7} roughness={0.25} />
        </mesh>
        <mesh position={[0, 0.42, 0]}>
          <cylinderGeometry args={[0.18, 0.08, 0.26, 16]} />
          <meshStandardMaterial color="#f2c14e" metalness={0.7} roughness={0.25} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * 0.19, 0.44, 0]} rotation={[0, 0, Math.PI / 2]}>
            <torusGeometry args={[0.07, 0.018, 6, 12]} />
            <meshStandardMaterial color="#f2c14e" metalness={0.7} roughness={0.25} />
          </mesh>
        ))}
        <mesh position={[0.5, 0.14, 0.05]}>
          <icosahedronGeometry args={[0.14, 1]} />
          <meshStandardMaterial color="#fffaee" roughness={0.5} flatShading />
        </mesh>
      </group>
    );
  }
  // Anything else gets a small potted plant.
  return (
    <group>
      <mesh position={[0, 0.12, 0]}>
        <cylinderGeometry args={[0.16, 0.13, 0.24, 12]} />
        <meshStandardMaterial color="#e9dccb" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.36, 0]}>
        <icosahedronGeometry args={[0.2, 1]} />
        <meshStandardMaterial color="#5d8d3b" roughness={0.8} flatShading />
      </mesh>
    </group>
  );
}

function Stall({ project, index }: { project: Project; index: number }) {
  const color = STALL_COLORS[index % STALL_COLORS.length];
  const id = `stall-${index}`;
  const image = useRef<HTMLImageElement | null>(null);
  const draw = (ctx: CanvasRenderingContext2D, w: number, h: number) =>
    drawStallBoard(ctx, w, h, project, index, projects.length, image.current, color, world.get().station === id);
  const board = useScreen(1024, 632, draw, () => `${world.get().station === id}|${!!image.current}`);
  // Screenshots wait until the visitor has kicked off, then load as small WebP copies.
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      if (!world.get().started || image.current) return;
      const small = project.src.replace(/^(\.?)\/projectpics\/(.+)\.\w+$/, '$1/world/projects/$2.webp');
      loadImage(small)
        .catch(() => loadImage(project.src))
        .then((img) => {
          if (cancelled) return;
          image.current = img;
          board.redraw(draw);
        })
        .catch(() => {});
    };
    load();
    const unsubscribe = world.subscribe(load);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);
  const geometry = useMemo(() => stallGeometry(color), [color]);
  const sign = useMemo(() => signTexture(project.title, color), [project.title, color]);
  const material = useMemo(() => new MeshLambertMaterial({ vertexColors: true }), []);

  return (
    <group position={[stallX(index), 0, FAIR.z]}>
      <mesh geometry={geometry.frame} material={material} castShadow receiveShadow />
      <mesh geometry={geometry.awning} material={material} castShadow />
      <mesh position={[0, BOARD_Y, BOARD_Z]}>
        <planeGeometry args={[3.4, 2.1]} />
        <meshBasicMaterial map={board} toneMapped={false} />
      </mesh>
      {/* Hanging name sign */}
      <mesh position={[0, 3.72, D / 2 + 0.44]}>
        <planeGeometry args={[2.3, 0.5]} />
        <meshLambertMaterial map={sign} />
      </mesh>
      <group position={[index % 2 ? 1.25 : -1.25, 1.14, 1.0]} userData={{ dynamic: true }}>
        <CounterProp project={project} />
      </group>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[W / 2, 1.8, D / 2 + 0.1]} position={[0, 1.8, 0]} />
        {[-1.05, 1.05].map((sx) => (
          <CylinderCollider key={sx} args={[0.36, 0.3]} position={[sx, 0.36, 2.5]} />
        ))}
      </RigidBody>
    </group>
  );
}

/** Warm string lights swagged along the front of the stalls, from post to post. */
function StringLights() {
  const { wires, bulbs } = useMemo(() => {
    const anchors: Vector3[] = [];
    for (let i = 0; i < projects.length; i++) {
      for (const side of [-1, 1]) anchors.push(new Vector3(stallX(i) + side * (W / 2 - 0.1), 3.7, FAIR.z + D / 2 - 0.2));
    }
    const wires: TubeGeometry[] = [];
    const bulbs: Vector3[] = [];
    for (let i = 1; i < anchors.length; i++) {
      const a = anchors[i - 1];
      const b = anchors[i];
      const mid = a.clone().lerp(b, 0.5);
      // Deeper swag across the gaps between stalls than along an awning.
      mid.y -= b.x - a.x > W ? 0.75 : 0.35;
      mid.z += 0.35;
      const curve = new QuadraticBezierCurve3(a, mid, b);
      wires.push(new TubeGeometry(curve, 16, 0.015, 4, false));
      for (let k = 1; k < 6; k++) bulbs.push(curve.getPoint(k / 6).add(new Vector3(0, -0.12, 0)));
    }
    return { wires, bulbs, anchors };
  }, []);
  const bulbRef = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = bulbRef.current;
    if (!mesh) return;
    const o = new Object3D();
    const c = new Color();
    const tints = ['#ffe3a3', '#ffc2a8', '#fff2c8', '#ffd0e0'];
    bulbs.forEach((b, i) => {
      o.position.copy(b);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
      mesh.setColorAt(i, c.set(tints[i % tints.length]));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [bulbs]);
  const bulbGeometry = useMemo(() => new SphereGeometry(0.09, 8, 6), []);
  const bulbMaterial = useMemo(() => new MeshBasicMaterial({ toneMapped: false }), []);
  return (
    <>
      {wires.map((g, i) => (
        <mesh key={i} geometry={g}>
          <meshBasicMaterial color="#6b5a4c" />
        </mesh>
      ))}
      <instancedMesh ref={bulbRef} args={[bulbGeometry, bulbMaterial, bulbs.length]} />
    </>
  );
}

/** The project fair: a stall per project along a lit-up street. */
export function Fair() {
  return (
    <>
      {projects.map((p, i) => (
        <Stall key={p.title} project={p} index={i} />
      ))}
      <StringLights />
    </>
  );
}
