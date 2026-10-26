import { RepeatWrapping, SRGBColorSpace } from 'three';
import { seeded } from '../env/palette';
import { canvasTexture, DISPLAY_FONT, FONT } from '../textures';

/** Drawn art for my room: jerseys, scarves, the flag, prints and screens. */

export function jerseyTexture(name: string, main: string, trim: string, longSleeves: boolean) {
  return canvasTexture(256, 256, (ctx, w) => {
    ctx.clearRect(0, 0, w, w);
    // Hanger
    ctx.strokeStyle = '#3b3a40';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(128, 18, 9, Math.PI, Math.PI * 2.4);
    ctx.moveTo(128, 27);
    ctx.lineTo(128, 34);
    ctx.moveTo(62, 58);
    ctx.lineTo(128, 34);
    ctx.lineTo(194, 58);
    ctx.stroke();
    // Shirt
    ctx.fillStyle = main;
    ctx.beginPath();
    ctx.moveTo(100, 40);
    ctx.quadraticCurveTo(128, 52, 156, 40);
    ctx.lineTo(206, 58);
    if (longSleeves) {
      ctx.lineTo(240, 196);
      ctx.lineTo(214, 202);
      ctx.lineTo(192, 112);
    } else {
      ctx.lineTo(238, 104);
      ctx.lineTo(196, 122);
    }
    ctx.lineTo(194, 240);
    ctx.lineTo(62, 240);
    ctx.lineTo(60, longSleeves ? 112 : 122);
    if (longSleeves) {
      ctx.lineTo(42, 202);
      ctx.lineTo(16, 196);
    } else {
      ctx.lineTo(18, 104);
    }
    ctx.lineTo(50, 58);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = trim;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(100, 41);
    ctx.quadraticCurveTo(128, 53, 156, 41);
    ctx.stroke();
    // Name and number, as seen from the back
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.font = `600 22px ${DISPLAY_FONT}`;
    ctx.fillText(name, 128, 90, 120);
    ctx.font = `700 104px ${DISPLAY_FONT}`;
    ctx.fillText('7', 128, 196);
  });
}

