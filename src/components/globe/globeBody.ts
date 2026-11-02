// The dark globe itself: land/ocean sphere, glowing borders, graticule and atmosphere.
import {
  AdditiveBlending,
  BackSide,
  BufferGeometry,
  CanvasTexture,
  Color,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  LinearFilter,
  Mesh,
  ShaderMaterial,
  SphereGeometry,
  Texture,
  Vector2,
  Vector3,
  type Camera,
} from 'three';
import { geoEquirectangular, geoGraticule10, geoPath } from 'd3-geo';
import type { MultiLineString, Position } from 'geojson';
import { latLngToVector3, type World } from '../../lib/geo';

export const BORDER_RADIUS = 1.003;

/** Build LineSegments positions from [lng, lat] polylines at radius r. */
export function linesToPositions(lines: Position[][], r: number): Float32Array {
  let count = 0;
  for (const l of lines) count += Math.max(0, l.length - 1);
  const out = new Float32Array(count * 6);
  let o = 0;
  for (const line of lines) {
    for (let i = 0; i < line.length - 1; i++) {
      const a = latLngToVector3(line[i][1], line[i][0], r);
      const b = latLngToVector3(line[i + 1][1], line[i + 1][0], r);
      out[o++] = a[0]; out[o++] = a[1]; out[o++] = a[2];
      out[o++] = b[0]; out[o++] = b[1]; out[o++] = b[2];
    }
  }
  return out;
}

/** Rasterise land into an equirectangular mask so the fill lines up exactly with the vector borders. */
function landMask(world: World, width: number): CanvasTexture {
  const height = width / 2;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);
  const projection = geoEquirectangular()
    .scale(width / (2 * Math.PI))
    .translate([width / 2, height / 2])
    .precision(0.1);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  geoPath(projection, ctx)(world.land as never);
  ctx.fill();
  const tex = new CanvasTexture(canvas);
  tex.minFilter = LinearFilter;
  tex.generateMipmaps = false;
  return tex;
}

const globeVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vPosW;
  void main() {
    vUv = uv;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vec4 w = modelMatrix * vec4(position, 1.0);
    vPosW = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const globeFragment = /* glsl */ `
  uniform sampler2D landMask;
  uniform sampler2D topo;
  uniform float hasTopo;
  uniform vec2 topoTexel;
  uniform vec3 oceanColor;
  uniform vec3 landColor;
  uniform vec3 rimColor;
  uniform vec3 lightDir;
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vPosW;
  void main() {
    vec3 N = normalize(vNormalW);
    vec3 V = normalize(cameraPosition - vPosW);
    float land = texture2D(landMask, vUv).r;

    // Faint terrain: hillshade from the topology map.
    float h = texture2D(topo, vUv).r * hasTopo;
    float hx = texture2D(topo, vUv + vec2(topoTexel.x, 0.0)).r - texture2D(topo, vUv - vec2(topoTexel.x, 0.0)).r;
    float hy = texture2D(topo, vUv + vec2(0.0, topoTexel.y)).r - texture2D(topo, vUv - vec2(0.0, topoTexel.y)).r;
    float shade = (hy - hx) * 2.2 * hasTopo;

    vec3 ground = landColor * (1.0 + h * 0.9) + vec3(0.010, 0.018, 0.035) * shade;
    vec3 col = mix(oceanColor, ground, land);

    float diff = max(dot(N, lightDir), 0.0);
    col *= 0.7 + 0.55 * diff;

    // Soft sheen on the oceans.
    vec3 H = normalize(lightDir + V);
    col += (1.0 - land) * vec3(0.03, 0.06, 0.12) * pow(max(dot(N, H), 0.0), 30.0);

    // Fresnel rim.
    float fres = pow(1.0 - max(dot(N, V), 0.0), 2.6);
    col += rimColor * fres * 0.6;

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

const atmosphereVertex = /* glsl */ `
  varying vec3 vNormalV;
  varying vec3 vPosV;
  void main() {
    vNormalV = normalize(normalMatrix * normal);
    vec4 p = modelViewMatrix * vec4(position, 1.0);
    vPosV = p.xyz;
    gl_Position = projectionMatrix * p;
  }
`;

const atmosphereFragment = /* glsl */ `
  uniform vec3 glowColor;
  uniform float strength;
  varying vec3 vNormalV;
  varying vec3 vPosV;
  void main() {
    float d = dot(normalize(vNormalV), normalize(-vPosV));
    // d ≈ -0.55 just outside the globe's edge, 0 at the outer edge of the halo.
    float i = pow(smoothstep(0.0, 0.58, -d), 2.4);
    gl_FragColor = vec4(glowColor * i * strength, i);
  }
`;

export interface GlobeBody {
  group: Group;
  globe: Mesh;
  borders: LineSegments;
  setTopology(tex: Texture): void;
  update(camera: Camera): void;
  dispose(): void;
}

export function createGlobeBody(world: World, opts: { maskWidth: number }): GlobeBody {
  const group = new Group();

  // --- Sphere ---
  const mask = landMask(world, opts.maskWidth);
  const placeholder = new Texture();
  const lightDir = new Vector3(0, 0, 1);
  const material = new ShaderMaterial({
    vertexShader: globeVertex,
    fragmentShader: globeFragment,
    uniforms: {
      landMask: { value: mask },
      topo: { value: placeholder },
      hasTopo: { value: 0 },
      topoTexel: { value: new Vector2(1 / 2048, 1 / 1024) },
      oceanColor: { value: new Color('#04070f') },
      landColor: { value: new Color('#0d1a2e') },
      rimColor: { value: new Color('#2f74ff') },
      lightDir: { value: lightDir },
    },
  });
  const globe = new Mesh(new SphereGeometry(1, 128, 96), material);
  // Rotate the texture seam so UVs match latLngToVector3 (lng 0 → +Z).
  globe.rotation.y = -Math.PI / 2;
  globe.name = 'globe';
  group.add(globe);

  // --- Graticule (every 10°) ---
  const grat = geoGraticule10() as MultiLineString;
  const gratGeo = new BufferGeometry();
  gratGeo.setAttribute('position', new Float32BufferAttribute(linesToPositions(grat.coordinates, 1.0015), 3));
  const graticule = new LineSegments(
    gratGeo,
    new LineBasicMaterial({ color: '#3f6fd8', transparent: true, opacity: 0.09, depthWrite: false })
  );
  group.add(graticule);

  // --- Borders + coastlines ---
  const borderGeo = new BufferGeometry();
  borderGeo.setAttribute('position', new Float32BufferAttribute(linesToPositions(world.borders.coordinates, BORDER_RADIUS), 3));
  const borders = new LineSegments(
    borderGeo,
    new LineBasicMaterial({ color: '#7cc4ff', transparent: true, opacity: 0.5, depthWrite: false })
  );
  group.add(borders);

  // --- Atmosphere ---
  const atmosphere = new Mesh(
    new SphereGeometry(1.2, 96, 64),
    new ShaderMaterial({
      vertexShader: atmosphereVertex,
      fragmentShader: atmosphereFragment,
      uniforms: { glowColor: { value: new Color('#3b82ff') }, strength: { value: 0.85 } },
      side: BackSide,
      blending: AdditiveBlending,
      transparent: true,
      depthWrite: false,
    })
  );
  group.add(atmosphere);

  const tmpUp = new Vector3();
  const tmpRight = new Vector3();
  const tmpFwd = new Vector3();

  return {
    group,
    globe,
    borders,
    setTopology(tex: Texture) {
      material.uniforms.topo.value = tex;
      material.uniforms.hasTopo.value = 1;
      const img = tex.image as { width?: number; height?: number } | undefined;
      if (img?.width && img?.height) material.uniforms.topoTexel.value.set(1 / img.width, 1 / img.height);
    },
    update(camera: Camera) {
      // Light fixed relative to the camera (upper-left), so the visible side always reads well.
      tmpFwd.copy(camera.position).normalize();
      tmpUp.copy(camera.up);
      tmpRight.crossVectors(tmpUp, tmpFwd).normalize();
      tmpUp.crossVectors(tmpFwd, tmpRight).normalize();
      lightDir.copy(tmpFwd).multiplyScalar(0.7).addScaledVector(tmpRight, -0.55).addScaledVector(tmpUp, 0.45).normalize();
    },
    dispose() {
      mask.dispose();
      placeholder.dispose();
      (material.uniforms.topo.value as Texture).dispose();
      group.traverse((o) => {
        const m = o as Mesh;
        m.geometry?.dispose();
        const mat = m.material as { dispose?: () => void } | undefined;
        mat?.dispose?.();
      });
    },
  };
}
