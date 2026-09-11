/* ==========================================================================
   Shared plumbing for the WebGL backgrounds in this folder.
   (This file is the site's own code, not part of React Bits.)

   These are ambient layers, so they run on a strict budget:
     - built lazily, when their section comes within 200px of the viewport
     - only ONE section animates at a time: whichever fills the most of the
       screen. Every other background holds its last frame at zero cost.
     - capped at 30fps; nothing here moves fast enough to need more
     - drawn below screen resolution and scaled up by CSS (see renderDpr)
     - nothing animates under the opening curtain, while the tab is hidden,
       or at all under prefers-reduced-motion (one still frame instead)
   ========================================================================== */

export const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const COARSE = window.matchMedia('(pointer: coarse)').matches;

export function hexToRgb(hex) {
  let h = String(hex).replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  if (Number.isNaN(n)) return [1, 1, 1];
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/* Pixel ratio for a drawing buffer: the screen's (max 2) times `scale`, then
   capped so the longest side never exceeds `maxDim` device pixels. Fill cost
   is per pixel, so scale 0.5 is a quarter of the work. These effects are soft
   and the canvas is stretched back to full size by CSS, so it doesn't show. */
export function renderDpr(w, h, { scale = 1, maxDim = 1920 } = {}) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2) * scale;
  const longest = Math.max(w, h);
  return longest * dpr > maxDim ? maxDim / longest : dpr;
}

const root = document.documentElement;
const underCurtain = () => root.classList.contains('intro-armed');

/* --- one section at a time ------------------------------------------------ */
const hosts = new Map(); // .bg-host element -> { visible: px on screen, runners }
let activeHost = null;

function syncAll() {
  hosts.forEach((state) => state.runners.forEach((runner) => runner.sync()));
}

function pickActive() {
  let best = null;
  let bestPx = 0;
  hosts.forEach((state, host) => {
    if (state.visible > bestPx) {
      best = host;
      bestPx = state.visible;
    }
  });
  activeHost = best;
  syncAll();
}

const hostIO = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      const state = hosts.get(entry.target);
      if (state) state.visible = entry.isIntersecting ? entry.intersectionRect.height : 0;
    });
    pickActive();
  },
  { threshold: Array.from({ length: 21 }, (_, i) => i / 20) }
);

document.addEventListener('visibilitychange', syncAll);
// The opening curtain lifts by removing .intro-armed from <html>.
new MutationObserver(syncAll).observe(root, { attributes: true, attributeFilter: ['class'] });

/* build() creates the scene and returns { canvas, render(elapsedMs) }, or
   null to opt out (e.g. no WebGL2). */
export function runWhenVisible(container, build, { fps = 30 } = {}) {
  const host = container.closest('.bg-host') || container;
  if (!hosts.has(host)) {
    hosts.set(host, { visible: 0, runners: new Set() });
    hostIO.observe(host);
  }

  const interval = 1000 / fps;
  let scene = null;
  let raf = 0;
  let t0 = 0;
  let lastDraw = -Infinity;

  const frame = (t) => {
    raf = requestAnimationFrame(frame);
    if (t - lastDraw < interval - 1) return; // hold to the frame budget
    lastDraw = t;
    scene.render(t - t0);
  };

  const runner = {
    sync() {
      const shouldRun =
        scene && host === activeHost && !document.hidden && !underCurtain() && !REDUCED;
      if (shouldRun && !raf) {
        raf = requestAnimationFrame(frame);
      } else if (!shouldRun && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    }
  };
  hosts.get(host).runners.add(runner);

  const buildIO = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting || scene) return;
      buildIO.disconnect();

      try {
        scene = build();
      } catch (err) {
        console.warn('[bg] could not start', err);
        scene = null;
      }
      if (!scene) return;

      t0 = performance.now();
      scene.render(0); // first frame now — also the reduced-motion still

      const built = scene;
      built.canvas.addEventListener(
        'webglcontextlost',
        (e) => {
          e.preventDefault();
          if (raf) cancelAnimationFrame(raf);
          raf = 0;
          built.canvas.remove(); // fall back to the section's CSS ground
          scene = null;
          hosts.get(host).runners.delete(runner);
        },
        { once: true }
      );

      runner.sync();
    },
    { rootMargin: '200px 0px' }
  );
  buildIO.observe(container);
}
