import type { Experience, Project } from '../../../data/portfolio';
import { drawContain, drawCover, FONT, wrapText } from '../textures';
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

/** MacBook: a browser window showing one project. */
export function drawProject(ctx: Ctx, w: number, h: number, project: Project, index: number, count: number, img: HTMLImageElement | null, active: boolean) {
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, '#f6c88f');
  bg.addColorStop(1, '#e48b7a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Window
  const pad = 70;
  const top = 60;
  const ww = w - pad * 2;
  const wh = h - top - 110;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
  ctx.beginPath();
  ctx.roundRect(pad + 8, top + 14, ww, wh, 26);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(pad, top, ww, wh, 26);
  ctx.fill();
  ctx.fillStyle = '#eceae6';
  ctx.beginPath();
  ctx.roundRect(pad, top, ww, 74, [26, 26, 0, 0]);
  ctx.fill();
  ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(pad + 42 + i * 36, top + 37, 12, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(w / 2 - 330, top + 16, 660, 42, 21);
  ctx.fill();
  ctx.fillStyle = '#6b6b73';
  ctx.font = `600 24px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(project.projectUrl.replace(/^https?:\/\//, '').replace(/\/$/, ''), w / 2, top + 38, 620);

  // Screenshot on the left, words on the right.
  const bodyTop = top + 74;
  const imgW = ww * 0.56;
  const imgX = pad + 36;
  const imgY = bodyTop + 36;
  const imgH = wh - 74 - 72;
  ctx.fillStyle = '#f3f1ed';
  ctx.beginPath();
  ctx.roundRect(imgX, imgY, imgW, imgH, 18);
  ctx.fill();
  if (img) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(imgX, imgY, imgW, imgH, 18);
    ctx.clip();
    (img.width / img.height > 1.25 ? drawCover : drawContain)(ctx, img, imgX, imgY, imgW, imgH);
    ctx.restore();
  }
  const tx = imgX + imgW + 44;
  const tw = pad + ww - 40 - tx;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#d9643f';
  ctx.font = `800 26px ${FONT}`;
  ctx.fillText(`WORK  ${String(index + 1).padStart(2, '0')} / ${String(count).padStart(2, '0')}`, tx, imgY + 30);
  ctx.fillStyle = '#16161a';
  ctx.font = `900 64px ${FONT}`;
  wrapText(ctx, project.title, tw).forEach((line, i) => ctx.fillText(line, tx, imgY + 106 + i * 68));
  const titleLines = wrapText(ctx, project.title, tw).length;
  ctx.fillStyle = '#4a4a52';
  ctx.font = `500 30px ${FONT}`;
  wrapText(ctx, project.description, tw)
    .slice(0, 8)
    .forEach((line, i) => ctx.fillText(line, tx, imgY + 120 + titleLines * 68 + i * 44));

  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.font = `700 28px ${FONT}`;
  if (!active) ctx.fillText('Walk up and press Enter', w / 2, h - 38);
  dots(ctx, w / 2, h - 82, count, index, '#ffffff', 'rgba(255, 255, 255, 0.45)');
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
