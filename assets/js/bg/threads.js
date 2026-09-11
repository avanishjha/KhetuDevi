/* ==========================================================================
   Threads — from React Bits (https://reactbits.dev/backgrounds/threads)
   Copyright (c) 2026 David Haz. MIT + Commons Clause License Condition v1.0.
   Used here as part of this website; not sold or redistributed on its own.

   The shaders below are unchanged from the original component. The React
   hooks were replaced with a plain mount function, visibility gating moved to
   ./shared.js, and the pointer is read from the host section because the
   canvas itself ignores pointer events.
   ========================================================================== */
import { Renderer, Program, Mesh, Triangle, Color } from 'https://cdn.jsdelivr.net/npm/ogl@1.0.11/+esm';
import { hexToRgb, renderDpr, runWhenVisible, COARSE, REDUCED } from './shared.js';

const vertexShader = `
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragmentShader = `
precision highp float;

uniform float iTime;
uniform vec3 iResolution;
uniform vec3 uColor;
uniform float uAmplitude;
uniform float uDistance;
uniform vec2 uMouse;

#define PI 3.1415926538

const int u_line_count = 40;
const float u_line_width = 7.0;
const float u_line_blur = 10.0;

float Perlin2D(vec2 P) {
    vec2 Pi = floor(P);
    vec4 Pf_Pfmin1 = P.xyxy - vec4(Pi, Pi + 1.0);
    vec4 Pt = vec4(Pi.xy, Pi.xy + 1.0);
    Pt = Pt - floor(Pt * (1.0 / 71.0)) * 71.0;
    Pt += vec2(26.0, 161.0).xyxy;
    Pt *= Pt;
    Pt = Pt.xzxz * Pt.yyww;
    vec4 hash_x = fract(Pt * (1.0 / 951.135664));
    vec4 hash_y = fract(Pt * (1.0 / 642.949883));
    vec4 grad_x = hash_x - 0.49999;
    vec4 grad_y = hash_y - 0.49999;
    vec4 grad_results = inversesqrt(grad_x * grad_x + grad_y * grad_y)
        * (grad_x * Pf_Pfmin1.xzxz + grad_y * Pf_Pfmin1.yyww);
    grad_results *= 1.4142135623730950;
    vec2 blend = Pf_Pfmin1.xy * Pf_Pfmin1.xy * Pf_Pfmin1.xy
               * (Pf_Pfmin1.xy * (Pf_Pfmin1.xy * 6.0 - 15.0) + 10.0);
    vec4 blend2 = vec4(blend, vec2(1.0 - blend));
    return dot(grad_results, blend2.zxzx * blend2.wwyy);
}

float pixel(float count, vec2 resolution) {
    return (1.0 / max(resolution.x, resolution.y)) * count;
}

float lineFn(vec2 st, float width, float perc, float offset, vec2 mouse, float time, float amplitude, float distance) {
    float split_offset = (perc * 0.4);
    float split_point = 0.1 + split_offset;

    float amplitude_normal = smoothstep(split_point, 0.7, st.x);
    float amplitude_strength = 0.5;
    float finalAmplitude = amplitude_normal * amplitude_strength
                           * amplitude * (1.0 + (mouse.y - 0.5) * 0.2);

    float time_scaled = time / 10.0 + (mouse.x - 0.5) * 1.0;
    float blur = smoothstep(split_point, split_point + 0.05, st.x) * perc;

    float xnoise = mix(
        Perlin2D(vec2(time_scaled, st.x + perc) * 2.5),
        Perlin2D(vec2(time_scaled, st.x + time_scaled) * 3.5) / 1.5,
        st.x * 0.3
    );

    float y = 0.5 + (perc - 0.5) * distance + xnoise / 2.0 * finalAmplitude;

    float line_start = smoothstep(
        y + (width / 2.0) + (u_line_blur * pixel(1.0, iResolution.xy) * blur),
        y,
        st.y
    );

    float line_end = smoothstep(
        y,
        y - (width / 2.0) - (u_line_blur * pixel(1.0, iResolution.xy) * blur),
        st.y
    );

    return clamp(
        (line_start - line_end) * (1.0 - smoothstep(0.0, 1.0, pow(perc, 0.3))),
        0.0,
        1.0
    );
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;

    float line_strength = 1.0;
    for (int i = 0; i < u_line_count; i++) {
        float p = float(i) / float(u_line_count);
        line_strength *= (1.0 - lineFn(
            uv,
            u_line_width * pixel(1.0, iResolution.xy) * (1.0 - p),
            p,
            (PI * 1.0) * p,
            uMouse,
            iTime,
            uAmplitude,
            uDistance
        ));
    }

    float colorVal = 1.0 - line_strength;
    fragColor = vec4(uColor * colorVal, colorVal);
}

