import { useMemo } from 'react';
import { CatmullRomCurve3, TubeGeometry, Vector3 } from 'three';

/**
 * A cable lying along a list of points, with a plug at each end.
 * Points are local to the parent; the curve passes smoothly through them.
 */
export function Cable({ points, radius = 0.055, color = '#f2efe8', plug = '#d9d5cc' }: { points: [number, number, number][]; radius?: number; color?: string; plug?: string }) {
  const { tube, ends } = useMemo(() => {
    const curve = new CatmullRomCurve3(points.map((p) => new Vector3(...p)), false, 'catmullrom', 0.35);
    const segments = Math.max(16, Math.round(curve.getLength() * 6));
    const tube = new TubeGeometry(curve, segments, radius, 8, false);
    const ends = [0, 1].map((t) => {
      const at = curve.getPointAt(t);
      const dir = curve.getTangentAt(t).multiplyScalar(t === 0 ? -1 : 1);
      // Aim the plug's long axis along the cable.
      const yaw = Math.atan2(dir.x, dir.z);
      const pitch = -Math.asin(Math.max(-1, Math.min(1, dir.y)));
      return { at, yaw, pitch };
    });
    return { tube, ends };
  }, [points, radius]);
  return (
    <group>
      <mesh geometry={tube} castShadow receiveShadow>
        <meshStandardMaterial color={color} roughness={0.55} />
      </mesh>
      {ends.map((e, i) => (
        <mesh key={i} position={e.at} rotation={[e.pitch, e.yaw, 0, 'YXZ']} castShadow>
          <boxGeometry args={[radius * 3.2, radius * 2.4, radius * 5]} />
          <meshStandardMaterial color={plug} roughness={0.4} />
        </mesh>
      ))}
    </group>
  );
}
