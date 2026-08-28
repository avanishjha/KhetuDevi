# Khetu Devi Memorial Trust — website

A single-page memorial and institutional site for the Khetu Devi Memorial Trust,
Bhadkha, Barmer, Rajasthan. All narrative content comes from
`Khetu_Devi_Memorial_Trust_Website_Content.docx`. No facts, figures, names,
dates or claims have been invented.

## Run it

```bash
python .claude/devserver.py 4321 .
```

Open <http://localhost:4321>. Four files, no build step, no dependencies beyond
GSAP/Lenis from CDN. Any static host serves it as-is.

## The design

**Engraved.** Monumental scale, bone and dark stone, no ornament.

Built to measurements taken from the supplied reference (Shopify Editions
Winter '26) rather than to taste:

| | Reference | This site |
| --- | --- | --- |
| Type scale | 10 → 176px (17.6:1) | 11 → 159px (14.5:1) |
| Dominant weight | 700 | 700 |
| Accent colour | none — warm neutral duotone | none |
| Elements with shadows | 0.2% | 0.2% |
| Largest media | 80% viewport width | 80% viewport width |

Palette: bone `#F7F7EE`, warm grey `#DCDCD0`, mid `#5C5C4E`, muted `#909083`,
ink `#292919`. One typeface (Archivo) plus Noto Serif Devanagari for Hindi.
No mono, no letterspaced technical labels, no accent — the photographs will be
the only colour on the page.

## Adding the photographs

Each plate shows a designed frame until a real file lands. Drop it at the path
and it appears — no code change.

| File | Aspect | Appears as |
| --- | --- | --- |
| `assets/img/khetu-devi-portrait.jpg` | 16:9 | Below the hero, 80vw |
| `assets/img/punyatithi.jpg` | 21:9 | Before Chapter VI, 80vw |

Both run large, so supply the highest resolution you have (2400px+ on the long
edge). Set `--focal` on the figure if a face crops badly, e.g.
`style="--ratio: 16/9; --focal: 50% 30%"`. Correct the `alt` text to match.

There is room for two more photographs if you have them — say the word and I'll
place them.

## Motion

GSAP + ScrollTrigger, with Lenis as the only smooth-scroll engine. Deliberately
restrained: masked word reveals on headings, a scrubbed reveal on the vow and
the philosophy line, and a progress line drawing down the barefoot journey.

- `prefers-reduced-motion: reduce` renders every final state, no pinning or
  scrubbing, and drops smooth scrolling.
- If GSAP fails to load, a failsafe adds `.no-motion` and the full static page
  renders. Nothing needs JavaScript to be readable.
- `prefers-reduced-transparency` and `prefers-contrast` are both handled.
- Press states on every control (feedback on pointer-down, not release).
- Split headings keep an unsplit accessible name.

## Removed

The Three.js landscape and weather system were cut. Rendered in context they
read as a video-game scene, which is what was making the page look cheap — and
the reference contains no procedural 3D anywhere. `assets/vendor/three.min.js`
and `assets/js/world.js` were deleted with it.

One thing worth keeping from that work if it ever returns: GSAP parses a CSS
`transform: translateY(112%)` into an absolute pixel `y` and caches it, after
which `yPercent: 0` cannot clear it. Masked-reveal offsets must be set from JS,
never CSS. That single bug caused the invisible hero in three earlier builds.

## Not included

- **No photographs of Khetu Devi or her family have been generated or sourced.**
  She was a real person; inventing her likeness would be fabrication.
- No testimonials, logos, awards, or figures beyond the source document.
- No donation flow — that needs real account details and a provider decision.

## Also here

`.claude/demo-gallery.html` lists the skill demos considered along the way
(needs `python .claude/devserver.py 4322 ~/.claude/skills`).
