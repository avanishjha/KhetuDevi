/* ==========================================================================
   Mounts every WebGL background on the page.

   Markup:  <div class="bg" data-bg="light-rays" data-bg-options='{...}'></div>
   The options object is passed straight to the component, so all tuning lives
   in index.html next to the section it belongs to.

   If OGL fails to load from the CDN this module never runs, and every section
   simply keeps its plain CSS ground — nothing on the page depends on it.
   ========================================================================== */
import { lightRays } from './light-rays.js';
import { particles } from './particles.js';
import { threads } from './threads.js';
import { grainient } from './grainient.js';

const registry = {
  'light-rays': lightRays,
  particles,
  threads,
  grainient
};

// Open the page with ?nobg to switch every background off: the quickest way
// to tell whether a slowdown comes from these or from something else.
const disabled = new URLSearchParams(window.location.search).has('nobg');

document.querySelectorAll('[data-bg]').forEach((el) => {
  if (disabled) return;
  const mount = registry[el.dataset.bg];
  if (!mount) return;

  let options = {};
  if (el.dataset.bgOptions) {
    try {
      options = JSON.parse(el.dataset.bgOptions);
    } catch (err) {
      console.warn('[bg] unreadable data-bg-options on', el, err);
    }
  }
  mount(el, options);
});