export function scarfTexture(text: string, sub: string | null, left: string, right: string, ink: string) {
  return canvasTexture(640, 112, (ctx, w, h) => {
    ctx.fillStyle = left;
    ctx.fillRect(0, 0, w / 2, h);
    ctx.fillStyle = right;
    ctx.fillRect(w / 2, 0, w / 2, h);
    // Knitted bands at the ends, and a fringe
    for (const x of [24, w - 60]) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.fillRect(x, 0, 10, h);
      ctx.fillRect(x + 20, 0, 10, h);
    }
    ctx.fillStyle = ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${sub ? 46 : 64}px ${DISPLAY_FONT}`;
    ctx.fillText(text, w / 2, sub ? h / 2 - 12 : h / 2 + 3, w - 160);
    if (sub) {
      ctx.font = `600 22px ${DISPLAY_FONT}`;
      ctx.fillText(sub, w / 2, h / 2 + 30);
    }
  });
}

export function flagTexture() {
  return canvasTexture(256, 360, (ctx, w, h) => {
    ctx.fillStyle = '#1f2a44';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.font = '600 30px Georgia, serif';
    ctx.fillText('Welcome to my', w / 2, 58);
    ctx.fillText('crib', w / 2, 94);
    // A curious white goose peering out
    ctx.fillStyle = '#f4efe6';
    ctx.beginPath();
    ctx.ellipse(w / 2, h - 30, 70, 70, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(w / 2, 225, 34, 80, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(w / 2, 168, 40, 36, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8a08a';
    ctx.beginPath();
    ctx.ellipse(w / 2, 196, 20, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1d1b22';
    ctx.beginPath();
    ctx.arc(w / 2 - 16, 160, 5, 0, Math.PI * 2);
    ctx.arc(w / 2 + 16, 160, 5, 0, Math.PI * 2);
    ctx.fill();
    // Grommets
    ctx.fillStyle = '#c5ccd2';
    for (const [x, y] of [
      [12, 12],
      [w - 12, 12],
      [12, h - 12],
      [w - 12, h - 12]
    ]) {
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

/** A black helmet on white, and a gold robot head on white. */
export function helmetTexture() {
  return canvasTexture(240, 260, (ctx, w, h) => {
    ctx.fillStyle = '#f7f5f0';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#18181c';
    ctx.beginPath();
    ctx.moveTo(40, 190);
    ctx.quadraticCurveTo(30, 60, 120, 44);
    ctx.quadraticCurveTo(210, 60, 200, 190);
    ctx.lineTo(178, 222);
    ctx.lineTo(62, 222);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#4a4c55';
    ctx.beginPath();
    ctx.moveTo(78, 118);
    ctx.lineTo(116, 126);
    ctx.lineTo(116, 140);
    ctx.lineTo(72, 136);
    ctx.closePath();
    ctx.moveTo(162, 118);
    ctx.lineTo(124, 126);
    ctx.lineTo(124, 140);
    ctx.lineTo(168, 136);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(108, 150);
    ctx.lineTo(132, 150);
    ctx.lineTo(146, 210);
    ctx.lineTo(94, 210);
    ctx.closePath();
    ctx.fill();
  });
}

export function robotTexture() {
  return canvasTexture(240, 220, (ctx, w, h) => {
    ctx.fillStyle = '#f7f5f0';
    ctx.fillRect(0, 0, w, h);
    const g = ctx.createRadialGradient(100, 80, 10, 120, 110, 90);
    g.addColorStop(0, '#ffe08a');
    g.addColorStop(1, '#c99a3c');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(120, 110, 66, 74, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2a2622';
    ctx.beginPath();
    ctx.arc(96, 100, 13, 0, Math.PI * 2);
    ctx.arc(144, 100, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd04a';
    ctx.beginPath();
    ctx.arc(96, 100, 6, 0, Math.PI * 2);
    ctx.arc(144, 100, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8a6a2a';
    ctx.fillRect(108, 140, 24, 16);
  });
}

/** Black and white skyline across three canvases. */
export function skylineTexture() {
  const rand = seeded(1929);
  return canvasTexture(900, 240, (ctx, w, h) => {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#d6d6d4');
    sky.addColorStop(0.55, '#bdbdbb');
    sky.addColorStop(1, '#8e8e8c');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    const horizon = h * 0.6;
    for (let x = 0; x < w * 0.82; ) {
      const bw = 8 + rand() * 22;
      const tall = x > w * 0.3 && x < w * 0.45 ? 1.8 : 1;
      const bh = (14 + rand() * 50) * tall;
      const v = Math.round(68 + rand() * 46);
      ctx.fillStyle = `rgb(${v}, ${v}, ${v + 2})`;
      ctx.fillRect(x, horizon - bh, bw, bh);
      if (rand() > 0.85) ctx.fillRect(x + bw / 2 - 1, horizon - bh - 18, 2, 18);
      x += bw - 2;
    }
    // Water with a soft reflection
    ctx.fillStyle = '#a7a7a5';
    ctx.fillRect(0, horizon, w, h - horizon);
    ctx.globalAlpha = 0.25;
    ctx.save();
    ctx.translate(0, horizon * 2);
    ctx.scale(1, -1);
    ctx.drawImage(ctx.canvas, 0, 0, w, horizon, 0, 0, w, horizon);
    ctx.restore();
    ctx.globalAlpha = 1;
  });
}

export function paintingTexture() {
  return canvasTexture(240, 200, (ctx, w, h) => {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#f6c88f');
    sky.addColorStop(1, '#8fc46a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    const rand = seeded(77);
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = ['#2f6b3a', '#4f8f45', '#79b35a', '#c98a4a'][i % 4];
      ctx.beginPath();
      ctx.ellipse(rand() * w, h * 0.35 + rand() * h * 0.7, 18 + rand() * 30, 10 + rand() * 20, rand() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(w * 0.48, h * 0.3, 6, 40);
  });
}

export function waveTexture() {
  return canvasTexture(256, 128, (ctx, w, h) => {
    ctx.fillStyle = '#1c1c20';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#f4f1ea';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let x = 30; x < w - 30; x += 3) {
      const t = (x - 30) / (w - 60);
      const amp = Math.sin(t * Math.PI) * 40 * (0.5 + 0.5 * Math.sin(x * 0.31) * Math.cos(x * 0.13));
      ctx.moveTo(x, h / 2 - amp);
      ctx.lineTo(x, h / 2 + amp);
    }
    ctx.stroke();
  });
}

export function carpetTexture() {
  const t = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#cdb99c';
    ctx.fillRect(0, 0, w, h);
    const rand = seeded(5);
    for (let i = 0; i < 2600; i++) {
      ctx.fillStyle = rand() > 0.5 ? 'rgba(255, 245, 225, 0.2)' : 'rgba(120, 95, 70, 0.14)';
      ctx.fillRect(rand() * w, rand() * h, 2, 2);
    }
  });
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(4, 4);
  return t;
}


/** The dusky backdrop the room floats in. */
export function backdropTexture() {
  const t = canvasTexture(16, 512, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#1f1d3a');
    g.addColorStop(0.55, '#3a2a4e');
    g.addColorStop(1, '#5b3a4c');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** Golden hour outside the window. */
export function windowSkyTexture() {
  return canvasTexture(256, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#6d6fb8');
    g.addColorStop(0.45, '#f0a07c');
    g.addColorStop(0.75, '#ffd28a');
    g.addColorStop(1, '#ffe7b0');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // Rooftops and a tree across the street
    ctx.fillStyle = '#4a3550';
    ctx.fillRect(0, h * 0.78, w, h * 0.22);
    ctx.beginPath();
    ctx.moveTo(30, h * 0.78);
    ctx.lineTo(90, h * 0.64);
    ctx.lineTo(150, h * 0.78);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(205, h * 0.7, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff4d8';
    ctx.beginPath();
    ctx.arc(70, h * 0.42, 16, 0, Math.PI * 2);
    ctx.fill();
  });
}

/** Code editor on the monitor. */
export function codeTexture() {
  const rand = seeded(42);
  return canvasTexture(512, 300, (ctx, w, h) => {
    ctx.fillStyle = '#16182a';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#1e2138';
    ctx.fillRect(0, 0, 90, h);
    ctx.fillRect(0, 0, w, 22);
    ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(14 + i * 16, 11, 5, 0, Math.PI * 2);
      ctx.fill();
    });
    for (let i = 0; i < 9; i++) {
      ctx.fillStyle = i === 2 ? '#3a3f6a' : 'rgba(255, 255, 255, 0.18)';
      ctx.fillRect(10, 34 + i * 24, 40 + rand() * 30, 8);
    }
    const colors = ['#c792ea', '#82aaff', '#c3e88d', '#ffcb6b', '#89ddff', '#f78c6c', '#eeffff'];
    for (let line = 0; line < 15; line++) {
      let x = 108 + (line % 4 === 0 ? 0 : 18 * (1 + Math.floor(rand() * 2)));
      const y = 36 + line * 17;
      const words = 1 + Math.floor(rand() * 5);
      for (let k = 0; k < words; k++) {
        const len = 18 + rand() * 60;
        ctx.fillStyle = colors[Math.floor(rand() * colors.length)];
        ctx.fillRect(x, y, len, 7);
        x += len + 8;
      }
    }
    ctx.fillStyle = '#ffcb6b';
    ctx.fillRect(108, 36 + 15 * 17, 8, 12);
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = `700 14px ${FONT}`;
    ctx.fillText('portfolio / World.tsx', 108, 15);
  });
}

/** A match on the TV; `t` moves the players and the ball. */
export function drawMatch(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  ctx.fillStyle = '#3f8f3f';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i % 2 ? '#3a873a' : '#449a44';
    ctx.fillRect((i * w) / 8, 0, w / 8, h);
  }
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.lineWidth = 3;
  ctx.strokeRect(20, 30, w - 40, h - 50);
  ctx.beginPath();
  ctx.moveTo(w / 2, 30);
  ctx.lineTo(w / 2, h - 20);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(w / 2, (h + 10) / 2, 36, 0, Math.PI * 2);
  ctx.stroke();
  const bx = w / 2 + Math.sin(t * 0.7) * w * 0.32;
  const by = h / 2 + Math.sin(t * 1.3) * h * 0.22;
  for (let i = 0; i < 10; i++) {
    const home = i < 5;
    const px = (home ? w * 0.3 : w * 0.7) + Math.sin(t * 0.8 + i * 1.7) * 60 + (bx - w / 2) * 0.4;
    const py = 50 + ((i % 5) / 4) * (h - 90) + Math.cos(t * 0.6 + i) * 14;
    ctx.fillStyle = home ? '#e4252f' : '#f4f1ea';
    ctx.beginPath();
    ctx.arc(px, py, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(bx, by, 4, 0, Math.PI * 2);
  ctx.fill();
  // Score bug
  ctx.fillStyle = 'rgba(20, 20, 30, 0.85)';
  ctx.fillRect(16, 4, 150, 22);
  ctx.fillStyle = '#ffffff';
  ctx.font = `800 15px ${FONT}`;
  ctx.fillText(`MUN 2 - 1 RMA   ${String(60 + Math.floor(t / 4) % 30).padStart(2, '0')}'`, 22, 20);
}
