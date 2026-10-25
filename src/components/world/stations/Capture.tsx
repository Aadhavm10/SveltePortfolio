import { useFrame, useThree } from '@react-three/fiber';
import { playShutter } from '../sound';
import { fx, world } from '../store';
import { DISPLAY_FONT, FONT } from '../textures';
import { photoBooth } from './Gadgets';

/** Asks the booth to take a photo on the next frame. */
export function takePhoto() {
  if (world.get().polaroid) return;
  fx.snap = true;
  playShutter();
}

/** Frames a square crop of the current view as a polaroid with a caption. */
function polaroid(source: HTMLCanvasElement) {
  const W = 1080;
  const pad = 54;
  const size = W - pad * 2;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = pad + size + 230;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fffdf6';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const crop = Math.min(source.width, source.height);
  ctx.drawImage(source, (source.width - crop) / 2, (source.height - crop) / 2, crop, crop, pad, pad, size, size);
  // A touch of warm film tone.
  ctx.fillStyle = 'rgba(255, 196, 140, 0.08)';
  ctx.fillRect(pad, pad, size, size);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#4a3b2c';
  ctx.font = `600 66px ${DISPLAY_FONT}`;
  ctx.fillText("Aadhav's park", W / 2, pad + size + 108);
  ctx.fillStyle = '#8a7a68';
  ctx.font = `700 34px ${FONT}`;
  const date = new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
  ctx.fillText(date, W / 2, pad + size + 166);
  return canvas;
}

/** Renders a frame and grabs it straight away, while the drawing buffer is still valid. */
export function Capture() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  useFrame(() => {
    if (!fx.snap) return;
    fx.snap = false;
    gl.render(scene, camera);
    const card = polaroid(gl.domElement);
    photoBooth.last = card;
    photoBooth.shots++;
    card.toBlob(
      (blob) => {
        if (!blob) return;
        world.set({ polaroid: URL.createObjectURL(blob) });
      },
      'image/jpeg',
      0.92
    );
  });
  return null;
}
