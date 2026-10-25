import type { Experience, Project } from '../../../data/portfolio';
import { DISPLAY_FONT, drawCover, FONT, wrapText } from '../textures';
import type { PspColumn } from './pspMenu';

type Ctx = CanvasRenderingContext2D;

function dots(ctx: Ctx, cx: number, y: number, count: number, active: number, on: string, off: string) {
  const gap = 34;
  const start = cx - ((count - 1) * gap) / 2;
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = i === active ? on : off;
    ctx.beginPath();
    ctx.arc(start + i * gap, y, i === active ? 10 : 7, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Desktop monitor: one role per page. */
export function drawExperience(ctx: Ctx, w: number, h: number, job: Experience, index: number, count: number, active: boolean) {
  ctx.fillStyle = '#10131a';
  ctx.fillRect(0, 0, w, h);
  const glow = ctx.createRadialGradient(w * 0.8, h * 0.1, 10, w * 0.8, h * 0.1, w * 0.8);
  glow.addColorStop(0, 'rgba(120, 170, 255, 0.35)');
  glow.addColorStop(1, 'rgba(120, 170, 255, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  const x = 110;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#9fd8ff';
  ctx.font = `800 30px ${FONT}`;
  ctx.fillText(`EXPERIENCE  ${index + 1} / ${count}`, x, 120);
  if (job.placeholder) {
    ctx.fillStyle = '#ffcf3e';
    ctx.font = `800 24px ${FONT}`;
    const label = 'PLACEHOLDER';
    const lw = ctx.measureText(label).width + 36;
    ctx.beginPath();
    ctx.roundRect(w - x - lw, 88, lw, 46, 23);
    ctx.fill();
    ctx.fillStyle = '#10131a';
    ctx.fillText(label, w - x - lw + 18, 120);
  }
  ctx.fillStyle = '#ffffff';
  ctx.font = `900 76px ${FONT}`;
  wrapText(ctx, job.role, w - x * 2).forEach((line, i) => ctx.fillText(line, x, 220 + i * 82));
  const roleLines = wrapText(ctx, job.role, w - x * 2).length;
  let y = 220 + roleLines * 82 + 10;
  ctx.fillStyle = '#c3cad8';
  ctx.font = `600 38px ${FONT}`;
  ctx.fillText(`${job.org}   ·   ${job.period}`, x, y);
  y += 80;
  ctx.font = `500 36px ${FONT}`;
  for (const point of job.points) {
    ctx.fillStyle = '#9fd8ff';
    ctx.beginPath();
    ctx.arc(x + 9, y - 12, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e4e8f0';
    wrapText(ctx, point, w - x * 2 - 40).forEach((line, i) => ctx.fillText(line, x + 40, y + i * 48));
    y += wrapText(ctx, point, w - x * 2 - 40).length * 48 + 22;
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.font = `700 28px ${FONT}`;
  if (!active) ctx.fillText('Walk up and press Enter', w / 2, h - 48);
  dots(ctx, w / 2, h - 100, count, index, '#9fd8ff', 'rgba(255, 255, 255, 0.25)');
}

function icon(ctx: Ctx, id: PspColumn['id'], cx: number, cy: number, size: number) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = size * 0.09;
  if (id === 'music') {
    ctx.beginPath();
    ctx.ellipse(-size * 0.22, size * 0.28, size * 0.16, size * 0.12, -0.4, 0, Math.PI * 2);
    ctx.ellipse(size * 0.24, size * 0.18, size * 0.16, size * 0.12, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-size * 0.08, size * 0.26);
    ctx.lineTo(-size * 0.08, -size * 0.34);
    ctx.lineTo(size * 0.38, -size * 0.44);
    ctx.lineTo(size * 0.38, size * 0.16);
    ctx.stroke();
  } else if (id === 'favorites') {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? size * 0.2 : size * 0.45;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.roundRect(-size * 0.48, -size * 0.24, size * 0.96, size * 0.5, size * 0.22);
    ctx.fill();
    ctx.fillStyle = '#3a2f73';
    ctx.fillRect(-size * 0.3, -size * 0.04, size * 0.2, size * 0.07);
    ctx.fillRect(-size * 0.235, -size * 0.11, size * 0.07, size * 0.2);
    ctx.beginPath();
    ctx.arc(size * 0.2, -size * 0.06, size * 0.05, 0, Math.PI * 2);
    ctx.arc(size * 0.3, size * 0.05, size * 0.05, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** PSP: a cross-media-bar menu over a flowing wave background. */
export function drawPsp(ctx: Ctx, w: number, h: number, menu: PspColumn[], col: number, row: number, time: number, active: boolean) {
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, '#2b2160');
  bg.addColorStop(0.55, '#5a3a8c');
  bg.addColorStop(1, '#e0896b');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  // The signature wave
  for (let layer = 0; layer < 3; layer++) {
    ctx.beginPath();
    for (let x = 0; x <= w; x += 16) {
      const y = h * 0.58 + Math.sin(x * 0.006 + time * (0.5 + layer * 0.2) + layer) * (30 + layer * 14) + layer * 18;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.16 - layer * 0.04})`;
    ctx.lineWidth = 3 + layer * 2;
    ctx.stroke();
  }

  // Clock
  const now = new Date();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.font = `600 26px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.fillText(now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }), w - 40, 52);

  // Categories along the bar
  const barY = 170;
  const colX = 230;
  const spacing = 230;
  menu.forEach((c, i) => {
    const x = colX + (i - col) * spacing;
    const selected = i === col;
    ctx.globalAlpha = selected ? 1 : 0.55;
    icon(ctx, c.id, x, barY, selected ? 92 : 70);
    ctx.textAlign = 'center';
    ctx.font = `${selected ? 700 : 600} ${selected ? 28 : 22}px ${FONT}`;
    ctx.fillStyle = '#ffffff';
    if (selected) ctx.fillText(c.label, x, barY + 78);
    ctx.globalAlpha = 1;
  });

  // Items under the selected category
  const items = menu[col].items;
  let y = barY + 128;
  items.forEach((item, i) => {
    const selected = i === row;
    ctx.globalAlpha = selected ? 1 : 0.6;
    if (selected) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
      ctx.beginPath();
      ctx.roundRect(colX - 60, y - 42, w - colX - 20, 88, 16);
      ctx.fill();
    }
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = `${selected ? 800 : 600} ${selected ? 34 : 28}px ${FONT}`;
    ctx.fillText(item.title, colX - 30, y, w - colX - 80);
    if (selected) {
      ctx.font = `500 24px ${FONT}`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.fillText(item.placeholder ? `${item.subtitle}  ·  link coming soon` : item.subtitle, colX - 30, y + 36, w - colX - 80);
    }
    ctx.globalAlpha = 1;
    y += selected ? 96 : 56;
  });

  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.font = `600 22px ${FONT}`;
  if (!active) ctx.fillText('Walk up and press Enter', w / 2, h - 28);
}

/** A fair stall's chalkboard: the project's screenshot pinned up like a polaroid, with chalk notes. */
export function drawStallBoard(ctx: Ctx, w: number, h: number, project: Project, index: number, count: number, img: HTMLImageElement | null, accent: string, active: boolean) {
  // Chalkboard with a soft smudge.
  ctx.fillStyle = '#2f4a3d';
  ctx.fillRect(0, 0, w, h);
  const smudge = ctx.createRadialGradient(w * 0.6, h * 0.45, 40, w * 0.6, h * 0.45, w * 0.7);
  smudge.addColorStop(0, 'rgba(255, 255, 255, 0.07)');
  smudge.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = smudge;
  ctx.fillRect(0, 0, w, h);

  // Polaroid of the screenshot, taped at a slight angle.
  const pw = w * 0.44;
  const ph = pw * 0.86;
  ctx.save();
  ctx.translate(w * 0.27, h * 0.48);
  ctx.rotate(-0.045);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.fillRect(-pw / 2 + 8, -ph / 2 + 10, pw, ph);
  ctx.fillStyle = '#fffdf6';
  ctx.fillRect(-pw / 2, -ph / 2, pw, ph);
  const iw = pw - 36;
  const ih = ph - 96;
  ctx.fillStyle = '#e9e4da';
  ctx.fillRect(-iw / 2, -ph / 2 + 18, iw, ih);
  if (img) drawCover(ctx, img, -iw / 2, -ph / 2 + 18, iw, ih);
  ctx.fillStyle = '#5a4a3a';
  ctx.font = `600 34px ${DISPLAY_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(project.title, 0, ph / 2 - 40, pw - 40);
  ctx.fillStyle = 'rgba(255, 236, 170, 0.75)';
  ctx.rotate(0.12);
  ctx.fillRect(-60, -ph / 2 - 18, 120, 34);
  ctx.restore();

  // Chalk writing.
  const x = w * 0.54;
  const maxW = w * 0.42;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = accent;
  ctx.font = `600 26px ${DISPLAY_FONT}`;
  ctx.fillText(`STALL ${index + 1} OF ${count}`, x, 92);
  ctx.fillStyle = '#f4f1e6';
  ctx.font = `600 62px ${DISPLAY_FONT}`;
  const titleLines = wrapText(ctx, project.title, maxW);
  titleLines.forEach((line, i) => ctx.fillText(line, x, 160 + i * 64));
  // Chalk underline
  ctx.strokeStyle = 'rgba(244, 241, 230, 0.6)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  const uy = 160 + (titleLines.length - 1) * 64 + 18;
  ctx.moveTo(x, uy);
  ctx.quadraticCurveTo(x + maxW * 0.4, uy + 8, x + maxW * 0.8, uy - 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(244, 241, 230, 0.88)';
  ctx.font = `600 27px ${FONT}`;
  let y = uy + 52;
  for (const line of wrapText(ctx, project.description, maxW).slice(0, 8)) {
    ctx.fillText(line, x, y);
    y += 37;
  }
  ctx.fillStyle = accent;
  ctx.font = `700 22px ${FONT}`;
  ctx.fillText(project.projectUrl.replace(/^https?:\/\//, '').replace(/\/$/, ''), x, h - 56, maxW);
  if (!active) {
    ctx.fillStyle = 'rgba(244, 241, 230, 0.55)';
    ctx.font = `700 22px ${FONT}`;
    ctx.fillText('Step up and press Enter', x, h - 24);
  }
}
