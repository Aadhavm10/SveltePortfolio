import { BufferAttribute, BufferGeometry, Color, Euler, Matrix4, Quaternion, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface Part {
  geometry: BufferGeometry;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number] | number;
}

const matrix = new Matrix4();
const quaternion = new Quaternion();
const euler = new Euler();

/** Bakes each part's transform into its vertices and merges them, so a cluster of props is one draw call. */
export function mergeParts(parts: Part[]) {
  return mergeGeometries(
    parts.map(({ geometry, position = [0, 0, 0], rotation = [0, 0, 0], scale = 1 }) => {
      const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
      const s = typeof scale === 'number' ? new Vector3(scale, scale, scale) : new Vector3(...scale);
      matrix.compose(new Vector3(...position), quaternion.setFromEuler(euler.set(...rotation)), s);
      return g.applyMatrix4(matrix);
    })
  );
}

/** Bakes one colour into a geometry's vertex colours, so differently coloured parts can share a mesh. */
export function tinted(geometry: BufferGeometry, color: string) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  const c = new Color(color);
  const count = g.getAttribute('position').count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) colors.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new BufferAttribute(colors, 3));
  return g;
}
