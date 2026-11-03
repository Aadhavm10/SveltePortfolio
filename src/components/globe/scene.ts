// Three.js scene for the travel globe: renderer, camera, controls, picking, fly-to and post-processing.
import {
  Clock,
  Color,
  HalfFloatType,
  NoToneMapping,
  PerspectiveCamera,
  Quaternion,
  Raycaster,
  Scene,
  SRGBColorSpace,
  TextureLoader,
  Vector2,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget,
  type Intersection,
  type Object3D,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { gsap } from 'gsap';
import { latLngToVector3, vector3ToLatLng, type World } from '../../lib/geo';
import { HOME, type Manifest } from '../../data/travel';
import { createGlobeBody } from './globeBody';
import { createVisitedLayer, type VisitedLayer } from './countries';
import { createStars } from './stars';
import { createStarredLayer, type StarredLayer } from './starred';

export interface GlobeSceneOptions {
  canvas: HTMLCanvasElement;
  container: HTMLElement;
  world: World;
  manifest: Manifest;
  reducedMotion: boolean;
  topologyUrl: string;
  onHover: (target: HoverTarget | null, x: number, y: number) => void;
  onSelect: (id: string | null) => void;
  onProgress?: (fraction: number) => void;
}

/** What's under the pointer: a visited country/state, or a starred place. */
export type HoverTarget =
  | { kind: 'region'; id: string }
  | { kind: 'star'; index: number; name: string; note?: string; regionId: string | null };

export interface GlobeScene {
  setManifest(m: Manifest): void;
  select(id: string | null, panel?: { side: 'right' | 'bottom'; size: number }): void;
  intro(): void;
  dispose(): void;
}

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

export async function createGlobeScene(o: GlobeSceneOptions): Promise<GlobeScene> {
  const { canvas, container, world } = o;
  const isMobile = matchMedia('(max-width: 768px)').matches || matchMedia('(pointer: coarse)').matches;
  const pixelRatio = Math.min(window.devicePixelRatio || 1, isMobile ? 1.6 : 2);

  // Throws if WebGL is unavailable; the caller shows a fallback.
  const renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(pixelRatio);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NoToneMapping;
  renderer.setClearColor('#030408', 1);

  const scene = new Scene();
  // Use scene.background rather than only the clear colour: with the composer, the clear colour can be
  // applied with the screen's colour conversion and come out grey.
  scene.background = new Color('#030408');
  const camera = new PerspectiveCamera(35, 1, 0.05, 200);

  // --- Build world (yielding between steps so the loader can animate) ---
  const body = createGlobeBody(world, { maskWidth: isMobile ? 2048 : 4096 });
  scene.add(body.group);
  o.onProgress?.(0.4);
  await nextFrame();

  const stars = createStars(isMobile ? 1800 : 3200, pixelRatio);
  scene.add(stars.points);

  let layer: VisitedLayer = createVisitedLayer(world, o.manifest, pixelRatio);
  scene.add(layer.group);
  let starred: StarredLayer = createStarredLayer(world, o.manifest.starred ?? [], pixelRatio);
  scene.add(starred.group);
  o.onProgress?.(0.75);
  await nextFrame();

  await new Promise<void>((resolve) => {
    new TextureLoader().load(
      o.topologyUrl,
      (tex) => {
        body.setTopology(tex);
        resolve();
      },
      undefined,
      () => resolve() // terrain is optional decoration
    );
  });
  o.onProgress?.(1);

  // --- Post-processing ---
  const target = new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  // Small radius keeps the glow tight: wide bloom mips get amplified by the sRGB output and grey out the sky.
  const bloom = new UnrealBloomPass(new Vector2(1, 1), 0.55, 0.12, 0.62);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // --- Camera + controls ---
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.enablePan = false;
  controls.zoomSpeed = 0.7;
  controls.minDistance = 1.3;
  controls.autoRotate = !o.reducedMotion;
  controls.autoRotateSpeed = -0.45;

  let width = 1;
  let height = 1;
  let defaultDistance = 4;
  const shift = { x: 0, y: 0 }; // view offset in px (globe moves opposite way)
  let baseShiftY = 0;
  let selected: string | null = null;
  let tweening = false;
  let resumeTimer: number | undefined;

  function fitDistance(aspect: number) {
    const halfH = Math.tan((camera.fov * Math.PI) / 360);
    return (1.22 / (halfH * Math.min(1, aspect))) * 1.04;
  }

  function applyShift() {
    if (shift.x === 0 && shift.y === 0) camera.clearViewOffset();
    else camera.setViewOffset(width, height, shift.x, shift.y, width, height);
  }

  function resize() {
    const rect = container.getBoundingClientRect();
    width = Math.max(1, Math.round(rect.width));
    height = Math.max(1, Math.round(rect.height));
    renderer.setSize(width, height, false);
    composer.setSize(width, height);
    bloom.setSize(width * pixelRatio, height * pixelRatio);
    camera.aspect = width / height;
    const prevDefault = defaultDistance;
    defaultDistance = fitDistance(camera.aspect);
    controls.maxDistance = defaultDistance * 1.7;
    // Portrait phones: nudge the globe up so the hero text has room underneath.
    baseShiftY = width < 700 && height > width ? Math.round(height * 0.1) : 0;
    if (!selected) shift.y = baseShiftY;
    // Keep the same framing if the user hasn't zoomed.
    const d = camera.position.length();
    if (Math.abs(d - prevDefault) < 0.05) camera.position.setLength(defaultDistance);
    camera.updateProjectionMatrix();
    applyShift();
  }

  // Start looking at the Americas.
  camera.position.set(...latLngToVector3(22, HOME.lng, 1)).setLength(4);
  resize();
  camera.position.setLength(defaultDistance);
  camera.lookAt(0, 0, 0);
  controls.update();

  const ro = new ResizeObserver(resize);
  ro.observe(container);

  // --- Auto-rotate pause/resume ---
  const scheduleResume = () => {
    window.clearTimeout(resumeTimer);
    if (o.reducedMotion) return;
    resumeTimer = window.setTimeout(() => {
      if (!selected) controls.autoRotate = true;
    }, 5000);
  };
  controls.addEventListener('start', () => {
    controls.autoRotate = false;
    window.clearTimeout(resumeTimer);
  });
  controls.addEventListener('end', scheduleResume);
  controls.addEventListener('change', () => {
    // Slower rotation when zoomed in.
    const d = camera.position.length();
    controls.rotateSpeed = Math.min(1, Math.max(0.15, (d - 1) / (defaultDistance - 1))) * 0.6;
  });

  // --- Camera flights ---
  const flight = { t: 0 };
  function flyTo(lat: number, lng: number, distance: number, duration: number, onDone?: () => void) {
    gsap.killTweensOf(flight);
    const from = camera.position.clone();
    const a = from.clone().normalize();
    const b = new Vector3(...latLngToVector3(lat, lng, 1));
    const q = new Quaternion().setFromUnitVectors(a, b);
    const idq = new Quaternion();
    const tmp = new Quaternion();
    const d0 = from.length();
    const angle = a.angleTo(b);
    tweening = true;
    controls.enabled = false;
    controls.autoRotate = false;
    flight.t = 0;
    gsap.to(flight, {
      t: 1,
      duration: o.reducedMotion ? 0 : duration,
      ease: 'power3.inOut',
      onUpdate() {
        const t = flight.t;
        tmp.slerpQuaternions(idq, q, t);
        const dir = a.clone().applyQuaternion(tmp);
        const d = d0 + (distance - d0) * t + Math.sin(Math.PI * t) * angle * 0.35;
        camera.position.copy(dir.multiplyScalar(d));
        camera.lookAt(0, 0, 0);
      },
      onComplete() {
        tweening = false;
        controls.enabled = true;
        controls.update();
        onDone?.();
      },
    });
  }

  function tweenShift(x: number, y: number) {
    gsap.to(shift, {
      x,
      y,
      duration: o.reducedMotion ? 0 : 0.9,
      ease: 'power3.inOut',
      onUpdate: applyShift,
    });
  }

  // --- Picking ---
  const raycaster = new Raycaster();
  const ndc = new Vector2();
  function pick(clientX: number, clientY: number): { hit: boolean; id: string | null; star: HoverTarget | null } {
    const rect = canvas.getBoundingClientRect();
    // Stars sit on top of everything, so they win.
    const s = starred.pick(clientX, clientY, rect, camera);
    if (s) return { hit: true, id: null, star: { kind: 'star', index: s.index, name: s.place.name, note: s.place.note, regionId: s.regionId } };
    ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const targets: Object3D[] = [body.globe, ...layer.pickables];
    const hits: Intersection[] = raycaster.intersectObjects(targets, false);
    if (!hits.length) return { hit: false, id: null, star: null };
    const id = (hits[0].object.userData.countryId as string | undefined) ?? null;
    return { hit: true, id, star: null };
  }

  let hoverId: string | null = null;
  let hoverStar: number | null = null;
  let pendingMove: PointerEvent | null = null;
  let down: { x: number; y: number; t: number } | null = null;

  const onPointerMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    pendingMove = e;
  };
  const onPointerDown = (e: PointerEvent) => {
    down = { x: e.clientX, y: e.clientY, t: performance.now() };
  };
  const onPointerUp = (e: PointerEvent) => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    const quick = performance.now() - down.t < 600;
    down = null;
    if (moved > 6 || !quick) return;
    const { id, star } = pick(e.clientX, e.clientY);
    // A star opens the country/state it's in (if you have photos there).
    o.onSelect(star && star.kind === 'star' ? star.regionId : id);
  };
  const onPointerLeave = () => {
    pendingMove = null;
    if (hoverId || hoverStar !== null) {
      hoverId = null;
      hoverStar = null;
      layer.setHover(null);
      starred.setHover(null);
      canvas.style.cursor = '';
      o.onHover(null, 0, 0);
    }
  };
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointerleave', onPointerLeave);
  // Mobile browsers can drop the WebGL context in the background; preventDefault lets it be restored.
  const onContextLost = (e: Event) => e.preventDefault();
  canvas.addEventListener('webglcontextlost', onContextLost);

  function processHover() {
    const e = pendingMove;
    pendingMove = null;
    if (!e || e.buttons) return;
    const { id, star } = pick(e.clientX, e.clientY);
    const starIndex = star && star.kind === 'star' ? star.index : null;
    if (id !== hoverId || starIndex !== hoverStar) {
      hoverId = id;
      hoverStar = starIndex;
      layer.setHover(id);
      starred.setHover(starIndex);
      canvas.style.cursor = id || starIndex !== null ? 'pointer' : '';
    }
    o.onHover(star ?? (id ? { kind: 'region', id } : null), e.clientX, e.clientY);
  }

  // --- Render loop (paused when hidden / off-screen) ---
  const clock = new Clock();
  let time = 0;
  let raf = 0;
  let onScreen = true;
  const frame = () => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.1);
    time += dt;
    processHover();
    if (!tweening) controls.update();
    body.update(camera);
    stars.update(time);
    layer.update(time, dt, o.reducedMotion);
    starred.update(time, camera, defaultDistance, o.reducedMotion);
    composer.render();
  };
  const start = () => {
    if (!raf && onScreen && !document.hidden) {
      clock.getDelta();
      raf = requestAnimationFrame(frame);
    }
  };
  const stop = () => {
    cancelAnimationFrame(raf);
    raf = 0;
  };
  const io = new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    if (onScreen) start();
    else stop();
  });
  io.observe(canvas);
  const onVisibility = () => (document.hidden ? stop() : start());
  document.addEventListener('visibilitychange', onVisibility);
  start();

  return {
    setManifest(m: Manifest) {
      layer.dispose();
      layer = createVisitedLayer(world, m, pixelRatio);
      scene.add(layer.group);
      starred.dispose();
      starred = createStarredLayer(world, m.starred ?? [], pixelRatio);
      hoverStar = null;
      scene.add(starred.group);
      layer.setSelected(selected);
    },

    select(id, panel) {
      selected = id;
      layer.setSelected(id);
      window.clearTimeout(resumeTimer);
      if (id) {
        const f = layer.focus(id);
        if (f) {
          const dist = Math.min(defaultDistance * 0.8, Math.max(1.75, 1.6 + f.size * 2.6));
          flyTo(f.lat, f.lng, dist, 1.6);
        }
        if (panel?.side === 'right') tweenShift(Math.round(panel.size / 2), 0);
        else if (panel?.side === 'bottom') tweenShift(0, Math.round(panel.size / 2));
      } else {
        // Back out to the default view, keeping the current longitude.
        const { lng } = vector3ToLatLng(camera.position.x, camera.position.y, camera.position.z);
        flyTo(18, lng, defaultDistance, 1.3, scheduleResume);
        tweenShift(0, baseShiftY);
      }
    },

    intro() {
      const end = camera.position.clone();
      const { lat, lng } = vector3ToLatLng(end.x, end.y, end.z);
      camera.position.set(...latLngToVector3(lat - 10, lng - 70, defaultDistance * 2.4));
      camera.lookAt(0, 0, 0);
      flyTo(lat, lng, defaultDistance, o.reducedMotion ? 0 : 2.2, scheduleResume);
    },

    dispose() {
      stop();
      gsap.killTweensOf(flight);
      gsap.killTweensOf(shift);
      window.clearTimeout(resumeTimer);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      controls.dispose();
      layer.dispose();
      starred.dispose();
      body.dispose();
      stars.dispose();
      bloom.dispose();
      composer.dispose();
      target.dispose();
      renderer.dispose();
    },
  };
}
