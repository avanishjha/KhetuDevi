/* ==========================================================================
   Khetu Devi Memorial Trust — motion layer

   Restrained on purpose. The reference this was rebuilt against carries itself
   on scale, weight and space, not on effects. Lenis is the only smooth-scroll
   engine; under prefers-reduced-motion, or if GSAP fails, `.no-motion` renders
   every final state and nothing stays hidden.
   ========================================================================== */
(function () {
  "use strict";

  var root = document.documentElement;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hasGSAP = typeof window.gsap !== "undefined" && typeof window.ScrollTrigger !== "undefined";
  var gsap = window.gsap, ST = window.ScrollTrigger;
  var lenis = null;

  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

  /* ------------------------------------------------------------ Photos --- */
  /* A plate keeps its designed frame until a real photograph loads. */
  function initPhotos() {
    document.querySelectorAll(".plate").forEach(function (plate) {
      var img = plate.querySelector("img");
      if (!img) return;
      var ok = function () { plate.classList.add("is-loaded"); };
      if (img.complete && img.naturalWidth > 0) ok();
      else {
        img.addEventListener("load", ok, { once: true });
        img.addEventListener("error", function () { img.remove(); }, { once: true });
      }
    });
  }

  /* --------------------------------------------------------------- Nav --- */
  function initNav() {
    var nav = document.querySelector(".nav");
    var toggle = document.querySelector(".nav__toggle");
    var links = Array.prototype.slice.call(document.querySelectorAll(".nav__link"));
    if (!nav) return;

    var onScroll = function () { nav.classList.toggle("is-stuck", window.scrollY > 24); };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    if (toggle) {
      toggle.addEventListener("click", function () {
        var open = nav.classList.toggle("is-open");
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
        toggle.textContent = open ? "Close" : "Menu";
      });
    }
    links.forEach(function (l) {
      l.addEventListener("click", function () {
        if (!nav.classList.contains("is-open")) return;
        nav.classList.remove("is-open");
        if (toggle) { toggle.setAttribute("aria-expanded", "false"); toggle.textContent = "Menu"; }
      });
    });

    var targets = links.map(function (l) {
      var id = l.getAttribute("href");
      return id && id.charAt(0) === "#" ? document.querySelector(id) : null;
    }).filter(Boolean);
    if (!targets.length || !("IntersectionObserver" in window)) return;

    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        links.forEach(function (l) {
          l.setAttribute("aria-current", l.getAttribute("href") === "#" + e.target.id ? "true" : "false");
        });
      });
    }, { rootMargin: "-45% 0px -50% 0px", threshold: 0 });
    targets.forEach(function (t) { spy.observe(t); });
  }

  /* ------------------------------------------------------ Smooth scroll -- */
  function initSmoothScroll() {
    if (reduced || typeof window.Lenis === "undefined") return;
    lenis = new window.Lenis({
      duration: 1.05,
      easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
      smoothWheel: true,
      touchMultiplier: 1.6
    });
    lenis.on("scroll", ST.update);
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);

    document.querySelectorAll('a[href^="#"]').forEach(function (a) {
      a.addEventListener("click", function (e) {
        var id = a.getAttribute("href");
        if (!id || id === "#") return;
        var t = document.querySelector(id);
        if (!t) return;
        e.preventDefault();
        lenis.scrollTo(t, { offset: -60 });
      });
    });
  }

  /* --------------------------------------------------- Masked reveals ---- */
  function escapeHTML(v) {
    return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }
  function splitMasked(el) {
    if (el.dataset.revealReady === "true") return;
    var text = el.textContent.replace(/\s+/g, " ").trim();
    el.setAttribute("aria-label", text);
    el.innerHTML = text.split(/(\s+)/).map(function (p) {
      if (!p.trim()) return p;
      return '<span class="word-mask" aria-hidden="true"><span class="word">' +
             escapeHTML(p) + "</span></span>";
    }).join("");
    el.dataset.revealReady = "true";
    el.classList.add("is-split");
  }

  function initReveals() {
    document.querySelectorAll("[data-reveal]:not(.hero__title)").forEach(function (el) {
      splitMasked(el);
      gsap.set(el, { autoAlpha: 1 });
      gsap.fromTo(el.querySelectorAll(".word"), { yPercent: 108 }, {
        yPercent: 0, duration: .95, ease: "power3.out", stagger: .03,
        scrollTrigger: { trigger: el, start: "top 88%", once: true }
      });
    });

    ST.batch(".rise", {
      start: "top 92%", once: true,
      onEnter: function (b) {
        gsap.to(b, { opacity: 1, y: 0, duration: .7, ease: "power2.out", stagger: .06, overwrite: true });
      }
    });
  }

  /* ------------------------------------------ scroll-scrubbed-word-reveal */
  /* TreeWalker so inline markup keeps its semantics. */
  function splitScrub(container) {
    var walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        var p = n.parentElement;
        if (!p || p.closest("[data-no-split], script, style")) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    var words = [];
    nodes.forEach(function (node) {
      var frag = document.createDocumentFragment();
      node.nodeValue.split(/(\s+)/).forEach(function (part) {
        if (!part) return;
        if (!part.trim()) { frag.appendChild(document.createTextNode(part)); return; }
        var s = document.createElement("span");
        s.className = "scrub-word";
        s.textContent = part;
        frag.appendChild(s);
        words.push(s);
      });
      node.parentNode.replaceChild(frag, node);
    });
    return words;
  }

  function initScrubbedText() {
    document.querySelectorAll("[data-scrub]").forEach(function (el) {
      var words = splitScrub(el);
      if (!words.length) return;
      var n = words.length;
      var apply = function (progress) {
        var head = progress * (n + 4);
        for (var i = 0; i < n; i++) {
          words[i].style.setProperty("--word-progress", clamp((head - i) / 3, 0, 1));
        }
      };
      if (reduced || !hasGSAP) { apply(1); return; }
      apply(0);
      ST.create({
        trigger: el, start: "top 84%", end: "bottom 58%", scrub: .5,
        onUpdate: function (s) { apply(s.progress); },
        onLeave: function () { apply(1); },
        invalidateOnRefresh: true
      });
    });
  }

  /* ------------------------------------------ scroll-progress-timeline --- */
  function initRoute() {
    document.querySelectorAll("[data-route]").forEach(function (route) {
      var fill = route.querySelector("[data-route-fill]");
      var steps = Array.prototype.slice.call(route.querySelectorAll(".step"));
      if (!fill || !steps.length) return;

      if (reduced || !hasGSAP) {
        fill.style.transform = "scaleY(1)";
        steps.forEach(function (s) { s.classList.add("is-on"); });
        return;
      }
      ST.create({
        trigger: route, start: "top 70%", end: "bottom 78%", scrub: .55,
        invalidateOnRefresh: true,
        onUpdate: function (self) {
          fill.style.transform = "scaleY(" + self.progress.toFixed(4) + ")";
          var head = self.progress * steps.length;
          steps.forEach(function (s, i) { s.classList.toggle("is-on", head >= i + 0.35); });
        }
      });
    });
  }

  /* ------------------------------------------------------------- Intro --- */
  function initIntro() {
    var hero = document.querySelector(".hero");
    if (!hero) return;
    var title = hero.querySelector(".hero__title");
    if (title) { splitMasked(title); gsap.set(title, { autoAlpha: 1 }); }

    var tl = gsap.timeline({ defaults: { ease: "power3.out" } });
    if (title) {
      tl.fromTo(title.querySelectorAll(".word"), { yPercent: 110 },
        { yPercent: 0, duration: 1.05, stagger: .05 }, 0.1);
    }
    tl.from(hero.querySelector(".hero__deva"), { opacity: 0, duration: .7 }, 0);
    tl.from(hero.querySelector(".hero__foot"), { opacity: 0, y: 18, duration: .8 }, 0.55);

    gsap.delayedCall(6, function () { if (tl.progress() < 1) tl.progress(1); });
  }

  /* --------------------------------------------------------------- Boot -- */
  function boot() {
    initPhotos();
    initNav();

    if (!hasGSAP || reduced) {
      root.classList.add("no-motion");
      initRoute();
      initScrubbedText();
      return;
    }

    root.classList.add("motion-ready");
    gsap.registerPlugin(ST);

    initSmoothScroll();
    initIntro();
    initReveals();
    initScrubbedText();
    initRoute();

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { ST.refresh(); });
    }
    window.addEventListener("load", function () { ST.refresh(); });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
