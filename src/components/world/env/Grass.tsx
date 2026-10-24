import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BufferAttribute,
  DoubleSide,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  MeshLambertMaterial,
  Vector2,
  Vector4
} from 'three';
import { bodies, world } from '../store';
import { createGrassMask, MASK_RECT } from './mask';
import { GOLDEN, seeded } from './palette';

/** Side of the square grass patch that follows the player, in metres. */
const PATCH = 60;

function bladeGeometry(count: number) {
  const g = new InstancedBufferGeometry();
  const w = 0.085;
  // A tapered blade: three segments and a tip, y runs 0..1 and is scaled per blade.
  const positions = new Float32Array([
    -w / 2, 0, 0, w / 2, 0, 0,
    -w * 0.38, 0.35, 0, w * 0.38, 0.35, 0,
    -w * 0.2, 0.7, 0, w * 0.2, 0.7, 0,
    0, 1, 0
  ]);
  g.setAttribute('position', new BufferAttribute(positions, 3));
  g.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4, 3, 5, 4, 4, 5, 6]);

  const rand = seeded(1234);
  const offsets = new Float32Array(count * 2);
  const rands = new Float32Array(count);
  const scales = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    offsets[i * 2] = rand() * PATCH;
    offsets[i * 2 + 1] = rand() * PATCH;
    rands[i] = rand();
    scales[i] = 0.32 + rand() * rand() * 0.55;
  }
  g.setAttribute('aOffset', new InstancedBufferAttribute(offsets, 2));
  g.setAttribute('aRand', new InstancedBufferAttribute(rands, 1));
  g.setAttribute('aScale', new InstancedBufferAttribute(scales, 1));
  g.instanceCount = count;
  return g;
}

/** Wind-blown grass blades that part around the player and the ball. */
export function Grass() {
  const { geometry, material, uniforms } = useMemo(() => {
    const count = world.get().quality === 'low' ? 18000 : 72000;
    const uniforms = {
      uTime: { value: 0 },
      uCenter: { value: new Vector2() },
      uPlayer: { value: new Vector2(999, 999) },
      uBall: { value: new Vector2(999, 999) },
      uSize: { value: PATCH },
      uMask: { value: createGrassMask() },
      uMaskRect: { value: new Vector4(MASK_RECT.minX, MASK_RECT.minZ, MASK_RECT.width, MASK_RECT.depth) },
      uBase: { value: GOLDEN.grassBase },
      uTip: { value: GOLDEN.grassTip }
    };
    const material = new MeshLambertMaterial({ side: DoubleSide });
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          /* glsl */ `#include <common>
          uniform float uTime;
          uniform vec2 uCenter;
          uniform vec2 uPlayer;
          uniform vec2 uBall;
          uniform float uSize;
          uniform sampler2D uMask;
          uniform vec4 uMaskRect;
          attribute vec2 aOffset;
          attribute float aRand;
          attribute float aScale;
          varying float vHeight;
          varying float vRand;`
        )
        .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3(0.0, 1.0, 0.0);')
        .replace(
          '#include <begin_vertex>',
          /* glsl */ `
          // Wrap each blade into the patch around the player.
          vec2 root = aOffset + uSize * floor((uCenter - aOffset) / uSize + 0.5);
          float mask = texture2D(uMask, (root - uMaskRect.xy) / uMaskRect.zw).r;
          float fade = 1.0 - smoothstep(uSize * 0.32, uSize * 0.48, length(root - uCenter));
          float h = aScale * mask * fade;

          float tip = position.y * position.y;
          vec2 windDir = normalize(vec2(1.0, 0.45));
          float gust = sin(uTime * 0.6 + root.x * 0.05 + root.y * 0.03) * 0.5 + 0.5;
          float wave = sin(uTime * 1.8 + dot(root, windDir) * 0.45) * 0.6 + sin(uTime * 3.3 + aRand * 6.28) * 0.25;
          vec2 bend = windDir * (wave * 0.12 + gust * 0.18) * tip;

          // Part around the player and the ball.
          vec2 fromPlayer = root - uPlayer;
          float nearPlayer = 1.0 - smoothstep(0.15, 1.1, length(fromPlayer));
          vec2 fromBall = root - uBall;
          float nearBall = 1.0 - smoothstep(0.1, 0.55, length(fromBall));
          bend += normalize(fromPlayer + 0.0001) * nearPlayer * tip * 0.7;
          bend += normalize(fromBall + 0.0001) * nearBall * tip * 0.6;
          float flatten = 1.0 - (nearPlayer * 0.45 + nearBall * 0.35) * position.y;

          float a = aRand * 6.2831;
          vec2 side = vec2(cos(a), sin(a)) * position.x;
          vec3 transformed = vec3(root.x + side.x + bend.x * h, position.y * h * flatten, root.y + side.y + bend.y * h);
          vHeight = position.y;
          vRand = aRand;`
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          /* glsl */ `#include <common>
          uniform vec3 uBase;
          uniform vec3 uTip;
          varying float vHeight;
          varying float vRand;`
        )
        .replace(
          '#include <color_fragment>',
          'diffuseColor.rgb = mix(uBase, uTip, smoothstep(0.0, 1.0, vHeight)) * (0.8 + 0.4 * vRand);'
        );
    };
    return { geometry: bladeGeometry(count), material, uniforms };
  }, []);

  useFrame((state) => {
    uniforms.uTime.value = state.clock.elapsedTime;
    const p = bodies.player?.translation();
    if (p) {
      uniforms.uPlayer.value.set(p.x, p.z);
      uniforms.uCenter.value.set(p.x, p.z - 6);
    } else {
      uniforms.uCenter.value.set(state.camera.position.x, state.camera.position.z - 18);
    }
    const b = bodies.ball?.translation();
    if (b) uniforms.uBall.value.set(b.x, b.z);
  });

  return <mesh geometry={geometry} material={material} frustumCulled={false} receiveShadow />;
}
