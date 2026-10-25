import { BufferGeometry, Euler, Matrix4, Quaternion, Vector3 } from 'three';
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
