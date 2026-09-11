/* ==========================================================================
   Light Rays — from React Bits (https://reactbits.dev/backgrounds/light-rays)
   Copyright (c) 2026 David Haz. MIT + Commons Clause License Condition v1.0.
   Used here as part of this website; not sold or redistributed on its own.

   The shaders below are unchanged from the original component. The React
   hooks were replaced with a plain mount function, rendering is gated by
   ./shared.js (one section at a time, 30fps, still frame under reduced
   motion), it draws at half resolution, and pointer-following is off on
   touch screens.
   ========================================================================== */
import { Renderer, Program, Triangle, Mesh } from 'https://cdn.jsdelivr.net/npm/ogl@1.0.11/+esm';
import { hexToRgb, renderDpr, runWhenVisible, COARSE, REDUCED } from './shared.js';

const getAnchorAndDir = (origin, w, h) => {
  const outside = 0.2;
  switch (origin) {
    case 'top-left':
      return { anchor: [0, -outside * h], dir: [0, 1] };
    case 'top-right':
      return { anchor: [w, -outside * h], dir: [0, 1] };
    case 'left':
      return { anchor: [-outside * w, 0.5 * h], dir: [1, 0] };
    case 'right':
      return { anchor: [(1 + outside) * w, 0.5 * h], dir: [-1, 0] };
    case 'bottom-left':
      return { anchor: [0, (1 + outside) * h], dir: [0, -1] };
    case 'bottom-center':
      return { anchor: [0.5 * w, (1 + outside) * h], dir: [0, -1] };
    case 'bottom-right':
      return { anchor: [w, (1 + outside) * h], dir: [0, -1] };
    default: // "top-center"
      return { anchor: [0.5 * w, -outside * h], dir: [0, 1] };
  }
};

const vert = `
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

const frag = `precision highp float;

uniform float iTime;
uniform vec2  iResolution;

uniform vec2  rayPos;
uniform vec2  rayDir;
uniform vec3  raysColor;
uniform float raysSpeed;
uniform float lightSpread;
uniform float rayLength;
uniform float pulsating;
uniform float fadeDistance;
uniform float saturation;
uniform vec2  mousePos;
uniform float mouseInfluence;
uniform float noiseAmount;
uniform float distortion;
uniform float lightMode;

varying vec2 vUv;

float noise(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}

float rayStrength(vec2 raySource, vec2 rayRefDirection, vec2 coord,
                  float seedA, float seedB, float speed) {
  vec2 sourceToCoord = coord - raySource;
  vec2 dirNorm = normalize(sourceToCoord);
  float cosAngle = dot(dirNorm, rayRefDirection);

  float distortedAngle = cosAngle + distortion * sin(iTime * 2.0 + length(sourceToCoord) * 0.01) * 0.2;

  float spreadFactor = pow(max(distortedAngle, 0.0), 1.0 / max(lightSpread, 0.001));

  float distance = length(sourceToCoord);
  float maxDistance = iResolution.x * rayLength;
  float lengthFalloff = clamp((maxDistance - distance) / maxDistance, 0.0, 1.0);

  float fadeFalloff = clamp((iResolution.x * fadeDistance - distance) / (iResolution.x * fadeDistance), 0.5, 1.0);
  float pulse = pulsating > 0.5 ? (0.8 + 0.2 * sin(iTime * speed * 3.0)) : 1.0;

  float baseStrength = clamp(
    (0.45 + 0.15 * sin(distortedAngle * seedA + iTime * speed)) +
    (0.3 + 0.2 * cos(-distortedAngle * seedB + iTime * speed)),
    0.0, 1.0
  );

  return baseStrength * lengthFalloff * fadeFalloff * spreadFactor * pulse;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 coord = vec2(fragCoord.x, iResolution.y - fragCoord.y);

  vec2 finalRayDir = rayDir;
  if (mouseInfluence > 0.0) {
    vec2 mouseScreenPos = mousePos * iResolution.xy;
    vec2 mouseDirection = normalize(mouseScreenPos - rayPos);
    finalRayDir = normalize(mix(rayDir, mouseDirection, mouseInfluence));
  }

  vec4 rays1 = vec4(1.0) *
               rayStrength(rayPos, finalRayDir, coord, 36.2214, 21.11349,
                           1.5 * raysSpeed);
  vec4 rays2 = vec4(1.0) *
               rayStrength(rayPos, finalRayDir, coord, 22.3991, 18.0234,
                           1.1 * raysSpeed);

  fragColor = rays1 * 0.5 + rays2 * 0.4;

  if (noiseAmount > 0.0) {
    float n = noise(coord * 0.01 + iTime * 0.1);
    fragColor.rgb *= (1.0 - noiseAmount + noiseAmount * n);
  }

  float brightness = 1.0 - (coord.y / iResolution.y);
  fragColor.x *= 0.1 + brightness * 0.8;
  fragColor.y *= 0.3 + brightness * 0.6;
  fragColor.z *= 0.5 + brightness * 0.5;

  if (saturation != 1.0) {
    float gray = dot(fragColor.rgb, vec3(0.299, 0.587, 0.114));
    fragColor.rgb = mix(vec3(gray), fragColor.rgb, saturation);
  }

  fragColor.rgb *= raysColor;

  if (lightMode > 0.5) {
    vec3 mapped = vec3(1.0) - exp(-max(fragColor.rgb, vec3(0.0)) * 1.35);
    float energy = clamp(max(mapped.r, max(mapped.g, mapped.b)), 0.0, 1.0);
    vec3 hue = mapped / max(energy, 0.0001);
    vec3 ink = mix(hue * 0.25, hue * 0.72, energy);
    fragColor = vec4(mix(vec3(1.0), ink, energy), 1.0);
  }
}

