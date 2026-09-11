/* ==========================================================================
   Particles — from React Bits (https://reactbits.dev/backgrounds/particles)
   Copyright (c) 2026 David Haz. MIT + Commons Clause License Condition v1.0.
   Used here as part of this website; not sold or redistributed on its own.

   The shaders below are unchanged from the original component. The React
   hooks were replaced with a plain mount function, rendering is gated by
   ./shared.js, the frame delta is clamped so motes don't jump after a pause,
   and hover is read from the host section (the canvas ignores the pointer).
   ========================================================================== */
import { Renderer, Camera, Geometry, Program, Mesh } from 'https://cdn.jsdelivr.net/npm/ogl@1.0.11/+esm';
import { hexToRgb, runWhenVisible, COARSE, REDUCED } from './shared.js';

const defaultColors = ['#ffffff', '#ffffff', '#ffffff'];

const vertex = /* glsl */ `
  attribute vec3 position;
  attribute vec4 random;
  attribute vec3 color;

  uniform mat4 modelMatrix;
  uniform mat4 viewMatrix;
  uniform mat4 projectionMatrix;
  uniform float uTime;
  uniform float uSpread;
  uniform float uBaseSize;
  uniform float uSizeRandomness;

  varying vec4 vRandom;
  varying vec3 vColor;

  void main() {
    vRandom = random;
    vColor = color;

    vec3 pos = position * uSpread;
    pos.z *= 10.0;

    vec4 mPos = modelMatrix * vec4(pos, 1.0);
    float t = uTime;
    mPos.x += sin(t * random.z + 6.28 * random.w) * mix(0.1, 1.5, random.x);
    mPos.y += sin(t * random.y + 6.28 * random.x) * mix(0.1, 1.5, random.w);
    mPos.z += sin(t * random.w + 6.28 * random.y) * mix(0.1, 1.5, random.z);

    vec4 mvPos = viewMatrix * mPos;

    if (uSizeRandomness == 0.0) {
      gl_PointSize = uBaseSize;
    } else {
      gl_PointSize = (uBaseSize * (1.0 + uSizeRandomness * (random.x - 0.5))) / length(mvPos.xyz);
    }

    gl_Position = projectionMatrix * mvPos;
  }
`;

const fragment = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform float uAlphaParticles;
  varying vec4 vRandom;
  varying vec3 vColor;

  void main() {
    vec2 uv = gl_PointCoord.xy;
    float d = length(uv - vec2(0.5));

    if(uAlphaParticles < 0.5) {
      if(d > 0.5) {
        discard;
      }
      gl_FragColor = vec4(vColor + 0.2 * sin(uv.yxx + uTime + vRandom.y * 6.28), 1.0);
    } else {
      float circle = smoothstep(0.5, 0.4, d) * 0.8;
      gl_FragColor = vec4(vColor + 0.2 * sin(uv.yxx + uTime + vRandom.y * 6.28), circle);
    }
  }
`;

export function particles(container, options = {}) {
  const o = Object.assign(
    {
      particleCount: 200,
      particleSpread: 10,
      speed: 0.1,
      particleColors: null,
      moveParticlesOnHover: false,
      particleHoverFactor: 1,
      alphaParticles: false,
      particleBaseSize: 100,
      sizeRandomness: 1,
      cameraDistance: 20,
      disableRotation: false,
      pixelRatio: 1 // points are cheap, but a 2x buffer still quadruples the fill
    },
    options
  );
  const hover = o.moveParticlesOnHover && !COARSE && !REDUCED;
  const host = container.closest('.bg-host') || container.parentElement || container;

  runWhenVisible(container, () => {
    const renderer = new Renderer({ dpr: o.pixelRatio, depth: false, alpha: true });
    const gl = renderer.gl;
    container.appendChild(gl.canvas);
    gl.clearColor(0, 0, 0, 0);

    const camera = new Camera(gl, { fov: 15 });
    camera.position.set(0, 0, o.cameraDistance);

    const count = o.particleCount;
    const positions = new Float32Array(count * 3);
    const randoms = new Float32Array(count * 4);
    const colors = new Float32Array(count * 3);
    const palette = o.particleColors && o.particleColors.length > 0 ? o.particleColors : defaultColors;

    for (let i = 0; i < count; i++) {
      let x, y, z, len;
      do {
        x = Math.random() * 2 - 1;
        y = Math.random() * 2 - 1;
        z = Math.random() * 2 - 1;
        len = x * x + y * y + z * z;
      } while (len > 1 || len === 0);
      const r = Math.cbrt(Math.random());
      positions.set([x * r, y * r, z * r], i * 3);
      randoms.set([Math.random(), Math.random(), Math.random(), Math.random()], i * 4);
      colors.set(hexToRgb(palette[Math.floor(Math.random() * palette.length)]), i * 3);
    }

    const geometry = new Geometry(gl, {
      position: { size: 3, data: positions },
      random: { size: 4, data: randoms },
      color: { size: 3, data: colors }
    });

    const program = new Program(gl, {
      vertex,
      fragment,
      uniforms: {
        uTime: { value: 0 },
        uSpread: { value: o.particleSpread },
        uBaseSize: { value: o.particleBaseSize * o.pixelRatio },
        uSizeRandomness: { value: o.sizeRandomness },
        uAlphaParticles: { value: o.alphaParticles ? 1 : 0 }
      },
      transparent: true,
      depthTest: false
    });

    const points = new Mesh(gl, { mode: gl.POINTS, geometry, program });

    const resize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h);
      camera.perspective({ aspect: gl.canvas.width / gl.canvas.height });
      renderer.render({ scene: points, camera });
    };
    new ResizeObserver(resize).observe(container);
    resize();

    const mouse = { x: 0, y: 0 };
    const pointer = { x: -1, y: -1 };
    if (hover) {
      host.addEventListener(
        'mousemove',
        (e) => {
          pointer.x = e.clientX;
          pointer.y = e.clientY;
        },
        { passive: true }
      );
    }

    let last = null;
    let elapsed = 0;

    return {
      canvas: gl.canvas,
      render(ms) {
        // Clamp so resuming after an off-screen pause doesn't fling the motes
        const delta = last === null ? 0 : Math.min(ms - last, 50);
        last = ms;
        elapsed += delta * o.speed;

        program.uniforms.uTime.value = elapsed * 0.001;

        if (hover && pointer.x >= 0) {
          const rect = container.getBoundingClientRect(); // once per drawn frame
          mouse.x = ((pointer.x - rect.left) / rect.width) * 2 - 1;
          mouse.y = -(((pointer.y - rect.top) / rect.height) * 2 - 1);
        }
        // Eased toward the pointer: at 30fps a direct jump reads as stepping.
        const tx = hover ? -mouse.x * o.particleHoverFactor : 0;
        const ty = hover ? -mouse.y * o.particleHoverFactor : 0;
        points.position.x += (tx - points.position.x) * 0.3;
        points.position.y += (ty - points.position.y) * 0.3;

        if (!o.disableRotation) {
          points.rotation.x = Math.sin(elapsed * 0.0002) * 0.1;
          points.rotation.y = Math.cos(elapsed * 0.0005) * 0.15;
          points.rotation.z += 0.01 * o.speed;
        }

        renderer.render({ scene: points, camera });
      }
    };
  });
}
