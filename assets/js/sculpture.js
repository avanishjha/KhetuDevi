/* A small, dependency-free diya: a quiet vessel for an enduring light. */
(function () {
  "use strict";
  var canvas = document.getElementById("legacy-sculpture");
  if (!canvas) return;
  var visual = canvas.closest(".hero__visual"), hero = canvas.closest(".hero");
  if (!visual || !hero) return;
  var gl;
  try {
    gl = canvas.getContext("webgl", { alpha: true, antialias: true, depth: true,
      premultipliedAlpha: true, powerPreference: "low-power" });
  } catch (error) { return; }
  if (!gl) return;

  var preference = window.matchMedia("(prefers-reduced-motion: reduce)");
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  var reduced = preference.matches;
  var paused = document.documentElement.classList.contains("motion-paused");
  var visible = true, contextLost = false, ready = false;
  var frame = 0, previous = null, elapsed = 0, width = 0, height = 0;
  var pointer = { x: 0, y: 0 }, current = { x: 0, y: 0 };
  var program, vertexBuffer, indexBuffer, uniforms, bodyCount, flameCount;
  var flameOrigin = [1.01, 0.305, -0.455];

  var vertexSource = [
    "attribute vec3 aPosition;", "attribute vec3 aNormal;", "attribute vec3 aSurface;",
    "uniform mat4 uModel;", "uniform mat4 uProjection;", "uniform vec3 uFlameOrigin;",
    "varying vec3 vNormal;", "varying vec3 vPosition;", "varying vec3 vSurface;", "varying vec3 vLight;",
    "void main() {",
    "  vec4 position = uModel * vec4(aPosition, 1.0);",
    // A billboard keeps the flame's rounded silhouette during small pointer rotations.
    "  vec4 flame = uModel * vec4(uFlameOrigin, 1.0);",
    "  if (aSurface.z > 2.5) position = flame + vec4(aPosition, 0.0);",
    "  vPosition = position.xyz;",
    "  vLight = flame.xyz + vec3(0.0, 0.16, 0.0);",
    "  vNormal = mat3(uModel) * aNormal;",
    "  vSurface = aSurface;",
    "  gl_Position = uProjection * position;",
    "}"
  ].join("\n");

  var fragmentSource = [
    "precision mediump float;", "uniform float uTime;",
    "varying vec3 vNormal;", "varying vec3 vPosition;", "varying vec3 vSurface;", "varying vec3 vLight;",
    "void main() {",
    "  if (vSurface.z > 2.5) {",
    "    vec2 uv = vSurface.xy;",
    "    float breath = sin(uTime * 1.7) * 0.018 + sin(uTime * 2.3) * 0.008;",
    "    float y = (uv.y - 0.06) / (0.86 + breath);",
    "    float bend = 0.12 * y * y + sin(uTime * 1.3) * 0.025 * y * y;",
    "    float x = (uv.x - 0.5) * 2.0 + bend;",
    // A curved teardrop, with a full lower lobe and a quietly tapered tip.
    "    float contour = 0.48 * pow(max(sin(clamp(y, 0.0, 1.0) * 3.141593), 0.0), 0.72) * (1.0 - y * 0.48);",
    "    float edge = 1.0 - smoothstep(contour - 0.045, contour + 0.045, abs(x));",
    "    edge *= smoothstep(0.0, 0.055, y) * (1.0 - smoothstep(0.96, 1.0, y));",
    "    float core = (1.0 - smoothstep(0.0, max(contour * 0.85, 0.001), abs(x))) * (1.0 - smoothstep(0.35, 0.9, y));",
    "    float halo = exp(-x * x * 5.0 - (y - 0.35) * (y - 0.35) * 4.5) * 0.13;",
    "    halo *= smoothstep(0.0, 0.12, uv.x) * (1.0 - smoothstep(0.88, 1.0, uv.x));",
    "    halo *= smoothstep(0.0, 0.08, uv.y) * (1.0 - smoothstep(0.88, 1.0, uv.y));",
    "    float alpha = edge * 0.96 + halo * (1.0 - edge);",
    "    if (alpha < 0.003) discard;",
    "    vec3 color = mix(vec3(1.0, 0.57, 0.15), vec3(1.0, 0.94, 0.69), core);",
    "    color = mix(vec3(1.0, 0.74, 0.32), color, edge);",
    "    gl_FragColor = vec4(color, alpha);",
    "    return;",
    "  }",
    "  vec3 normal = normalize(vNormal);", "  vec3 eye = normalize(-vPosition);",
    "  vec3 key = normalize(vec3(-0.7, 1.2, 1.5));",
    "  vec3 fill = normalize(vec3(0.8, 0.25, 0.65));",
    "  float diffuse = max(dot(normal, key), 0.0);",
    "  float softFill = max(dot(normal, fill), 0.0);",
    "  float broadSheen = pow(max(dot(normal, normalize(key + eye)), 0.0), 12.0);",
    "  vec3 toFlame = vLight - vPosition;",
    "  float warmth = max(dot(normal, normalize(toFlame)), 0.0) / (1.0 + dot(toFlame, toFlame) * 3.5);",
    "  vec3 color;",
    "  if (vSurface.z < 0.5) {",
    // Broad, smooth shading rather than a high-frequency UV texture.
    "    vec3 bronze = mix(vec3(0.49, 0.30, 0.15), vec3(0.68, 0.47, 0.25), vSurface.y);",
    "    color = bronze * (0.48 + diffuse * 0.61 + softFill * 0.14);",
    "    color += vec3(0.23, 0.18, 0.105) * broadSheen;",
    "    color += vec3(0.25, 0.11, 0.025) * warmth;",
    "  } else if (vSurface.z < 1.5) {",
    "    float reflection = pow(max(dot(normal, normalize(normalize(toFlame) + eye)), 0.0), 35.0);",
    "    color = vec3(0.16, 0.085, 0.027) + vec3(0.12, 0.075, 0.027) * diffuse;",
    "    color += vec3(0.14, 0.10, 0.055) * broadSheen + vec3(0.48, 0.24, 0.055) * reflection;",
    "  } else {",
    "    vec3 wick = vSurface.z > 2.1 ? vec3(0.16, 0.10, 0.06) : vec3(0.72, 0.59, 0.38);",
    "    color = wick * (0.55 + diffuse * 0.45) + vec3(0.13, 0.055, 0.01) * warmth;",
    "  }",
    "  gl_FragColor = vec4(color, 1.0);",
    "}"
  ].join("\n");

  function shader(type, source) {
    var item = gl.createShader(type);
    if (!item) throw new Error("Diya shader unavailable");
    gl.shaderSource(item, source); gl.compileShader(item);
    if (!gl.getShaderParameter(item, gl.COMPILE_STATUS)) {
      gl.deleteShader(item); throw new Error("Diya shader unavailable");
    }
    return item;
  }
  function rotate(point, x, y) {
    var a = point[0], b = point[1], c = point[2];
    var by = b * Math.cos(x) - c * Math.sin(x), cz = b * Math.sin(x) + c * Math.cos(x);
    return [a * Math.cos(y) + cz * Math.sin(y), by, -a * Math.sin(y) + cz * Math.cos(y)];
  }
  function normalize(vector) {
    var length = Math.hypot(vector[0], vector[1], vector[2]) || 1;
    return [vector[0] / length, vector[1] / length, vector[2] / length];
  }
  function cross(a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  }

  function geometry() {
    var vertices = [], indices = [], segments = 128, steps = 72;
    // The profile travels from underside, around a rolled lip, down to the inner floor.
    var profile = [
      [0, -0.32], [0.26, -0.32], [0.53, -0.27], [0.77, -0.14],
      [0.95, 0.06], [1.03, 0.22], [1.035, 0.26], [1.01, 0.285],
      [0.975, 0.285], [0.945, 0.255], [0.91, 0.15], [0.80, 0.015],
      [0.62, -0.12], [0.35, -0.19], [0, -0.205]
    ];
    function curve(t) {
      var p = Math.max(0, Math.min(1, t)) * (profile.length - 1);
      var i = Math.min(Math.floor(p), profile.length - 2), u = p - i;
      var a = profile[Math.max(i - 1, 0)], b = profile[i];
      var c = profile[i + 1], d = profile[Math.min(i + 2, profile.length - 1)];
      return [0, 1].map(function (axis) {
        return 0.5 * (2 * b[axis] + (-a[axis] + c[axis]) * u +
          (2 * a[axis] - 5 * b[axis] + 4 * c[axis] - d[axis]) * u * u +
          (-a[axis] + 3 * b[axis] - 3 * c[axis] + d[axis]) * u * u * u);
      });
    }
    function point(t, angle) {
      var section = curve(t), radius = section[0];
      var spout = Math.pow(Math.max(Math.cos(angle + 0.58), 0), 16);
      var extension = 1 + 0.19 * spout * Math.pow(radius, 3);
      return [radius * Math.cos(angle) * extension,
        section[1] + 0.012 * Math.sin(angle * 3 + 0.5) * radius * radius,
        radius * Math.sin(angle) * extension * 0.79];
    }
    function vertex(position, normal, u, v, material) {
      vertices.push(position[0], position[1], position[2], normal[0], normal[1], normal[2], u, v, material);
    }
    for (var row = 0; row <= steps; row += 1) {
      var t = row / steps;
      for (var col = 0; col <= segments; col += 1) {
        var angle = col / segments * Math.PI * 2;
        var position = point(t, angle), normal;
        if (row === 0 || row === steps) normal = [0, row === 0 ? -1 : 1, 0];
        else {
          var before = point(t - 0.0001, angle), after = point(t + 0.0001, angle);
          var left = point(t, angle - 0.0001), right = point(t, angle + 0.0001);
          normal = normalize(cross(after.map(function (value, axis) { return value - before[axis]; }),
            right.map(function (value, axis) { return value - left[axis]; })));
        }
        vertex(position, normal, col / segments, 0.28 + 0.55 * Math.sin(t * Math.PI), 0);
        if (row < steps && col < segments) {
          var a = row * (segments + 1) + col, b = a + segments + 1;
          indices.push(a, a + 1, b, a + 1, b + 1, b);
        }
      }
    }
    var oilStart = vertices.length / 9;
    vertex([0, 0.15, 0], [0, 1, 0], 0.5, 0.5, 1);
    for (var oil = 0; oil <= segments; oil += 1) {
      var theta = oil / segments * Math.PI * 2;
      var reach = 0.90 * (1 + 0.19 * Math.pow(Math.max(Math.cos(theta + 0.58), 0), 16) * Math.pow(0.90, 3));
      vertex([Math.cos(theta) * reach, 0.15, Math.sin(theta) * reach * 0.79], [0, 1, 0], oil / segments, 0.5, 1);
      if (oil < segments) indices.push(oilStart, oilStart + oil + 2, oilStart + oil + 1);
    }

    // A rounded cotton wick, darkening gently at the flame.
    var wickStart = vertices.length / 9, wickSteps = 18, wickSides = 12;
    for (var s = 0; s <= wickSteps; s += 1) {
      var along = s / wickSteps;
      var tangent = normalize([0.23, 0.155 + 0.025 * Math.PI * Math.cos(along * Math.PI), -0.105]);
      var side = normalize(cross(tangent, [0, 1, 0])), up = cross(side, tangent);
      var center = [0.78 + along * 0.23, 0.15 + along * 0.155 + 0.025 * Math.sin(along * Math.PI), -0.35 - along * 0.105];
      var radius = 0.026 * (1 - along * 0.16);
      for (var face = 0; face <= wickSides; face += 1) {
        var phase = face / wickSides * Math.PI * 2;
        var outward = side.map(function (value, axis) { return value * Math.cos(phase) + up[axis] * Math.sin(phase); });
        vertex(center.map(function (value, axis) { return value + outward[axis] * radius; }),
          outward, along, face / wickSides, along > 0.8 ? 2.2 : 2);
        if (s < wickSteps && face < wickSides) {
          var w = wickStart + s * (wickSides + 1) + face, next = w + wickSides + 1;
          indices.push(w, next, w + 1, next, next + 1, w + 1);
        }
      }
    }

    var opaqueCount = indices.length, flameStart = vertices.length / 9;
    // Extra space around the luminous silhouette allows its soft halo to fade out.
    vertex([-0.255, -0.045, 0.03], [0, 0, 1], 0, 0, 3);
    vertex([0.255, -0.045, 0.03], [0, 0, 1], 1, 0, 3);
    vertex([-0.255, 0.755, 0.03], [0, 0, 1], 0, 1, 3);
    vertex([0.255, 0.755, 0.03], [0, 0, 1], 1, 1, 3);
    indices.push(flameStart, flameStart + 1, flameStart + 2, flameStart + 1, flameStart + 3, flameStart + 2);
    return { vertices: new Float32Array(vertices), indices: new Uint16Array(indices), opaqueCount: opaqueCount };
  }

  function initialize() {
    var vertex, fragment;
    ready = false;
    try {
      vertex = shader(gl.VERTEX_SHADER, vertexSource);
      fragment = shader(gl.FRAGMENT_SHADER, fragmentSource);
      program = gl.createProgram();
      if (!program) throw new Error("Diya program unavailable");
      gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error("Diya link unavailable");
      gl.useProgram(program);
      var mesh = geometry();
      bodyCount = mesh.opaqueCount; flameCount = mesh.indices.length - bodyCount;
      vertexBuffer = gl.createBuffer(); indexBuffer = gl.createBuffer();
      if (!vertexBuffer || !indexBuffer) throw new Error("Diya buffer unavailable");
      gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer); gl.bufferData(gl.ARRAY_BUFFER, mesh.vertices, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);
      ["aPosition", "aNormal", "aSurface"].forEach(function (name, index) {
        var attribute = gl.getAttribLocation(program, name);
        gl.enableVertexAttribArray(attribute); gl.vertexAttribPointer(attribute, 3, gl.FLOAT, false, 36, index * 12);
      });
      uniforms = {
        model: gl.getUniformLocation(program, "uModel"),
        projection: gl.getUniformLocation(program, "uProjection"),
        flame: gl.getUniformLocation(program, "uFlameOrigin"), time: gl.getUniformLocation(program, "uTime")
      };
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.clearColor(0, 0, 0, 0);
      ready = true;
      return true;
    } catch (error) {
      if (program) gl.deleteProgram(program);
      if (vertexBuffer) gl.deleteBuffer(vertexBuffer);
      if (indexBuffer) gl.deleteBuffer(indexBuffer);
      visual.classList.remove("is-rendered");
      return false;
    } finally {
      if (vertex) gl.deleteShader(vertex);
      if (fragment) gl.deleteShader(fragment);
    }
  }

  function draw() {
    if (contextLost || !ready || !width || !height) return;
    var x = 0.45 + current.y * 0.025, y = current.x * 0.065;
    var a = rotate([1, 0, 0], x, y), b = rotate([0, 1, 0], x, y), c = rotate([0, 0, 1], x, y);
    var model = new Float32Array([
      a[0], a[1], a[2], 0, b[0], b[1], b[2], 0, c[0], c[1], c[2], 0,
      -0.04, -0.47, -4.6, 1
    ]);
    var aspect = width / height, f = 1 / Math.tan(38 * Math.PI / 360);
    if (aspect < 1) f *= aspect;
    var near = 0.1, far = 20;
    var projection = new Float32Array([
      f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0,
      (far + near) / (near - far), -1, 0, 0, 2 * far * near / (near - far), 0
    ]);
    gl.viewport(0, 0, canvas.width, canvas.height); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.uniformMatrix4fv(uniforms.model, false, model); gl.uniformMatrix4fv(uniforms.projection, false, projection);
    gl.uniform3fv(uniforms.flame, flameOrigin); gl.uniform1f(uniforms.time, reduced ? 0 : elapsed);
    gl.disable(gl.BLEND); gl.depthMask(true);
    gl.drawElements(gl.TRIANGLES, bodyCount, gl.UNSIGNED_SHORT, 0);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.drawElements(gl.TRIANGLES, flameCount, gl.UNSIGNED_SHORT, bodyCount * 2);
    gl.depthMask(true);
    if (!gl.isContextLost()) visual.classList.add("is-rendered");
  }
  function stop() {
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0; previous = null;
  }
  function tick(now) {
    frame = 0;
    if (reduced || paused || !visible || document.hidden || contextLost || !ready || !width || !height) return;
    if (previous === null || now - previous >= 1000 / 30) {
      var delta = previous === null ? 1 / 30 : Math.min((now - previous) / 1000, 0.1);
      previous = now; elapsed += delta;
      var smoothing = 1 - Math.exp(-delta * 5);
      current.x += (pointer.x - current.x) * smoothing; current.y += (pointer.y - current.y) * smoothing;
      draw();
    }
    frame = window.requestAnimationFrame(tick);
  }
  function start() {
    if (contextLost || !ready || !visible || document.hidden || !width || !height) return;
    if (reduced || paused) { draw(); return; }
    if (!frame) frame = window.requestAnimationFrame(tick);
  }
  function resize() {
    var bounds = canvas.getBoundingClientRect();
    width = bounds.width; height = bounds.height;
    if (!width || !height) { stop(); return; }
    var ratio = Math.min(window.devicePixelRatio || 1, 1.6);
    var pixelWidth = Math.max(1, Math.round(width * ratio)), pixelHeight = Math.max(1, Math.round(height * ratio));
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) { canvas.width = pixelWidth; canvas.height = pixelHeight; }
    if (!document.hidden && visible) draw();
    start();
  }
  if (!initialize()) return;
  resize();
  if ("ResizeObserver" in window) new ResizeObserver(resize).observe(visual);
  else window.addEventListener("resize", resize, { passive: true });

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible) start(); else stop();
    }, { rootMargin: "60px" }).observe(canvas);
  }
  hero.addEventListener("pointermove", function (event) {
    if (reduced || paused || !finePointer.matches || !visible) return;
    var bounds = hero.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    pointer.x = Math.max(-1, Math.min(1, (event.clientX - bounds.left) / bounds.width * 2 - 1));
    pointer.y = Math.max(-1, Math.min(1, (event.clientY - bounds.top) / bounds.height * 2 - 1));
  }, { passive: true });
  hero.addEventListener("pointerleave", function () { pointer.x = 0; pointer.y = 0; });
  document.addEventListener("visibilitychange", function () { if (document.hidden) stop(); else start(); });
  document.addEventListener("motion-preference-change", function (event) {
    paused = Boolean(event.detail && event.detail.paused); stop(); start();
  });
  function motionChange(event) {
    reduced = event.matches; stop();
    if (reduced) { current.x = 0; current.y = 0; pointer.x = 0; pointer.y = 0; }
    start();
  }
  if (preference.addEventListener) preference.addEventListener("change", motionChange);
  else preference.addListener(motionChange);
  canvas.addEventListener("webglcontextlost", function (event) {
    event.preventDefault(); contextLost = true; ready = false;
    visual.classList.remove("is-rendered"); stop();
  });
  canvas.addEventListener("webglcontextrestored", function () {
    contextLost = false;
    if (initialize()) { resize(); start(); } else contextLost = true;
  });
  start();
}());
