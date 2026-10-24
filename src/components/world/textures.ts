import { CanvasTexture, SRGBColorSpace } from 'three';

export const FONT = '"Inter Variable", Inter, system-ui, sans-serif';

export type Draw = (ctx: CanvasRenderingContext2D, width: number, height: number) => void;

/** Draws onto a fresh canvas and wraps it in a texture. Call `redraw` to repaint (e.g. once an image loads). */
export function canvasTexture(width: number, height: number, draw: Draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  const redraw = (fn: Draw = draw) => {
    ctx.clearRect(0, 0, width, height);
    fn(ctx, width, height);
    texture.needsUpdate = true;
  };
  redraw();
  return Object.assign(texture, { redraw });
}

export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

const imageCache = new Map<string, Promise<HTMLImageElement>>();

export function loadImage(src: string) {
  let promise = imageCache.get(src);
  if (!promise) {
    promise = new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
    imageCache.set(src, promise);
  }
  return promise;
}

/** Draws an image scaled to fill the rect, like CSS object-fit: cover. */
export function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / img.width, h / img.height);
  const sw = w / scale;
  const sh = h / scale;
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
}

/** Draws an image scaled to fit inside the rect, like CSS object-fit: contain. */
export function drawContain(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.min(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}
