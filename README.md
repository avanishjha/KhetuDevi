# Khetu Devi Memorial Trust

A single-page memorial and institutional website for the Khetu Devi Memorial Trust, Bhadkha, Barmer, Rajasthan. The family history, names, dates, programme details and figures are retained from the original website content.

## Local preview

```bash
node .claude/preview-server.cjs 4321
```

Open <http://localhost:4321>. The dependency-free Node server disables caching so edits appear on reload. The existing Python alternative also works when Python is installed:

```bash
python .claude/devserver.py 4321 .
```

There is no build or installation step. Deploy `index.html` and `assets/` to any static host. GSAP, ScrollTrigger, Lenis, fonts and the ambient OGL effects load from CDNs; the page remains readable when those services are unavailable.

## Visual experience

- A native WebGL diya, with a softly lit bronze bowl and a gently breathing flame, responds subtly to the pointer and scroll. It uses no external 3D library and has a static SVG fallback.
- Scroll reveals bring in headings, memorial reliefs and service cards. A moving values ribbon, dimensional book, illustrated service areas and reading-progress line extend the visual language through the page.
- The existing chapter backgrounds and barefoot journey remain, with improved animation lifecycle management.
- Warm bone, stone, olive and bronze keep the presentation tied to the memorial's subject. All new artwork is abstract; no likeness of a real person or documentary scene has been fabricated.

`assets/css/style.css` contains the original foundation; `assets/css/experience.css` adds the responsive visual treatment. `assets/js/main.js` coordinates scroll motion and navigation; `assets/js/sculpture.js` owns the WebGL sculpture.

The diya is an original procedural illustration. Directional references were
[Anantaya's oil lamps](https://www.anantayadecor.in/collections/all/subcat_pooja)
for the simple vessel form and [Noguchi's Akari light sculptures](https://shop.noguchi.org/collections/akari-light-sculptures)
for warm, diffuse illumination. No reference photographs or product models are embedded.

## Motion and accessibility

- **Pause motion** settles scroll effects and pauses decorative rendering. **Resume motion** restores it. The control respects OS reduced-motion preferences, including changes made while the page is open.
- The sculpture runs at up to 30fps, caps its pixel ratio at 1.6, and pauses offscreen or in a hidden tab. Ambient effects run only in the most visible section and retain their clocks while paused.
- With reduced motion or unavailable GSAP, all text stays readable and navigation remains usable. A timeout releases the opening curtain even if the deferred scripts fail to load.
- Mobile navigation supports Escape, outside clicks and keyboard focus; closed navigation links are inert. Anchors keep their URLs and keyboard focus when smooth scrolling is enabled.

## Real photographs

The two photo slots currently show finished abstract artwork. To use supplied photographs, place the files below and change each image's `data-photo-src` attribute to `src` in `index.html`:

| File | Location |
| --- | --- |
| `assets/img/khetu-devi-portrait.jpg` | Memorial below the hero |
| `assets/img/punyatithi.jpg` | Annual remembrance panel |

Use high-resolution source photographs. Adjust `--focal` on the figure to control cropping, for example `--focal: 50% 30%`, and confirm that the alt text matches the supplied photograph. Failed image loads retain the artwork.

No donation flow is included; the existing telephone contacts remain intact.
