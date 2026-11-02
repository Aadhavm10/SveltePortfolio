// Drives the static #globe-loader markup rendered by GlobeLoader.astro.
import { gsap } from 'gsap';

const MIN_VISIBLE_MS = 600;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function loaderControl() {
  const el = document.getElementById('globe-loader');
  const bar = el?.querySelector<HTMLElement>('[data-bar]');
  const pct = el?.querySelector<HTMLElement>('[data-pct]');
  const status = el?.querySelector<HTMLElement>('[data-status]');
  const shown = { v: 0 };
  let target = 0;

  const render = () => {
    if (bar) bar.style.transform = `scaleX(${shown.v})`;
    if (pct) pct.textContent = `${Math.round(shown.v * 100)}%`;
  };

  return {
    progress(p: number, label?: string) {
      target = Math.max(target, Math.min(1, p)); // never goes backwards
      gsap.to(shown, { v: target, duration: 0.35, ease: 'power2.out', overwrite: true, onUpdate: render });
      if (label && status) status.textContent = label;
    },
    async finish() {
      if (!el) return;
      el.dataset.done = '1';
      clearTimeout((window as unknown as { __globeLoaderTimer?: number }).__globeLoaderTimer);
      if (el.classList.contains('show')) {
        this.progress(1, 'ready');
        const shownAt = Number(el.dataset.shownAt || 0);
        await sleep(Math.max(250, MIN_VISIBLE_MS - (performance.now() - shownAt)));
        el.classList.add('leaving');
        await sleep(800);
      }
      el.remove();
    },
  };
}
