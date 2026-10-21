/* ==========================================================================
   Opening sequence — black, then an aperture tears open and the page arrives.

   Read frame-by-frame off the reference recording (8fps through the reveal):

     1. Black. The wordmark fades up, small, off-centre.
     2. An aperture opens from a point — NOT a circle. Its edge is ragged and
        organic, and that edge is a dense band of bright granular particles.
     3. The aperture expands past the viewport in roughly 0.6s while the rim
        thins and breaks up.
     4. What is revealed is zoomed in, and pulls back to its resting scale
        over about another second.

   The ragged edge is the whole tell — a plain radial-gradient mask reads as a
   camera iris and misses it completely. Here the radius is modulated by summed
   sines at several angular frequencies, and the sparkle is particles spawned
   along the edge in proportion to how fast it is growing.
   ========================================================================== */
(function () {
  "use strict";

  var root = document.documentElement;
  var motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");

  window.Intro = {
    /* Returns a promise that settles when the page should be live. */
    play: function (opts) {
      opts = opts || {};
      var host = document.querySelector(".intro");
      // Too late for a cinematic opening: if the scripts took this long, the
      // visitor has already been looking at black for five seconds. Show the
      // page instead. (index.html also lifts the curtain by CSS at six.)
      var late = performance.now() > 5000;
      if (!host || motionPreference.matches || root.classList.contains("motion-paused") || document.hidden || late) {
        if (host) host.remove();
        root.classList.remove("intro-armed");
        return Promise.resolve(0);
      }

      var canvas = host.querySelector("canvas");
      var mark = host.querySelector(".intro__mark");
      var ctx = null;
      try { ctx = canvas && canvas.getContext("2d"); } catch (err) { /* use the finished page */ }
      if (!ctx) {
        host.remove();
        root.classList.remove("intro-armed");
        return Promise.resolve(0);
      }

      var W = 0, H = 0, dpr = 1, maxR = 0;
      function size() {
        W = window.innerWidth; H = window.innerHeight;
        cx = W * 0.42; cy = H * 0.46;
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
        canvas.style.width = W + "px";
        canvas.style.height = H + "px";
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        // far corner from the origin, so the hole always clears the viewport
        maxR = Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy)) * 1.06;
      }

      // The aperture opens a little left of centre and above the middle,
      // the way the reference does — dead centre reads as a shutter.
      var cx = window.innerWidth * 0.42;
      var cy = window.innerHeight * 0.46;
      size();
      window.addEventListener("resize", size);

      /* --- the ragged edge ------------------------------------------------
         Four angular harmonics with different rates. One or two reads as an
         egg; five or more averages back out into a circle. */
      var seed = Math.random() * 1000;
      function edge(a, r, t) {
        var k = 1
          + 0.150 * Math.sin(a * 3 + seed + t * 0.7)
          + 0.095 * Math.sin(a * 5 - seed * 1.7 - t * 0.9)
          + 0.055 * Math.sin(a * 9 + seed * 0.3 + t * 1.6)
          + 0.030 * Math.sin(a * 17 - t * 2.2);
        return r * k;
      }

      var STEPS = 132;
      function tracePath(r, t) {
        ctx.beginPath();
        for (var i = 0; i <= STEPS; i++) {
          var a = (i / STEPS) * Math.PI * 2;
          var rr = edge(a, r, t);
          var x = cx + Math.cos(a) * rr;
          var y = cy + Math.sin(a) * rr;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
      }

      /* --- the sparkle ---------------------------------------------------- */
      var grains = [];
      function spawn(r, t, growth) {
        // density follows how fast the edge is travelling, so the rim is
        // brightest while it is opening and dies as it slows
        var n = Math.min(90, Math.round(growth * 0.42));
        for (var i = 0; i < n; i++) {
          var a = Math.random() * Math.PI * 2;
          var rr = edge(a, r, t) + (Math.random() - 0.5) * 14;
          var out = 26 + Math.random() * 150;
          grains.push({
            x: cx + Math.cos(a) * rr,
            y: cy + Math.sin(a) * rr,
            vx: Math.cos(a) * out + (Math.random() - 0.5) * 40,
            vy: Math.sin(a) * out + (Math.random() - 0.5) * 40,
            life: 0.22 + Math.random() * 0.5,
            age: 0,
            s: 0.5 + Math.random() * 1.9,
            warm: Math.random() < 0.32
          });
        }
      }

      function drawGrains(dt) {
        ctx.globalCompositeOperation = "lighter";
        for (var i = grains.length - 1; i >= 0; i--) {
          var g = grains[i];
          g.age += dt;
          if (g.age >= g.life) { grains.splice(i, 1); continue; }
          g.x += g.vx * dt; g.y += g.vy * dt;
          g.vx *= 0.94; g.vy *= 0.94;
          var k = 1 - g.age / g.life;
          ctx.globalAlpha = k * k * 0.95;
          ctx.fillStyle = g.warm ? "#FFE9C4" : "#FFFFFF";
          ctx.fillRect(g.x, g.y, g.s, g.s);
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
      }

      /* --- timeline -------------------------------------------------------
         markIn → hold → aperture opens → mark out → curtain gone */
      var T_MARK   = 0.70;
      var T_HOLD   = 0.55;
      var T_OPEN   = 1.15;
      var start    = T_MARK + T_HOLD;
      var total    = start + T_OPEN + 0.18;

      var easeOut = function (x) { return 1 - Math.pow(1 - x, 3); };
      var prevR = 0;
      var live = false;

      return new Promise(function (resolve) {
        var t0 = performance.now();
        var last = t0;
        var released = false;
        var finished = false;
        var raf = 0;
        var watchdog = 0;

        // Tell the page to start its own entrance as the aperture clears
        function release() {
          if (released) return;
          released = true;
          resolve(0);
        }

        function finish() {
          if (finished) return;
          finished = true;
          cancelAnimationFrame(raf);
          window.clearTimeout(watchdog);
          window.removeEventListener("resize", size);
          window.removeEventListener("pagehide", finish);
          document.removeEventListener("visibilitychange", onVisibilityChange);
          document.removeEventListener("motion-preference-change", onMotionPause);
          if (motionPreference.removeEventListener) motionPreference.removeEventListener("change", onMotionChange);
          else motionPreference.removeListener(onMotionChange);
          host.remove();
          root.classList.remove("intro-armed");
          release();
        }

        function onMotionChange(event) {
          if (event.matches) finish();
        }

        function onVisibilityChange() {
          if (document.hidden) finish();
        }

        function onMotionPause(event) {
          if (event.detail && event.detail.paused) finish();
        }

        function frame(now) {
          raf = 0;
          if (finished) return;
          if (motionPreference.matches || root.classList.contains("motion-paused") || document.hidden) { finish(); return; }
          var t = (now - t0) / 1000;
          var dt = Math.min(0.05, (now - last) / 1000);
          last = now;

          ctx.clearRect(0, 0, W, H);

          // The wordmark rides its own little curve
          if (mark) {
            var mi = Math.min(1, t / T_MARK);
            var mo = t < start + T_OPEN * 0.34 ? 1
                   : 1 - Math.min(1, (t - (start + T_OPEN * 0.34)) / 0.42);
            mark.style.opacity = (easeOut(mi) * mo).toFixed(3);
            mark.style.transform = "translateY(" + ((1 - easeOut(mi)) * 10).toFixed(2) + "px)";
          }

          // Black curtain with a hole punched through it
          ctx.fillStyle = "#0B0B07";
          ctx.fillRect(0, 0, W, H);

          // The canvas is opaque now, so the CSS black that covered the page
          // from the first paint (index.html) can hand over to it.
          if (!live) {
            host.classList.add("is-live");
            live = true;
          }

          var r = 0;
          if (t > start) {
            var p = Math.min(1, (t - start) / T_OPEN);
            r = easeOut(p) * maxR;
            ctx.globalCompositeOperation = "destination-out";
            tracePath(r, t);
            ctx.fill();
            ctx.globalCompositeOperation = "source-over";

            var growth = Math.max(0, r - prevR) / Math.max(dt, 0.001) * dt;
            spawn(r, t, growth);
            prevR = r;

            // Release early, so the pull-back runs UNDERNEATH the opening
            // rather than starting after it. Both references have the revealed
            // content already moving by the time you can see it.
            if (p > 0.30) release();
          }

          drawGrains(dt);

          if (t < total || grains.length) {
            raf = requestAnimationFrame(frame);
          } else {
            finish();
          }
        }
        if (motionPreference.addEventListener) motionPreference.addEventListener("change", onMotionChange);
        else motionPreference.addListener(onMotionChange);
        document.addEventListener("visibilitychange", onVisibilityChange);
        document.addEventListener("motion-preference-change", onMotionPause);
        window.addEventListener("pagehide", finish);
        // Covers suspended/throttled frames and canvas failures during playback.
        watchdog = window.setTimeout(finish, Math.ceil((total + 0.8) * 1000));
        raf = requestAnimationFrame(frame);
      });
    }
  };
})();
