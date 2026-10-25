import { useEffect, useMemo, useRef } from 'react';
import { MeshStandardMaterial } from 'three';
import { canvasTexture } from '../textures';
import { world } from '../store';

export const ALUMINIUM = new MeshStandardMaterial({ color: '#cdd0d6', metalness: 0.55, roughness: 0.32 });
export const DARK = new MeshStandardMaterial({ color: '#1b1c22', metalness: 0.2, roughness: 0.3 });
export const WOOD = new MeshStandardMaterial({ color: '#a87a52', roughness: 0.75 });

/** A screen texture that redraws whenever the world state it depends on changes. */
export function useScreen(width: number, height: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, key: () => string) {
  const texture = useMemo(() => canvasTexture(width, height, draw), []);
  const last = useRef('');
  useEffect(() => {
    const update = () => {
      const k = key();
      if (k === last.current) return;
      last.current = k;
      texture.redraw(draw);
    };
    update();
    return world.subscribe(update);
    // The draw and key callbacks read live state, so subscribing once is enough.
  }, []);
  return texture;
}