void main() {
  vec4 color;
  mainImage(color, gl_FragCoord.xy);
  gl_FragColor  = color;
}`;

export function lightRays(container, options = {}) {
  const o = Object.assign(
    {
      raysOrigin: 'top-center',
      raysColor: '#ffffff',
      raysSpeed: 1,
      lightSpread: 1,
      rayLength: 2,
      pulsating: false,
      fadeDistance: 1.0,
      saturation: 1.0,
      followMouse: true,
      mouseInfluence: 0.1,
      noiseAmount: 0.0,
      distortion: 0.0,
      lightMode: false
    },
    options
  );
  // On touch there is no pointer to follow; with no motion allowed, don't bend.
  const follow = o.followMouse && !COARSE && !REDUCED;

  runWhenVisible(container, () => {
    const renderer = new Renderer({ dpr: Math.min(window.devicePixelRatio || 1, 2), alpha: true });
    const gl = renderer.gl;
    gl.canvas.style.width = '100%';
    gl.canvas.style.height = '100%';
    container.appendChild(gl.canvas);

    const uniforms = {
      iTime: { value: 0 },
      iResolution: { value: [1, 1] },
      rayPos: { value: [0, 0] },
      rayDir: { value: [0, 1] },
      raysColor: { value: hexToRgb(o.raysColor) },
      raysSpeed: { value: o.raysSpeed },
      lightSpread: { value: o.lightSpread },
      rayLength: { value: o.rayLength },
      pulsating: { value: o.pulsating ? 1.0 : 0.0 },
      fadeDistance: { value: o.fadeDistance },
      saturation: { value: o.saturation },
      mousePos: { value: [0.5, 0.5] },
      mouseInfluence: { value: follow ? o.mouseInfluence : 0.0 },
      noiseAmount: { value: o.noiseAmount },
      distortion: { value: o.distortion },
      lightMode: { value: o.lightMode ? 1.0 : 0.0 }
    };

    const program = new Program(gl, { vertex: vert, fragment: frag, uniforms });
    const mesh = new Mesh(gl, { geometry: new Triangle(gl), program });

    const place = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (!w || !h) return;
      // Soft light: half resolution is invisible and a quarter of the fill.
      renderer.dpr = renderDpr(w, h, { scale: 0.5, maxDim: 1100 });
      renderer.setSize(w, h);
      const W = w * renderer.dpr;
      const H = h * renderer.dpr;
      uniforms.iResolution.value = [W, H];
      const { anchor, dir } = getAnchorAndDir(o.raysOrigin, W, H);
      uniforms.rayPos.value = anchor;
      uniforms.rayDir.value = dir;
      renderer.render({ scene: mesh }); // a resize clears the buffer; redraw it
    };
    new ResizeObserver(place).observe(container);
    place();

    // Keep raw coordinates only. Measuring the container on every mousemove
    // forced a layout dozens of times a second while the page scrolled; now
    // it is measured once per drawn frame.
    const pointer = { x: -1, y: -1 };
    const smooth = { x: 0.5, y: 0.5 };
    if (follow) {
      window.addEventListener(
        'mousemove',
        (e) => {
          pointer.x = e.clientX;
          pointer.y = e.clientY;
        },
        { passive: true }
      );
    }

    return {
      canvas: gl.canvas,
      render(ms) {
        uniforms.iTime.value = ms * 0.001;
        if (follow && o.mouseInfluence > 0.0 && pointer.x >= 0) {
          const r = container.getBoundingClientRect();
          const smoothing = 0.85; // upstream's 0.92 per 60fps frame, squared for 30fps
          smooth.x = smooth.x * smoothing + ((pointer.x - r.left) / r.width) * (1 - smoothing);
          smooth.y = smooth.y * smoothing + ((pointer.y - r.top) / r.height) * (1 - smoothing);
          uniforms.mousePos.value = [smooth.x, smooth.y];
        }
        renderer.render({ scene: mesh });
      }
    };
  });
}
