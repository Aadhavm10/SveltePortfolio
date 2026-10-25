import { useLayoutEffect, useRef, type ReactNode } from 'react';
import {
  BufferAttribute,
  BufferGeometry,
  Group,
  Material,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshStandardMaterial,
  type Object3D
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

type Plain = MeshStandardMaterial | MeshLambertMaterial | MeshBasicMaterial;

const isPlain = (m: Material): m is Plain =>
  (m instanceof MeshStandardMaterial || m instanceof MeshLambertMaterial || m instanceof MeshBasicMaterial) && !m.map && !m.transparent && !m.alphaMap;

/** Everything about a material except its colour, which gets baked into the vertices instead. */
function bucketKey(mesh: Mesh, m: Plain) {
  const standard = m instanceof MeshStandardMaterial ? `${m.roughness.toFixed(2)}|${m.metalness.toFixed(2)}|${m.emissive.getHexString()}|${m.emissiveIntensity}` : '';
  const lambert = m instanceof MeshLambertMaterial ? m.emissive.getHexString() : '';
  const flat = 'flatShading' in m ? m.flatShading : false;
  return [m.type, standard, lambert, flat, m.side, m.toneMapped, m.fog, m.wireframe, mesh.castShadow, mesh.receiveShadow].join('|');
}

/** Copies a mesh's geometry into the group's space, keeping only position, normal and a baked colour. */
function prepare(mesh: Mesh, m: Plain, toGroup: Matrix4) {
  let g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  const keep = new BufferGeometry();
  keep.setAttribute('position', g.getAttribute('position'));
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  keep.setAttribute('normal', g.getAttribute('normal'));
  const count = keep.getAttribute('position').count;
  const colors = new Float32Array(count * 3);
  const existing = m.vertexColors ? g.getAttribute('color') : null;
  for (let i = 0; i < count; i++) {
    const r = existing ? existing.getX(i) : 1;
    const gr = existing ? existing.getY(i) : 1;
    const b = existing ? existing.getZ(i) : 1;
    colors[i * 3] = r * m.color.r;
    colors[i * 3 + 1] = gr * m.color.g;
    colors[i * 3 + 2] = b * m.color.b;
  }
  keep.setAttribute('color', new BufferAttribute(colors, 3));
  g = keep;
  g.applyMatrix4(new Matrix4().multiplyMatrices(toGroup, mesh.matrixWorld));
  return g;
}

/**
 * Static batching: once its children have mounted, merges every plain, unmoving mesh inside into one
 * mesh per kind of material (colours baked into vertices), then hides the originals. Turns dozens of
 * draw calls into a handful. Mark anything that moves with `userData={{ dynamic: true }}`.
 */
export function StaticBatch({ children }: { children: ReactNode }) {
  const group = useRef<Group>(null);

  useLayoutEffect(() => {
    const root = group.current;
    if (!root) return;
    root.updateWorldMatrix(true, true);
    const toGroup = root.matrixWorld.clone().invert();
    const buckets = new Map<string, { material: Plain; meshes: Mesh[] }>();

    const visit = (o: Object3D) => {
      if (o.userData.dynamic) return;
      const mesh = o as Mesh;
      if (mesh.isMesh && !(mesh as unknown as { isInstancedMesh?: boolean }).isInstancedMesh && mesh.visible && !Array.isArray(mesh.material) && isPlain(mesh.material) && !mesh.geometry.morphAttributes.position) {
        const key = bucketKey(mesh, mesh.material);
        const bucket = buckets.get(key) ?? { material: mesh.material, meshes: [] };
        bucket.meshes.push(mesh);
        buckets.set(key, bucket);
      }
      o.children.forEach(visit);
    };
    root.children.forEach(visit);

    const added: Mesh[] = [];
    const hidden: Mesh[] = [];
    buckets.forEach(({ material, meshes }) => {
      if (meshes.length < 2) return;
      const merged = mergeGeometries(meshes.map((m) => prepare(m, m.material as Plain, toGroup)));
      if (!merged) return;
      const mat = material.clone();
      mat.color.set('#ffffff');
      mat.vertexColors = true;
      const batch = new Mesh(merged, mat);
      batch.castShadow = meshes[0].castShadow;
      batch.receiveShadow = meshes[0].receiveShadow;
      batch.userData.batch = true;
      root.add(batch);
      added.push(batch);
      meshes.forEach((m) => {
        m.visible = false;
        hidden.push(m);
      });
    });

    return () => {
      hidden.forEach((m) => (m.visible = true));
      added.forEach((m) => {
        root.remove(m);
        m.geometry.dispose();
        (m.material as Material).dispose();
      });
    };
  }, []);

  return <group ref={group}>{children}</group>;
}
