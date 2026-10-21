/* Khetu Devi Memorial Trust — progressive, reversible motion.
   Content remains readable without animation libraries. Decorative effects
   settle when paused or when the visitor changes their motion preference. */
(function () {
  "use strict";

  var root = document.documentElement;
  var motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
  var reduced = motionPreference.matches, userPaused = false;
  var hasGSAP = typeof window.gsap !== "undefined" && typeof window.ScrollTrigger !== "undefined";
  var gsap = window.gsap, ST = window.ScrollTrigger;
  var lenis = null, motionContext = null, motionActive = false;
  var cleanups = [], introStarted = false;

  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function watch(query, callback) {
    if (query.addEventListener) query.addEventListener("change", callback);
    else query.addListener(callback);
  }

  function initPhotos() {
    document.querySelectorAll(".plate").forEach(function (plate) {
      var img = plate.querySelector("img");
      if (!img || !img.getAttribute("src")) return;
      var ok = function () { plate.classList.add("is-loaded"); };
      if (img.complete && img.naturalWidth > 0) ok();
      else {
        img.addEventListener("load", ok, { once: true });
        img.addEventListener("error", function () { img.remove(); }, { once: true });
      }
    });
  }

  /* The mobile panel is inert while closed, including for keyboard users. */
  function initNav() {
    var nav = document.querySelector(".nav");
    var toggle = document.querySelector(".nav__toggle");
    var panel = document.querySelector(".nav__links");
    var links = Array.prototype.slice.call(document.querySelectorAll(".nav__link"));
    var mobile = window.matchMedia("(max-width: 860px)");
    if (!nav) return;
    var onScroll = function () { nav.classList.toggle("is-stuck", window.scrollY > 24); };
    var setOpen = function (open) {
      nav.classList.toggle("is-open", open);
      if (toggle) {
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
        toggle.textContent = open ? "Close" : "Menu";
      }
      if (panel) panel.inert = mobile.matches && !open;
    };
    onScroll();
    setOpen(false);
    window.addEventListener("scroll", onScroll, { passive: true });
    watch(mobile, function () { setOpen(false); });
    if (toggle) toggle.addEventListener("click", function () {
      setOpen(!nav.classList.contains("is-open"));
    });
    links.forEach(function (link) { link.addEventListener("click", function () { setOpen(false); }); });
    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape" || !nav.classList.contains("is-open")) return;
      setOpen(false);
      if (toggle) toggle.focus();
    });
    document.addEventListener("pointerdown", function (event) {
      if (!nav.contains(event.target)) setOpen(false);
    });
    nav.addEventListener("focusout", function (event) {
      if (event.relatedTarget && !nav.contains(event.relatedTarget)) setOpen(false);
    });

    var targets = links.map(function (link) {
      return document.getElementById((link.getAttribute("href") || "").slice(1));
    }).filter(Boolean);
    if (!targets.length || !("IntersectionObserver" in window)) return;
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        links.forEach(function (link) {
          link.setAttribute("aria-current", link.getAttribute("href") === "#" + entry.target.id ? "true" : "false");
        });
      });
    }, { rootMargin: "-45% 0px -50% 0px", threshold: 0 });
    targets.forEach(function (target) { spy.observe(target); });
  }

  function focusTarget(target) {
    var temporaryTabIndex = !target.hasAttribute("tabindex");
    if (temporaryTabIndex) target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
    if (temporaryTabIndex) target.addEventListener("blur", function () {
      target.removeAttribute("tabindex");
    }, { once: true });
  }

  function initAnchors() {
    document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
      anchor.addEventListener("click", function (event) {
        if (!lenis || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        var hash = anchor.getAttribute("href");
        if (!hash || hash === "#") return;
        var target = document.getElementById(decodeURIComponent(hash.slice(1)));
        if (!target) return;
        event.preventDefault();
        if (window.location.hash !== hash) window.history.pushState(null, "", hash);
        var nav = document.querySelector(".nav");
        lenis.scrollTo(target, {
          offset: -(nav ? nav.offsetHeight + 20 : 80),
          onComplete: function () { focusTarget(target); }
        });
      });
    });
  }

  function initSmoothScroll() {
    if (typeof window.Lenis === "undefined") return;
    lenis = new window.Lenis({
      duration: 1.05,
      easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
      smoothWheel: true, touchMultiplier: 1.6
    });
    lenis.on("scroll", ST.update);
    var ticker = function (time) { if (lenis) lenis.raf(time * 1000); };
    gsap.ticker.add(ticker);
    cleanups.push(function () {
      gsap.ticker.remove(ticker);
      if (lenis) lenis.destroy();
      lenis = null;
    });
  }

  function escapeHTML(value) {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }
  function splitMasked(element) {
    if (element.dataset.revealReady === "true") return;
    var text = element.textContent.replace(/\s+/g, " ").trim();
    element.setAttribute("aria-label", text);
    element.innerHTML = text.split(/(\s+)/).map(function (part) {
      if (!part.trim()) return part;
      return '<span class="word-mask" aria-hidden="true"><span class="word">' + escapeHTML(part) + "</span></span>";
    }).join("");
    element.dataset.revealReady = "true";
    element.classList.add("is-split");
  }

  function initReveals() {
    document.querySelectorAll("[data-reveal]:not(.hero__title)").forEach(function (element) {
      splitMasked(element);
      gsap.set(element, { autoAlpha: 1 });
      gsap.fromTo(element.querySelectorAll(".word"), { yPercent: 108 }, {
        yPercent: 0, duration: .95, ease: "power3.out", stagger: .03,
        scrollTrigger: { trigger: element, start: "top 88%", once: true }
      });
    });
    document.querySelectorAll(".rise:not(.service-card)").forEach(function (element) {
      gsap.fromTo(element, { opacity: 0, y: 26 }, {
        opacity: 1, y: 0, duration: .85, ease: "power3.out",
        scrollTrigger: { trigger: element, start: "top 92%", once: true }
      });
    });
  }

  /* TreeWalker retains inline emphasis. Reuse spans after preference changes. */
  function splitScrub(container) {
    var existing = container.querySelectorAll(".scrub-word");
    if (existing.length) return Array.prototype.slice.call(existing);
    var walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        var parent = node.parentElement;
        return !parent || parent.closest("[data-no-split], script, style") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      }
    });
    var nodes = [], words = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function (node) {
      var fragment = document.createDocumentFragment();
      node.nodeValue.split(/(\s+)/).forEach(function (part) {
        if (!part) return;
        if (!part.trim()) { fragment.appendChild(document.createTextNode(part)); return; }
        var word = document.createElement("span");
        word.className = "scrub-word";
        word.textContent = part;
        fragment.appendChild(word);
        words.push(word);
      });
      node.parentNode.replaceChild(fragment, node);
    });
    return words;
  }

  function initScrubbedText() {
    document.querySelectorAll("[data-scrub]").forEach(function (element) {
      var words = splitScrub(element);
      if (!words.length) return;
      var apply = function (progress) {
        var head = progress * (words.length + 4);
        words.forEach(function (word, index) {
          word.style.setProperty("--word-progress", clamp((head - index) / 3, 0, 1));
        });
      };
      if (!motionActive) { apply(1); return; }
      apply(0);
      ST.create({
        trigger: element, start: "top 84%", end: "bottom 58%",
        onUpdate: function (self) { apply(self.progress); },
        onRefresh: function (self) { apply(self.progress); },
        onLeave: function () { apply(1); }, invalidateOnRefresh: true
      });
    });
  }

  function initRoute() {
    document.querySelectorAll("[data-route]").forEach(function (route) {
      var fill = route.querySelector("[data-route-fill]");
      var steps = Array.prototype.slice.call(route.querySelectorAll(".step"));
      if (!fill || !steps.length) return;
      function apply(progress) {
        fill.style.transform = "scaleY(" + progress.toFixed(4) + ")";
        steps.forEach(function (step, index) { step.classList.toggle("is-on", progress * steps.length >= index + .35); });
      }
      if (!motionActive) { apply(1); return; }
      apply(0);
      ST.create({
        trigger: route, start: "top 70%", end: "bottom 78%", invalidateOnRefresh: true,
        onUpdate: function (self) { apply(self.progress); },
        onRefresh: function (self) { apply(self.progress); }
      });
    });
  }

  function initScrollScenes() {
    var hero = document.querySelector(".hero");
    var visual = document.querySelector(".hero__visual");
    if (hero && visual) gsap.fromTo(visual, { yPercent: 0 }, {
      yPercent: 5, ease: "none",
      scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: 1 }
    });
    document.querySelectorAll(".memory-art").forEach(function (art) {
      gsap.fromTo(art, { scale: .86, rotationX: 14, y: 45, transformPerspective: 1200 }, {
        scale: 1, rotationX: 0, y: 0, ease: "none",
        scrollTrigger: { trigger: art, start: "top 95%", end: "center 55%", scrub: .8 }
      });
    });
    document.querySelectorAll(".service-card").forEach(function (card, index) {
      gsap.fromTo(card, { opacity: 0, y: 58, rotationX: 7, transformPerspective: 1000 }, {
        opacity: 1, y: 0, rotationX: 0, duration: 1,
        delay: window.innerWidth > 720 ? (index % 3) * .12 : 0, ease: "power3.out",
        scrollTrigger: { trigger: card, start: "top 92%", once: true }
      });
    });
    document.querySelectorAll(".values-ribbon__track").forEach(function (track) {
      gsap.fromTo(track, { xPercent: 0 }, {
        xPercent: -15, ease: "none",
        scrollTrigger: { trigger: track.parentElement, start: "top bottom", end: "bottom top", scrub: 1 }
      });
    });
    document.querySelectorAll(".book-object").forEach(function (book) {
      gsap.fromTo(book, { rotationY: -22, rotationZ: -5, transformPerspective: 1000 }, {
        rotationY: -8, rotationZ: 2, ease: "none",
        scrollTrigger: { trigger: book.parentElement, start: "top bottom", end: "bottom top", scrub: 1 }
      });
    });
  }

  /* Pointer work runs only over visible artwork and stops when settled. */
  function initParallax() {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    var hero = document.querySelector(".hero");
    if (!hero) return;
    var layers = Array.prototype.slice.call(hero.querySelectorAll(".par[data-depth]"));
    if (!layers.length) return;
    var tx = 0, ty = 0, cx = 0, cy = 0, frame = 0, visible = true;
    function step() {
      frame = 0;
      if (!visible || document.hidden) return;
      cx += (tx - cx) * .075;
      cy += (ty - cy) * .075;
      layers.forEach(function (layer) {
        var depth = parseFloat(layer.getAttribute("data-depth")) || 0;
        layer.style.transform = "translate3d(" + (-cx * depth).toFixed(2) + "px," + (-cy * depth * .5).toFixed(2) + "px,0)";
      });
      if (Math.abs(tx - cx) > .001 || Math.abs(ty - cy) > .001) frame = requestAnimationFrame(step);
    }
    function move(event) {
      if (!visible || document.hidden) return;
      var rect = hero.getBoundingClientRect();
      tx = clamp((event.clientX - rect.left) / rect.width - .5, -.5, .5) * 2;
      ty = clamp((event.clientY - rect.top) / rect.height - .5, -.5, .5) * 2;
      if (!frame) frame = requestAnimationFrame(step);
    }
    function reset() {
      cancelAnimationFrame(frame); frame = 0;
      tx = ty = cx = cy = 0;
      layers.forEach(function (layer) { layer.style.removeProperty("transform"); });
    }
    function leave() { tx = ty = 0; if (!frame && visible) frame = requestAnimationFrame(step); }
    function visibility() { if (document.hidden) reset(); }
    var observer = "IntersectionObserver" in window ? new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (!visible) reset();
    }) : null;
    if (observer) observer.observe(hero);
    hero.addEventListener("pointermove", move, { passive: true });
    hero.addEventListener("pointerleave", leave);
    window.addEventListener("blur", reset);
    document.addEventListener("visibilitychange", visibility);
    cleanups.push(function () {
      reset();
      if (observer) observer.disconnect();
      hero.removeEventListener("pointermove", move);
      hero.removeEventListener("pointerleave", leave);
      window.removeEventListener("blur", reset);
      document.removeEventListener("visibilitychange", visibility);
    });
  }

  function initCardTilt() {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    document.querySelectorAll(".service-card").forEach(function (card) {
      var art = card.querySelector(".service-card__art");
      if (!art) return;
      var frame = 0, x = 0, y = 0;
      function apply() {
        frame = 0;
        art.style.transform = "perspective(800px) rotateX(" + (-y * 7).toFixed(2) + "deg) rotateY(" + (x * 9).toFixed(2) + "deg)";
      }
      function move(event) {
        var rect = card.getBoundingClientRect();
        x = clamp((event.clientX - rect.left) / rect.width - .5, -.5, .5) * 2;
        y = clamp((event.clientY - rect.top) / rect.height - .5, -.5, .5) * 2;
        if (!frame) frame = requestAnimationFrame(apply);
      }
      function reset() { cancelAnimationFrame(frame); frame = 0; art.style.removeProperty("transform"); }
      card.addEventListener("pointermove", move, { passive: true });
      card.addEventListener("pointerleave", reset);
      card.addEventListener("pointercancel", reset);
      cleanups.push(function () {
        reset();
        card.removeEventListener("pointermove", move);
        card.removeEventListener("pointerleave", reset);
        card.removeEventListener("pointercancel", reset);
      });
    });
  }

  /* A functional position indicator also works in the static experience. */
  function initReadingProgress() {
    var progress = document.querySelector(".reading-progress");
    if (!progress) return;
    var frame = 0;
    function update() {
      frame = 0;
      var distance = root.scrollHeight - window.innerHeight;
      progress.style.transform = "scaleX(" + (distance > 0 ? clamp(window.scrollY / distance, 0, 1) : 1) + ")";
    }
    function schedule() { if (!frame) frame = requestAnimationFrame(update); }
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    window.addEventListener("load", schedule, { once: true });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
    update();
  }

  function raise() {
    root.classList.add("intro-done");
    root.classList.remove("intro-armed");
    if (lenis) lenis.start();
    if (motionActive) ST.refresh();
  }

  function setMotion() {
    reduced = motionPreference.matches;
    var paused = reduced || userPaused;
    root.classList.toggle("motion-paused", paused);
    document.querySelectorAll(".motion-toggle").forEach(function (button) {
      button.hidden = reduced;
      button.disabled = reduced;
      button.setAttribute("aria-pressed", userPaused ? "true" : "false");
      button.textContent = userPaused ? "Resume motion" : "Pause motion";
    });
    document.dispatchEvent(new CustomEvent("motion-preference-change", { detail: { paused: paused } }));
    motionActive = false;
    cleanups.forEach(function (cleanup) { cleanup(); });
    cleanups = [];
    if (motionContext) { motionContext.revert(); motionContext = null; }

    if (!hasGSAP || paused) {
      root.classList.add("no-motion");
      root.classList.remove("motion-ready");
      var curtain = document.querySelector(".intro");
      if (curtain) curtain.remove();
      raise();
      initRoute();
      initScrubbedText();
      return;
    }

    root.classList.remove("no-motion");
    root.classList.add("motion-ready");
    motionActive = true;
    motionContext = gsap.context(function () {
      initSmoothScroll();
      initParallax();
      initReveals();
      initScrubbedText();
      initRoute();
      initScrollScenes();
      initCardTilt();
    });
    if (!introStarted && !root.classList.contains("intro-done") && window.Intro) {
      introStarted = true;
      if (lenis) lenis.stop();
      try { Promise.resolve(window.Intro.play()).then(raise, raise); }
      catch (error) { raise(); }
      window.setTimeout(raise, 4000);
    } else {
      raise();
    }
  }

  function boot() {
    initPhotos();
    initNav();
    initAnchors();
    initReadingProgress();
    document.querySelectorAll(".motion-toggle").forEach(function (button) {
      button.addEventListener("click", function () { userPaused = !userPaused; setMotion(); });
    });
    if (hasGSAP) gsap.registerPlugin(ST);
    setMotion();
    watch(motionPreference, setMotion);
    var refresh = function () { if (motionActive) ST.refresh(); };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(refresh);
    window.addEventListener("load", refresh, { once: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