void main() {
    mainImage(gl_FragColor, gl_FragCoord.xy);
}
`;

export function threads(container, options = {}) {
  const o = Object.assign(
    { color: [1, 1, 1], amplitude: 1, distance: 0, enableMouseInteraction: false },
    options
  );
  const rgb = typeof o.color === 'string' ? hexToRgb(o.color) : o.color;
  const interactive = o.enableMouseInteraction && !COARSE && !REDUCED;
  const host = container.closest('.bg-host') || container.parentElement || container;

  runWhenVisible(container, () => {
    const renderer = new Renderer({ alpha: true });
    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    container.appendChild(gl.canvas);

    const program = new Program(gl, {
      vertex: vertexShader,
      fragment: fragmentShader,
      uniforms: {
        iTime: { value: 0 },
        iResolution: { value: new Color(gl.canvas.width, gl.canvas.height, gl.canvas.width / gl.canvas.height) },
        uColor: { value: new Color(...rgb) },
        uAmplitude: { value: o.amplitude },
        uDistance: { value: o.distance },
        uMouse: { value: new Float32Array([0.5, 0.5]) }
      }
    });
    const mesh = new Mesh(gl, { geometry: new Triangle(gl), program });

    // 80 Perlin evaluations per pixel: by far the heaviest shader on the page.
    // Half resolution, capped at 960px wide; the lines are blurred anyway.
    const resize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (!w || !h) return;
      renderer.dpr = renderDpr(w, h, { scale: 0.5, maxDim: 960 });
      renderer.setSize(w, h);
      program.uniforms.iResolution.value.r = gl.canvas.width;
      program.uniforms.iResolution.value.g = gl.canvas.height;
      program.uniforms.iResolution.value.b = gl.canvas.width / gl.canvas.height;
      renderer.render({ scene: mesh });
    };
    new ResizeObserver(resize).observe(container);
    resize();

    const current = [0.5, 0.5];
    const pointer = { x: 0, y: 0, inside: false };
    if (interactive) {
      host.addEventListener(
        'mousemove',
        (e) => {
          pointer.x = e.clientX;
          pointer.y = e.clientY;
          pointer.inside = true;
        },
        { passive: true }
      );
      host.addEventListener('mouseleave', () => {
        pointer.inside = false;
      });
    }

    return {
      canvas: gl.canvas,
      render(ms) {
        if (interactive) {
          let tx = 0.5;
          let ty = 0.5;
          if (pointer.inside) {
            const rect = container.getBoundingClientRect(); // once per drawn frame
            tx = (pointer.x - rect.left) / rect.width;
            ty = 1.0 - (pointer.y - rect.top) / rect.height;
          }
          const smoothing = 0.1; // upstream's 0.05 per 60fps frame, doubled for 30fps
          current[0] += smoothing * (tx - current[0]);
          current[1] += smoothing * (ty - current[1]);
          program.uniforms.uMouse.value[0] = current[0];
          program.uniforms.uMouse.value[1] = current[1];
        }
        program.uniforms.iTime.value = ms * 0.001;
        renderer.render({ scene: mesh });
      }
    };
  });
}
