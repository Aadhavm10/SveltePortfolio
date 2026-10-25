import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier';
import { ExtrudeGeometry, MathUtils, Mesh, MeshBasicMaterial, MeshStandardMaterial, Shape, SphereGeometry, SRGBColorSpace, Texture, TextureLoader, Vector3 } from 'three';
import { roomHotspots, roomPanorama } from '../../../data/portfolio';
import { PROPS } from '../layout';
import { useWorld, world } from '../store';
import { canvasTexture, DISPLAY_FONT, FONT } from '../textures';

/** The panorama sphere lives far below the park; the camera jumps inside it. */
export const ROOM_ORIGIN = new Vector3(0, -90, 0);
const ROOM_RADIUS = 8;

/** Where you're looking inside the room; drag or use the arrow keys. */
export const roomView = { yaw: Math.PI * 0.5, pitch: 0, targetYaw: Math.PI * 0.5, targetPitch: 0 };

/** Direction for a spot in the panorama (u across 0..1, pitch in degrees), matching the sphere below. */
export function roomDirection(u: number, pitchDeg: number) {
  const phi = u * Math.PI * 2;
  const p = MathUtils.degToRad(pitchDeg);
  return new Vector3(Math.cos(phi) * Math.cos(p), Math.sin(p), Math.sin(phi) * Math.cos(p));
}

export function turnRoom(dYaw: number, dPitch: number) {
  roomView.targetYaw += dYaw;
  roomView.targetPitch = MathUtils.clamp(roomView.targetPitch + dPitch, -1.1, 1.1);
}

/** A drawn stand-in room: a box room projected properly onto an equirectangular canvas. */
function placeholderRoom() {
  return canvasTexture(4096, 2048, (ctx, W, H) => {
    const latY = (lat: number) => (0.5 - lat / Math.PI) * H;
    const eyeToFloor = 0.55;
    const eyeToCeiling = 0.5;
    const walls = ['#f6dcc4', '#f3d2bd', '#f6dcc4', '#efcdb6'];
    for (let x = 0; x < W; x++) {
      const phi = (x / W) * Math.PI * 2;
      const c = Math.cos(phi);
      const s = Math.sin(phi);
      const d = 1 / Math.max(Math.abs(c), Math.abs(s));
      const floorY = latY(-Math.atan(eyeToFloor / d));
      const ceilY = latY(Math.atan(eyeToCeiling / d));
      const wall = Math.abs(c) >= Math.abs(s) ? (c > 0 ? 0 : 2) : s > 0 ? 1 : 3;
      ctx.fillStyle = '#fffaf2';
      ctx.fillRect(x, 0, 1, ceilY);
      ctx.fillStyle = walls[wall];
      ctx.fillRect(x, ceilY, 1, floorY - ceilY);
      ctx.fillStyle = '#c99a68';
      ctx.fillRect(x, floorY, 1, H - floorY);
      // Skirting board
      ctx.fillStyle = '#fffaf2';
      ctx.fillRect(x, floorY - 14, 1, 14);
      // Corners
      if (Math.abs(Math.abs(c) - Math.abs(s)) < 0.004) {
        ctx.fillStyle = 'rgba(120, 80, 60, 0.25)';
        ctx.fillRect(x, ceilY, 2, floorY - ceilY);
      }
    }
    // Round rug under your feet and a lamp overhead.
    ctx.fillStyle = '#ff9ec3';
    ctx.fillRect(0, H * 0.86, W, H * 0.14);
    ctx.fillStyle = '#ffd1e0';
    ctx.fillRect(0, H * 0.9, W, H * 0.03);
    ctx.fillStyle = '#ffe3a3';
    ctx.fillRect(0, 0, W, H * 0.05);

    const u = (v: number) => v * W;
    const rect = (cu: number, top: number, w: number, h: number, color: string, r = 12) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(u(cu) - w / 2, latY(MathUtils.degToRad(top)), w, h, r);
      ctx.fill();
    };
    const label = (cu: number, lat: number, text: string, color = '#4a3b2c', size = 40) => {
      ctx.fillStyle = color;
      ctx.font = `600 ${size}px ${DISPLAY_FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(text, u(cu), latY(MathUtils.degToRad(lat)));
    };

    // Film wall: three posters.
    ['#7cc8e4', '#ff8a7a', '#c9a6ff'].forEach((c, i) => {
      rect(0.21 + i * 0.04, 26, 130, 190, '#fffaee', 6);
      rect(0.21 + i * 0.04, 24.5, 110, 170, c, 4);
    });
    label(0.25, -2, 'FILMS', '#8a5a36', 34);
    // Window with a sunset and curtains.
    rect(0.5, 24, 380, 300, '#fffaee', 14);
    const sky = ctx.createLinearGradient(0, latY(MathUtils.degToRad(22)), 0, latY(MathUtils.degToRad(0)));
    sky.addColorStop(0, '#7486c9');
    sky.addColorStop(1, '#ffc28f');
    ctx.fillStyle = sky;
    ctx.fillRect(u(0.5) - 170, latY(MathUtils.degToRad(22)), 340, 260);
    ctx.fillStyle = '#ff9e8c';
    ctx.fillRect(u(0.5) - 230, latY(MathUtils.degToRad(27)), 70, 380);
    ctx.fillRect(u(0.5) + 160, latY(MathUtils.degToRad(27)), 70, 380);
    // Placeholder note under the window.
    rect(0.5, -6, 620, 120, '#fffaee', 18);
    label(0.5, -10.5, 'Placeholder room', '#4a3b2c', 44);
    ctx.font = `700 26px ${FONT}`;
    ctx.fillStyle = '#8a7a68';
    ctx.fillText('Send a 360 photo of yours to swap it in', u(0.5), latY(MathUtils.degToRad(-15.5)));
    // Desk with a monitor and a record player, shelf of games above.
    rect(0.72, -8, 560, 24, '#a8774c', 6);
    rect(0.72, -9.5, 24, 200, '#8a5a36', 4);
    rect(0.75, 6, 220, 140, '#1d1b22', 10);
    rect(0.75, 4.5, 196, 112, '#7cc8e4', 6);
    rect(0.68, -3, 150, 70, '#c99a68', 8);
    ctx.fillStyle = '#1d1b22';
    ctx.beginPath();
    ctx.ellipse(u(0.68), latY(MathUtils.degToRad(-4)), 52, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    rect(0.8, 22, 420, 18, '#a8774c', 4);
    ['#ff8a7a', '#ffc25c', '#79c37d', '#7cc8e4', '#c9a6ff', '#ff9ec3', '#fffaee'].forEach((c, i) => rect(0.77 + i * 0.009, 29, 30, 90, c, 3));
    // Bed with a jersey framed above it (this wall wraps across the seam).
    for (const at of [0, 1]) {
      rect(at, -12, 900, 160, '#fffaee', 30);
      rect(at, -14, 860, 120, '#9fd8ff', 24);
      rect(at - 0.04, -13, 160, 60, '#ffffff', 20);
      rect(at, 30, 200, 220, '#a8774c', 8);
      rect(at, 28.5, 170, 190, '#fffaee', 6);
      ctx.fillStyle = '#ff6b5b';
      ctx.beginPath();
      ctx.moveTo(u(at) - 60, latY(MathUtils.degToRad(26)));
      ctx.lineTo(u(at) + 60, latY(MathUtils.degToRad(26)));
      ctx.lineTo(u(at) + 50, latY(MathUtils.degToRad(17)));
      ctx.lineTo(u(at) - 50, latY(MathUtils.degToRad(17)));
      ctx.closePath();
      ctx.fill();
    }
  });
}

/** The inside of the room: an inward-facing sphere wrapped in the panorama, with labelled hotspots. */
export function RoomViewer() {
  const open = useRef(false);
  const sphere = useRef<Mesh>(null);
  const geometry = useMemo(() => new SphereGeometry(ROOM_RADIUS, 64, 40).scale(-1, 1, 1), []);
  // The panorama is big, so it's only loaded (or drawn) the first time someone walks in.
  const material = useMemo(() => new MeshBasicMaterial({ fog: false, toneMapped: false }), []);
  const loadTexture = () => {
    let texture: Texture;
    if (roomPanorama) {
      texture = new TextureLoader().load(roomPanorama);
      texture.colorSpace = SRGBColorSpace;
    } else texture = placeholderRoom();
    material.map = texture;
    material.needsUpdate = true;
  };
  const gl = useThree((s) => s.gl);

  // Drag to look around.
  useEffect(() => {
    const canvas = gl.domElement;
    let last: { x: number; y: number } | null = null;
    const down = (e: PointerEvent) => {
      if (world.get().station === 'room') last = { x: e.clientX, y: e.clientY };
    };
    const move = (e: PointerEvent) => {
      if (!last) return;
      turnRoom(-(e.clientX - last.x) * 0.005, (e.clientY - last.y) * 0.004);
      last = { x: e.clientX, y: e.clientY };
    };
    const up = () => {
      last = null;
    };
    canvas.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      canvas.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [gl]);

  useFrame((_, delta) => {
    open.current = world.get().station === 'room';
    if (open.current && !material.map) loadTexture();
    if (sphere.current) sphere.current.visible = open.current;
    roomView.yaw = MathUtils.damp(roomView.yaw, roomView.targetYaw, 8, delta);
    roomView.pitch = MathUtils.damp(roomView.pitch, roomView.targetPitch, 8, delta);
  });

  return (
    <group position={ROOM_ORIGIN}>
      <mesh ref={sphere} geometry={geometry} material={material} visible={false} frustumCulled={false} />
      <RoomHotspots />
    </group>
  );
}

function RoomHotspots() {
  const visible = useWorld((s) => s.station === 'room');
  return (
    <>
      {roomHotspots.map((h, i) => {
        const at = roomDirection(h.u, h.pitch).multiplyScalar(ROOM_RADIUS * 0.8);
        return (
          <Html key={i} position={at} center zIndexRange={[30, 10]} style={{ display: visible ? 'block' : 'none' }}>
            <details className="world-hotspot">
              <summary>
                <span className="world-hotspot-dot" aria-hidden="true" />
                {h.title}
              </summary>
              <p>{h.note}</p>
              {h.href && (
                <a href={h.href} target="_blank" rel="noopener noreferrer">
                  Open
                </a>
              )}
            </details>
          </Html>
        );
      })}
    </>
  );
}

/** A cosy cottage with a round-topped door; walk up to it to see inside the room. */
export function Cottage() {
  const smoke = useRef<Mesh[]>([]);
  const smokeMaterials = useMemo(() => [0, 1, 2, 3].map(() => new MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.5, depthWrite: false })), []);
  const roof = useMemo(() => {
    const shape = new Shape();
    shape.moveTo(-3.2, 0);
    shape.lineTo(3.2, 0);
    shape.lineTo(0, 2.3);
    shape.closePath();
    const g = new ExtrudeGeometry(shape, { depth: 5, bevelEnabled: false });
    g.translate(0, 0, -2.5);
    return g;
  }, []);
  const door = useMemo(() => {
    const shape = new Shape();
    shape.moveTo(-0.6, 0);
    shape.lineTo(0.6, 0);
    shape.lineTo(0.6, 1.5);
    shape.absarc(0, 1.5, 0.6, 0, Math.PI, false);
    shape.closePath();
    return new ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: false });
  }, []);
  const plaque = useMemo(
    () =>
      canvasTexture(256, 96, (ctx, w, h) => {
        ctx.fillStyle = '#fffaee';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#5a3d27';
        ctx.font = `600 46px ${DISPLAY_FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('My room', w / 2, h / 2 + 3);
      }),
    []
  );

  useFrame((state) => {
    smoke.current.forEach((m, i) => {
      if (!m) return;
      const k = (state.clock.elapsedTime * 0.18 + i / 4) % 1;
      m.position.set(Math.sin(k * 5 + i) * 0.3 + k * 0.6, k * 2.6, 0);
      m.scale.setScalar(0.25 + k * 0.5);
      (m.material as MeshStandardMaterial).opacity = (1 - k) * 0.55;
    });
  });

  const { x, z } = PROPS.cottage;
  const wall = '#fbefd9';
  return (
    <group position={[x, 0, z]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[2.8, 2.2, 2.2]} position={[0, 2.2, 0]} />
        <CylinderCollider args={[0.6, 0.15]} position={[3.6, 0.6, 3.4]} />
      </RigidBody>
      {/* Walls and a stone base */}
      <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
        <boxGeometry args={[5.8, 0.4, 4.6]} />
        <meshStandardMaterial color="#b4ac9d" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.9, 0]} castShadow receiveShadow>
        <boxGeometry args={[5.4, 3.0, 4.2]} />
        <meshStandardMaterial color={wall} roughness={0.85} />
      </mesh>
      {/* Timber trim at the corners */}
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[sx * 2.68, 1.9, sz * 2.08]} castShadow>
            <boxGeometry args={[0.16, 3.0, 0.16]} />
            <meshStandardMaterial color="#8a5a36" roughness={0.8} />
          </mesh>
        ))
      )}
      {/* Roof */}
      <mesh geometry={roof} position={[0, 3.4, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#d9644a" roughness={0.7} flatShading />
      </mesh>
      {/* Chimney with smoke */}
      <group position={[1.6, 4.4, -0.8]}>
        <mesh castShadow>
          <boxGeometry args={[0.6, 1.6, 0.6]} />
          <meshStandardMaterial color="#b4ac9d" roughness={0.9} />
        </mesh>
        <group position={[0, 0.9, 0]} userData={{ dynamic: true }}>
          {smokeMaterials.map((m, i) => (
            <mesh key={i} ref={(el) => void (smoke.current[i] = el!)} material={m}>
              <sphereGeometry args={[1, 10, 8]} />
            </mesh>
          ))}
        </group>
      </group>
      {/* Door, knob, step and mat */}
      <mesh geometry={door} position={[0, 0.4, 2.1]} castShadow>
        <meshStandardMaterial color="#a8774c" roughness={0.6} />
      </mesh>
      <mesh position={[0.4, 1.3, 2.2]}>
        <sphereGeometry args={[0.07, 10, 8]} />
        <meshStandardMaterial color="#d9a441" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.05, 2.75]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[1.5, 0.8]} />
        <meshStandardMaterial color="#d9644a" roughness={0.9} />
      </mesh>
      <mesh position={[0, 2.75, 2.12]}>
        <planeGeometry args={[1.1, 0.4]} />
        <meshStandardMaterial map={plaque} roughness={0.7} />
      </mesh>
      {/* Two glowing windows with flower boxes */}
      {[-1.75, 1.75].map((wx) => (
        <group key={wx} position={[wx, 2.0, 2.11]}>
          <mesh>
            <boxGeometry args={[1.1, 1.0, 0.06]} />
            <meshStandardMaterial color="#fffaee" roughness={0.6} />
          </mesh>
          <mesh position={[0, 0, 0.035]}>
            <planeGeometry args={[0.9, 0.8]} />
            <meshBasicMaterial color="#ffe3a3" toneMapped={false} />
          </mesh>
          <mesh position={[0, 0, 0.04]}>
            <boxGeometry args={[0.06, 0.8, 0.02]} />
            <meshStandardMaterial color="#fffaee" />
          </mesh>
          <mesh position={[0, 0, 0.04]}>
            <boxGeometry args={[0.9, 0.06, 0.02]} />
            <meshStandardMaterial color="#fffaee" />
          </mesh>
          <mesh position={[0, -0.62, 0.15]} castShadow>
            <boxGeometry args={[1.2, 0.24, 0.3]} />
            <meshStandardMaterial color="#8a5a36" roughness={0.8} />
          </mesh>
          {[-0.4, -0.15, 0.1, 0.35].map((fx, i) => (
            <mesh key={fx} position={[fx, -0.42, 0.16]}>
              <icosahedronGeometry args={[0.1, 0]} />
              <meshStandardMaterial color={['#ff8a7a', '#ffe27a', '#ff9ec3', '#fffaee'][i]} flatShading />
            </mesh>
          ))}
        </group>
      ))}
      {/* Mailbox by the path */}
      <group position={[3.6, 0, 3.4]}>
        <mesh position={[0, 0.6, 0]} castShadow>
          <boxGeometry args={[0.12, 1.2, 0.12]} />
          <meshStandardMaterial color="#8a5a36" />
        </mesh>
        <mesh position={[0, 1.32, 0]} castShadow>
          <boxGeometry args={[0.4, 0.34, 0.6]} />
          <meshStandardMaterial color="#7cc8e4" roughness={0.5} />
        </mesh>
        <mesh position={[0.22, 1.42, 0.1]} rotation={[0, 0, -0.3]}>
          <boxGeometry args={[0.03, 0.26, 0.06]} />
          <meshStandardMaterial color="#ff6b5b" />
        </mesh>
      </group>
    </group>
  );
}
