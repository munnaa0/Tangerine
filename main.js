import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

import { Starfield } from "./Starfield.js";
import { Planet } from "./Planet.js";
import { CometSystem } from "./CometSystem.js";
import { MouseTrail } from "./MouseTrail.js";
import { Nebula } from "./Nebula.js";

class CosmosApp {
  constructor() {
    this.container = document.getElementById("webgl-canvas");
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    this.quality = this.createQualityProfile();
    this.targetFrameInterval = 1 / this.quality.targetFps;
    this.lastFrameTime = 0;
    this.smoothedFps = this.quality.targetFps;
    this.lastQualityCheckTime = 0;
    this.dynamicPixelRatio = this.quality.initialPixelRatio;

    this.initScene();
    this.initPostProcessing();
    this.initObjects();
    this.addEventListeners();

    this.clock = new THREE.Clock();
    this.isCosmicMotionStarted = false;
    this.motionStartTime = 0;
    this.animate();
  }

  createQualityProfile() {
    const isMobile =
      window.matchMedia("(max-width: 900px)").matches ||
      "ontouchstart" in window;
    const cores = navigator.hardwareConcurrency || 4;
    const memory = navigator.deviceMemory || 4;

    const lowEnd = isMobile || cores <= 4 || memory <= 4;

    return {
      targetFps: 60,
      initialPixelRatio: Math.min(
        window.devicePixelRatio || 1,
        lowEnd ? 1.25 : 1.75,
      ),
      minPixelRatio: lowEnd ? 0.9 : 1.0,
      maxPixelRatio: Math.min(window.devicePixelRatio || 1, lowEnd ? 1.35 : 2),
      lowFpsThreshold: lowEnd ? 26 : 42,
      highFpsThreshold: lowEnd ? 40 : 57,
      qualityCheckInterval: 2.0,
    };
  }

  initScene() {
    this.scene = new THREE.Scene();
    // A tiny bit of fog to blend the deepest stars
    this.scene.fog = new THREE.FogExp2(0x030308, 0.0005);

    this.camera = new THREE.PerspectiveCamera(
      60,
      this.width / this.height,
      0.1,
      2000,
    );
    this.camera.position.set(0, 0, 100);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.container,
      antialias: true,
      powerPreference: "high-performance",
    });

    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(this.dynamicPixelRatio);
    this.renderer.toneMapping = THREE.ReinhardToneMapping; // Better colors with HDR bloom
    this.renderer.toneMappingExposure = 1.2;
  }

  initPostProcessing() {
    this.composer = new EffectComposer(this.renderer);

    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    // Add UnrealBloomPass for that cinematic sci-fi glow
    const resolution = new THREE.Vector2(this.width, this.height);
    const bloomPass = new UnrealBloomPass(resolution, 1.5, 0.4, 0.85);

    bloomPass.threshold = 0.6; // Higher threshold so diffuse planet surface doesn't bloom, but bright stars do
    bloomPass.strength = 1.0; // Slightly reduced overall intensity
    bloomPass.radius = 0.6; // Spread of the glow

    this.composer.addPass(bloomPass);
  }

  initObjects() {
    // Deep background nebula clouds
    this.nebula = new Nebula(this.scene);

    // Deep background stars (15,000 particles)
    this.starfield = new Starfield(this.scene, 15000);

    // Main orbiting Earth-like planet (radius 40)
    this.planet = new Planet(this.scene, 40, new THREE.Vector3(80, 10, -120));

    // Background comets system
    this.comets = new CometSystem(this.scene);

    // Interactive mouse trailing particles
    this.mouseTrail = new MouseTrail(this.scene, this.camera);
  }

  addEventListeners() {
    window.addEventListener("resize", this.onWindowResize.bind(this));
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        this.lastFrameTime = this.clock.getElapsedTime();
      }
    });
  }

  onWindowResize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(this.width, this.height);
    this.composer.setSize(this.width, this.height);
    this.applyPixelRatio(this.dynamicPixelRatio);
  }

  applyPixelRatio(nextRatio) {
    const clamped = Math.min(
      this.quality.maxPixelRatio,
      Math.max(this.quality.minPixelRatio, nextRatio),
    );

    if (Math.abs(clamped - this.dynamicPixelRatio) < 0.05) return;

    this.dynamicPixelRatio = clamped;
    this.renderer.setPixelRatio(this.dynamicPixelRatio);
    this.renderer.setSize(this.width, this.height, false);
    this.composer.setPixelRatio(this.dynamicPixelRatio);
    this.composer.setSize(this.width, this.height);
  }

  updateAdaptiveQuality(delta, elapsedTime) {
    if (!Number.isFinite(delta) || delta <= 0) return;

    const instantFps = 1 / delta;
    this.smoothedFps = THREE.MathUtils.lerp(this.smoothedFps, instantFps, 0.08);

    if (
      elapsedTime - this.lastQualityCheckTime <
      this.quality.qualityCheckInterval
    ) {
      return;
    }

    this.lastQualityCheckTime = elapsedTime;

    if (this.smoothedFps < this.quality.lowFpsThreshold) {
      this.applyPixelRatio(this.dynamicPixelRatio - 0.1);
    } else if (this.smoothedFps > this.quality.highFpsThreshold) {
      this.applyPixelRatio(this.dynamicPixelRatio + 0.05);
    }
  }

  startCosmicMotion() {
    if (this.isCosmicMotionStarted) return;
    this.motionStartTime = this.clock.getElapsedTime();
    this.isCosmicMotionStarted = true;
  }

  animate() {
    requestAnimationFrame(this.animate.bind(this));

    if (document.hidden) return;

    const now = this.clock.getElapsedTime();

    if (this.lastFrameTime === 0) {
      this.lastFrameTime = now;
      return;
    }

    const elapsed = now - this.lastFrameTime;
    if (elapsed < this.targetFrameInterval) return;

    this.lastFrameTime = now;

    this.updateAdaptiveQuality(elapsed, now);

    const rawTime = now;
    const motionTime = this.isCosmicMotionStarted
      ? rawTime - this.motionStartTime
      : 0;

    // Update systems
    if (this.nebula) this.nebula.update(motionTime);
    if (this.starfield) this.starfield.update(motionTime);
    if (this.planet) this.planet.update(motionTime);
    if (this.comets) this.comets.update(motionTime);
    if (this.mouseTrail) this.mouseTrail.update();

    // Use Composer instead of Renderer directly to apply Bloom
    this.composer.render();
  }
}

// Initialize application on load
window.onload = () => {
  const app = new CosmosApp();

  // Intro Animation Logic
  const overlay = document.getElementById("intro-overlay");
  const instruction = document.getElementById("intro-instruction");
  const countdownEl = document.getElementById("countdown");
  const candleWrapper = document.getElementById("candle-wrapper");
  const candlePrompt = document.getElementById("candle-prompt");
  const birthdayText = document.getElementById("happy-birthday-text");
  const blowBtn = document.getElementById("blow-candle-btn");
  const bgm = document.getElementById("bgm");
  const originalBirthdayText = birthdayText
    ? birthdayText.textContent.trim()
    : "";

  const mobileBirthdayMedia = window.matchMedia("(max-width: 430px)");

  function formatBirthdayTextForViewport() {
    if (!birthdayText || !originalBirthdayText) return;

    if (mobileBirthdayMedia.matches) {
      if (birthdayText.dataset.mobileFormatted === "1") return;

      const match = originalBirthdayText.match(/^(Happy\s+Birthday)\s+(.+)$/i);
      if (match) {
        birthdayText.innerHTML =
          '<span class="hb-mobile-line">' +
          match[1] +
          "</span><br>" +
          '<span class="hb-mobile-line">' +
          match[2] +
          "</span>";
        birthdayText.dataset.mobileFormatted = "1";
      }
    } else if (birthdayText.dataset.mobileFormatted === "1") {
      birthdayText.textContent = originalBirthdayText;
      delete birthdayText.dataset.mobileFormatted;
    }
  }

  formatBirthdayTextForViewport();
  if (typeof mobileBirthdayMedia.addEventListener === "function") {
    mobileBirthdayMedia.addEventListener(
      "change",
      formatBirthdayTextForViewport,
    );
  } else if (typeof mobileBirthdayMedia.addListener === "function") {
    mobileBirthdayMedia.addListener(formatBirthdayTextForViewport);
  }

  // Called after the user clicks "Blow the Candle"
  function triggerBlowSequence() {
    app.startCosmicMotion();

    blowBtn.style.display = "none";
    candlePrompt.style.transition = "opacity 0.4s";
    candlePrompt.style.opacity = "0";

    // Play audio — allowed here because it's inside a user-gesture handler
    if (bgm) {
      bgm.volume = 0;
      bgm.loop = true;
      bgm
        .play()
        .then(() => {
          let vol = 0;
          const fadeAudio = setInterval(() => {
            if (vol < 0.5) {
              vol += 0.05;
              bgm.volume = Math.min(vol, 0.5);
            } else {
              clearInterval(fadeAudio);
            }
          }, 200);
        })
        .catch((err) =>
          console.log("Audio playback blocked by browser policies:", err),
        );
    }

    // Blow the candle
    candleWrapper.classList.add("hidden");

    // Fade out overlay background to reveal the planet behind the text
    overlay.classList.add("fade-bg");
    overlay.style.backgroundColor = "transparent"; // Keep in case it was used

    // Show Happy Birthday text
    birthdayText.classList.add("show");

    // Trigger constellation after a short pause
    setTimeout(() => {
      if (app.starfield) {
        app.starfield.formConstellation();
      }
    }, 1500);

    // Fade out the whole overlay
    setTimeout(() => {
      overlay.classList.add("fade-out");

      // Reveal the scrollable story layer once the overlay has faded (~1.5 s transition)
      setTimeout(() => {
        const scrollWrapper = document.getElementById("scroll-wrapper");
        if (scrollWrapper) scrollWrapper.classList.add("visible");
      }, 1600);
    }, 4500);
  }

  blowBtn.addEventListener("click", triggerBlowSequence);

  // ── Gift Box Interaction ───────────────────────────────────────────────────
  const giftBox = document.querySelector(".gift-box");
  const giftBoxWrapper = document.querySelector(".gift-box-wrapper");
  const giftMsg = document.querySelector(".gift-message");
  const giftHint = document.querySelector(".gift-hint");
  const heartBurst = document.querySelector(".heart-burst");

  if (giftBox) {
    function openGift() {
      if (giftBox.classList.contains("open")) return;
      giftBox.classList.add("open");
      giftBox.setAttribute("aria-pressed", "true");

      if (giftHint) {
        giftHint.style.opacity = "0";
        giftHint.style.pointerEvents = "none";
      }

      if (heartBurst) heartBurst.classList.add("active");

      // Once the lid has flipped (~700 ms), collapse the box and reveal the
      // message simultaneously so the text appears in the envelope's place
      setTimeout(() => {
        if (giftBoxWrapper) giftBoxWrapper.classList.add("collapse");
        if (giftMsg) {
          giftMsg.classList.add("show");
          giftMsg.setAttribute("aria-hidden", "false");
        }
        // After the gift message is visible, reveal the love letter section
        setTimeout(revealLetterSection, 1500);
      }, 800);
    }

    giftBox.addEventListener("click", openGift);
    giftBox.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openGift();
      }
    });
  }
  // ──────────────────────────────────────────────────────────────────────────

  // ── Love Letter Section ──────────────────────────────────────────────────
  const letterSection = document.getElementById("section-letter");
  const letterCard = document.getElementById("letter-card");
  const letterContentWrapper = document.getElementById(
    "letter-content-wrapper",
  );
  const waxSealBtn = document.getElementById("wax-seal-btn");
  const letterTiltContainer = document.getElementById("letter-tilt-container");
  const scrollWrapper = document.getElementById("scroll-wrapper");
  let letterAnimated = false;

  // Wrap every word inside letter text elements with a span for animation
  function wrapLetterWords() {
    if (!letterCard) return;
    const els = letterCard.querySelectorAll(
      ".letter-greeting, .letter-para, .letter-signoff",
    );
    els.forEach((el) => {
      const words = el.textContent.split(/\s+/).filter((w) => w.length > 0);
      el.innerHTML = words
        .map((w) => '<span class="letter-word">' + w + "</span>")
        .join("");
    });
  }

  // Animate words one-by-one
  function animateLetterText() {
    if (!letterCard) return Promise.resolve();
    const words = letterCard.querySelectorAll(".letter-word");
    const revealDelay = 110;
    let index = 0;

    const lineHeightRaw = letterContentWrapper
      ? parseFloat(window.getComputedStyle(letterContentWrapper).lineHeight)
      : NaN;
    const bottomBufferPx = Number.isFinite(lineHeightRaw)
      ? Math.max(16, Math.round(lineHeightRaw))
      : 24;

    function advanceForWord(wordEl) {
      if (!letterContentWrapper) return;
      if (!letterContentWrapper.classList.contains("long-letter-auto")) return;

      const wordBottom = wordEl.offsetTop + wordEl.offsetHeight;
      const viewportBottom =
        letterContentWrapper.scrollTop + letterContentWrapper.clientHeight;
      const triggerBottom = viewportBottom - bottomBufferPx;

      // Start scrolling as soon as the revealed text reaches the last visible line.
      if (wordBottom > triggerBottom) {
        const nextScrollTop =
          wordBottom - (letterContentWrapper.clientHeight - bottomBufferPx);
        letterContentWrapper.scrollTop = Math.max(
          letterContentWrapper.scrollTop,
          nextScrollTop,
        );
      }
    }

    return new Promise((resolve) => {
      const revealNext = () => {
        if (index >= words.length) {
          resolve();
          return;
        }

        const word = words[index];
        word.classList.add("revealed");
        advanceForWord(word);
        index += 1;
        setTimeout(revealNext, revealDelay);
      };

      revealNext();
    });
  }

  function setMainScrollLock(locked) {
    if (!scrollWrapper) return;

    if (locked) {
      if (scrollWrapper.dataset.prevOverflowY === undefined) {
        scrollWrapper.dataset.prevOverflowY =
          scrollWrapper.style.overflowY || "";
      }
      scrollWrapper.style.overflowY = "hidden";
      return;
    }

    const previousOverflow = scrollWrapper.dataset.prevOverflowY;
    if (previousOverflow !== undefined) {
      scrollWrapper.style.overflowY = previousOverflow;
      delete scrollWrapper.dataset.prevOverflowY;
    } else {
      scrollWrapper.style.overflowY = "";
    }
  }

  function prepareLongLetterFlow() {
    if (!letterContentWrapper) return false;

    letterContentWrapper.scrollTop = 0;
    letterContentWrapper.classList.remove(
      "long-letter-auto",
      "manual-scroll-enabled",
    );

    const overflowDistance =
      letterContentWrapper.scrollHeight - letterContentWrapper.clientHeight;

    if (overflowDistance < 2) {
      return false;
    }

    letterContentWrapper.classList.add("long-letter-auto");
    setMainScrollLock(true);
    return true;
  }

  function finishLongLetterAutoScroll() {
    if (!letterContentWrapper) return Promise.resolve();
    if (!letterContentWrapper.classList.contains("long-letter-auto")) {
      return Promise.resolve();
    }

    const totalOverflow = Math.max(
      0,
      letterContentWrapper.scrollHeight - letterContentWrapper.clientHeight,
    );
    const remainingDistance = Math.max(
      0,
      totalOverflow - letterContentWrapper.scrollTop,
    );

    if (remainingDistance < 2) {
      letterContentWrapper.classList.remove("long-letter-auto");
      letterContentWrapper.classList.add("manual-scroll-enabled");
      setMainScrollLock(false);
      return Promise.resolve();
    }

    const pxPerSecond = 52;
    const durationMs = Math.max(
      900,
      Math.min(6000, (remainingDistance / pxPerSecond) * 1000),
    );
    const startTop = letterContentWrapper.scrollTop;

    return new Promise((resolve) => {
      const startTime = performance.now();

      const tick = (now) => {
        const progress = Math.min(1, (now - startTime) / durationMs);
        // Ease-out for a cleaner finish at the end of the letter.
        const eased = 1 - Math.pow(1 - progress, 2);
        letterContentWrapper.scrollTop = startTop + remainingDistance * eased;

        if (progress < 1) {
          requestAnimationFrame(tick);
          return;
        }

        letterContentWrapper.classList.remove("long-letter-auto");
        letterContentWrapper.classList.add("manual-scroll-enabled");
        setMainScrollLock(false);
        resolve();
      };

      requestAnimationFrame(tick);
    });
  }

  function revealPostLetterSections() {
    const countdownSection = document.getElementById("section-countdown");
    if (countdownSection) countdownSection.classList.add("revealed");

    // Reveal Our Story section 2 seconds after countdown is revealed
    setTimeout(() => {
      const storySection = document.getElementById("section-story");
      if (storySection) {
        storySection.classList.add("revealed");
        initStory();

        setTimeout(() => {
          const gallerySection = document.getElementById("section-gallery");
          if (gallerySection) {
            gallerySection.classList.add("revealed");
            initGallery();

            // Reveal the wish section only after gallery reveal finishes,
            // then wait an additional 2 seconds.
            const galleryRevealDurationMs = 1200;
            const wishRevealDelayMs = 2000;
            setTimeout(() => {
              const wishSection = document.getElementById("section-wish");
              if (wishSection) {
                wishSection.classList.add("revealed");
              }
            }, galleryRevealDurationMs + wishRevealDelayMs);
          }
        }, 1700);
      }
    }, 2000);
  }

  function applyLetterViewportLock() {
    if (!letterCard || !letterContentWrapper) return;

    const viewportCap = Math.min(window.innerHeight * 0.72, 520);
    const computed = window.getComputedStyle(letterCard);
    const padTop = parseFloat(computed.paddingTop) || 0;
    const padBottom = parseFloat(computed.paddingBottom) || 0;
    const contentHeight = Math.max(
      220,
      Math.floor(viewportCap - padTop - padBottom),
    );

    letterCard.style.maxHeight = Math.floor(viewportCap) + "px";
    letterContentWrapper.style.maxHeight = contentHeight + "px";
  }

  // Prepare word spans immediately
  wrapLetterWords();

  // Premium Feature: Wax Seal Interaction & Reveal
  function handleWaxSealClick() {
    if (letterAnimated) return;
    letterAnimated = true;

    // Break seal visually
    waxSealBtn.classList.add("broken");

    // Unlock card and trigger text reveals via JS typewriter
    setTimeout(() => {
      letterCard.classList.remove("locked");
      applyLetterViewportLock();
      prepareLongLetterFlow();

      animateLetterText().then(() => {
        finishLongLetterAutoScroll().then(() => {
          revealPostLetterSections();
        });
      });
    }, 600);
  }

  if (waxSealBtn) {
    waxSealBtn.addEventListener("click", handleWaxSealClick);
  }

  // Premium Feature 5: 3D Tilt Effect on Hover
  if (letterTiltContainer && letterCard) {
    letterTiltContainer.addEventListener("mousemove", (e) => {
      // Don't tilt if locked (optional, but let's keep it cool anyway)
      const rect = letterTiltContainer.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const rotateX = ((y - centerY) / centerY) * -4; // Max 4 degrees
      const rotateY = ((x - centerX) / centerX) * 4;

      letterCard.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
    });

    letterTiltContainer.addEventListener("mouseleave", () => {
      letterCard.style.transform = `perspective(1000px) rotateX(0) rotateY(0) scale3d(1, 1, 1)`;
    });
  }

  // Reveal the letter section setup on scroll
  function revealLetterSection() {
    if (!letterSection) return;
    letterSection.classList.add("revealed");
    // No scroll-triggered auto opening anymore, user must click seal
    const scrollHint = document.getElementById("letter-scroll-hint");
    if (scrollHint) scrollHint.classList.add("visible");
  }

  // Golden sparkle trail on letter card hover
  let lastSparkle = 0;
  if (letterCard) {
    letterCard.addEventListener("mousemove", (e) => {
      const now = Date.now();
      if (now - lastSparkle < 50) return;
      lastSparkle = now;
      const rect = letterCard.getBoundingClientRect();
      const sparkle = document.createElement("div");
      sparkle.className = "sparkle";
      sparkle.style.left = e.clientX - rect.left + "px";
      sparkle.style.top = e.clientY - rect.top + "px";
      letterCard.appendChild(sparkle);
      setTimeout(() => sparkle.remove(), 800);
    });
  }
  // ──────────────────────────────────────────────────────────────────────────

  // ── Countdown / Relationship Timer ───────────────────────────────────────
  (function initCountdown() {
    const startDate = new Date(2018, 0, 24, 0, 0, 0);
    const CIRCUMFERENCE = 2 * Math.PI * 54; // r=54 in the SVG

    const ids = [
      "cd-years",
      "cd-months",
      "cd-days",
      "cd-hours",
      "cd-minutes",
      "cd-seconds",
    ];
    const els = {};
    ids.forEach((id) => {
      els[id] = document.getElementById(id);
    });

    // Bail out if countdown section is missing
    if (!els["cd-years"]) return;

    const cards = document.querySelectorAll(".countdown-card");
    const particleContainer = document.getElementById("countdown-particles");
    let prevValues = {};

    // ── FEATURE 2: Update progress ring dashoffset ─────────────────
    function setRingProgress(card, value, max) {
      const ring = card.querySelector(".progress-ring__fill");
      if (!ring) return;
      const progress = Math.min(value / max, 1);
      const offset = CIRCUMFERENCE * (1 - progress);
      ring.style.strokeDasharray = CIRCUMFERENCE;
      ring.style.strokeDashoffset = offset;
    }

    // ── FEATURE 3: Cosmic particle burst ───────────────────────────
    function emitParticles(card) {
      if (!particleContainer) return;
      const rect = card.getBoundingClientRect();
      const sectionRect = particleContainer.getBoundingClientRect();
      const cx = rect.left - sectionRect.left + rect.width / 2;
      const cy = rect.top - sectionRect.top + rect.height / 2;
      const colors = ["#d4af37", "#ffd1dc", "#fff2cc", "#b76e79", "#f0d68a"];

      for (let i = 0; i < 8; i++) {
        const p = document.createElement("div");
        p.className = "cd-particle";
        const angle = (Math.PI * 2 * i) / 8;
        const dist = 40 + Math.random() * 50;
        p.style.setProperty("--dx", Math.cos(angle) * dist + "px");
        p.style.setProperty("--dy", Math.sin(angle) * dist + "px");
        p.style.left = cx + "px";
        p.style.top = cy + "px";
        p.style.background = colors[Math.floor(Math.random() * colors.length)];
        p.style.boxShadow = "0 0 4px " + p.style.background;
        particleContainer.appendChild(p);
        p.addEventListener("animationend", () => p.remove());
      }
    }

    // ── Core update ────────────────────────────────────────────────
    function update() {
      const now = new Date();
      let years = now.getFullYear() - startDate.getFullYear();
      let months = now.getMonth() - startDate.getMonth();
      let days = now.getDate() - startDate.getDate();
      let hours = now.getHours() - startDate.getHours();
      let minutes = now.getMinutes() - startDate.getMinutes();
      let seconds = now.getSeconds() - startDate.getSeconds();

      if (seconds < 0) {
        seconds += 60;
        minutes -= 1;
      }
      if (minutes < 0) {
        minutes += 60;
        hours -= 1;
      }
      if (hours < 0) {
        hours += 24;
        days -= 1;
      }
      if (days < 0) {
        const prevMonthDays = new Date(
          now.getFullYear(),
          now.getMonth(),
          0,
        ).getDate();
        days += prevMonthDays;
        months -= 1;
      }
      if (months < 0) {
        months += 12;
        years -= 1;
      }

      const vals = {
        "cd-years": years,
        "cd-months": months,
        "cd-days": days,
        "cd-hours": hours,
        "cd-minutes": minutes,
        "cd-seconds": seconds,
      };

      // Update each value element
      Object.entries(vals).forEach(([id, val]) => {
        const el = els[id];
        if (!el) return;
        const display =
          id === "cd-hours" || id === "cd-minutes" || id === "cd-seconds"
            ? String(val).padStart(2, "0")
            : String(val);

        if (prevValues[id] !== val) {
          el.textContent = display;
          // FEATURE 1: Digit roller animation
          el.classList.remove("tick");
          void el.offsetWidth; // force reflow
          el.classList.add("tick");
        }
      });

      // Update progress rings (FEATURE 2)
      cards.forEach((card) => {
        const unit = card.dataset.unit;
        const max = parseInt(card.dataset.max, 10);
        const idKey = "cd-" + unit;
        if (vals[idKey] !== undefined) {
          setRingProgress(card, vals[idKey], max);
        }
      });

      // FEATURE 3: Particle burst on second change
      const secondsCard = document.querySelector(
        '.countdown-card[data-unit="seconds"]',
      );
      if (
        secondsCard &&
        prevValues["cd-seconds"] !== undefined &&
        prevValues["cd-seconds"] !== vals["cd-seconds"]
      ) {
        emitParticles(secondsCard);
        // Also pulse the seconds card
        secondsCard.classList.remove("pulse");
        void secondsCard.offsetWidth;
        secondsCard.classList.add("pulse");
      }

      prevValues = { ...vals };
    }

    update();
    setInterval(update, 1000);

    // ── FEATURE 5: Interactive 3D Tilt ──────────────────────────────
    cards.forEach((card) => {
      card.addEventListener("mouseenter", () =>
        card.classList.add("tilt-active"),
      );
      card.addEventListener("mouseleave", () => {
        card.classList.remove("tilt-active");
        card.style.transform = "";
      });
      card.addEventListener("mousemove", (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const rotateX = ((y - centerY) / centerY) * -8;
        const rotateY = ((x - centerX) / centerX) * 8;
        card.style.transform =
          "perspective(600px) rotateX(" +
          rotateX +
          "deg) rotateY(" +
          rotateY +
          "deg) scale(1.03)";
      });
    });
  })();
  // ──────────────────────────────────────────────────────────────────────────

  // ── Our Story Section ─────────────────────────────────────────────────────
  function initStory() {
    const scrollWrapper = document.getElementById("scroll-wrapper");
    const storyItems = document.querySelectorAll(".story-item");
    const storyCards = document.querySelectorAll(".story-card");

    // ── FEATURE 2: Typewriter animation for dates ────────────────────────────
    function runTypewriter(dateEl) {
      if (!dateEl || dateEl.dataset.twDone) return;
      dateEl.dataset.twDone = "1";
      const text = dateEl.dataset.tw || "";
      dateEl.textContent = "";
      dateEl.classList.add("typing");
      let i = 0;
      const speed = 55;
      const tick = setInterval(() => {
        dateEl.textContent += text[i];
        i++;
        if (i >= text.length) {
          clearInterval(tick);
          dateEl.classList.remove("typing");
        }
      }, speed);
    }

    // ── FEATURE 5: Entrance animation via IntersectionObserver ───────────────
    const entranceObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const item = entry.target;
            item.classList.add("animate-in");
            // Kick off typewriter for the date inside this item
            const dateEl = item.querySelector(".story-date[data-tw]");
            const delay = 420; // wait for card to slide in
            setTimeout(() => runTypewriter(dateEl), delay);
            entranceObserver.unobserve(item);
          }
        });
      },
      { root: scrollWrapper, threshold: 0.25 },
    );

    storyItems.forEach((item) => entranceObserver.observe(item));

    // ── FEATURE 1 (extended): Cursor sparkle trail on story cards ────────────
    let lastStorySparkle = 0;
    storyCards.forEach((card) => {
      const inner = card.querySelector(".story-card-inner");
      if (!inner) return;

      card.addEventListener("mousemove", (e) => {
        const now = Date.now();
        if (now - lastStorySparkle < 45) return;
        lastStorySparkle = now;
        const rect = inner.getBoundingClientRect();
        const sp = document.createElement("div");
        sp.className = "story-sparkle";
        const dx = (Math.random() - 0.5) * 20;
        const dy = -(8 + Math.random() * 16);
        sp.style.setProperty("--sx", dx + "px");
        sp.style.setProperty("--sy", dy + "px");
        sp.style.left = e.clientX - rect.left + "px";
        sp.style.top = e.clientY - rect.top + "px";
        inner.appendChild(sp);
        setTimeout(() => sp.remove(), 800);
      });

      // ── FEATURE 1: Keyboard / touch flip toggle ──────────────────────────
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          card.classList.toggle("flipped");
        }
      });

      // Touch devices: tap to flip instead of hover
      card.addEventListener("click", () => {
        // Only activate flip-on-click when hover is not available
        if (window.matchMedia("(hover: none)").matches) {
          card.classList.toggle("flipped");
        }
      });
    });

    // ── FEATURE 5: Floating ambient particles emitted from each card ─────────
    const ptclColors = ["#d4af37", "#fff2cc", "#b76e79", "#ffd1dc", "#c8a0e0"];

    function emitCardParticles(ptclContainer) {
      if (!ptclContainer) return;
      const rect = ptclContainer.getBoundingClientRect();
      if (rect.width === 0) return; // not visible yet
      for (let i = 0; i < 3; i++) {
        const dot = document.createElement("div");
        dot.className = "story-ptcl-dot";
        const startX = 10 + Math.random() * (rect.width - 20);
        const startY = 10 + Math.random() * (rect.height - 20);
        const dx = (Math.random() - 0.5) * 60;
        const dy = -(20 + Math.random() * 50);
        dot.style.left = startX + "px";
        dot.style.top = startY + "px";
        dot.style.setProperty("--ptcl-dx", dx + "px");
        dot.style.setProperty("--ptcl-dy", dy + "px");
        dot.style.background =
          ptclColors[Math.floor(Math.random() * ptclColors.length)];
        dot.style.boxShadow = "0 0 4px " + dot.style.background;
        ptclContainer.appendChild(dot);
        setTimeout(() => dot.remove(), 2900);
      }
    }

    // Track active particle intervals per card so we can start/stop them
    const cardParticleIntervals = new WeakMap();

    // Start the particle emitters for each card (staggered so they don't all
    // fire at the same moment and feels organic), but only while visible.
    const storyParticleCards = document.querySelectorAll(".story-item-ptcl");

    if (storyParticleCards.length > 0 && "IntersectionObserver" in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          const ptcl = entry.target;
          const idx = Array.prototype.indexOf.call(storyParticleCards, ptcl);
          if (idx === -1) {
            return;
          }
          const baseInterval = 2200 + idx * 300;

          if (entry.isIntersecting) {
            // Already has an active interval; do nothing
            if (cardParticleIntervals.has(ptcl)) {
              return;
            }

            // Stagger the start slightly as in the original code
            const startDelay = 600 + idx * 200;
            const startTimeout = setTimeout(() => {
              emitCardParticles(ptcl);
              const intervalId = setInterval(
                () => emitCardParticles(ptcl),
                baseInterval,
              );
              cardParticleIntervals.set(ptcl, { intervalId });
            }, startDelay);

            // Temporarily store timeout handle so we can cancel if it goes off-screen quickly
            cardParticleIntervals.set(ptcl, { timeoutId: startTimeout });
          } else {
            // No longer visible: clear any pending timeout and active interval
            const handles = cardParticleIntervals.get(ptcl);
            if (handles) {
              if (handles.timeoutId) {
                clearTimeout(handles.timeoutId);
              }
              if (handles.intervalId) {
                clearInterval(handles.intervalId);
              }
              cardParticleIntervals.delete(ptcl);
            }
          }
        });
      });

      storyParticleCards.forEach((ptcl) => observer.observe(ptcl));
    } else {
      // Fallback: preserve original always-on behavior if IntersectionObserver is unavailable
      storyParticleCards.forEach((ptcl, idx) => {
        const baseInterval = 2200 + idx * 300;
        setTimeout(
          () => {
            emitCardParticles(ptcl);
            const intervalId = setInterval(
              () => emitCardParticles(ptcl),
              baseInterval,
            );
            cardParticleIntervals.set(ptcl, { intervalId });
          },
          600 + idx * 200,
        );
      });
    }

    // ── Scroll-driven timeline line fill (bonus on top of CSS animation) ─────
    // Supplements the CSS animation with exact scroll position tracking
    const timeline = document.getElementById("story-timeline");
    const lineFill = document.getElementById("story-line-fill");

    if (timeline && lineFill && scrollWrapper) {
      const updateLine = () => {
        const tlRect = timeline.getBoundingClientRect();
        const wrapRect = scrollWrapper.getBoundingClientRect();
        // How far through the timeline has the viewport centre travelled
        const vpCentre = wrapRect.top + wrapRect.height / 2;
        const passed = vpCentre - tlRect.top;
        const pct = Math.max(0, Math.min(100, (passed / tlRect.height) * 100));
        // Only override once the CSS animation has finished (~5.3s) so they
        // don't fight; we detect this by checking if animation is done
        if (!lineFill.dataset.cssAnimDone) {
          // Let CSS animation run; mark done after its duration + delay
          setTimeout(() => {
            lineFill.dataset.cssAnimDone = "1";
          }, 5400);
        } else {
          lineFill.style.animation = "none";
          lineFill.style.height = pct + "%";
        }
      };
      scrollWrapper.addEventListener("scroll", updateLine, { passive: true });
      updateLine();
    }
  }
  // ── End Our Story Section ──────────────────────────────────────────────────

  // ── Our Gallery Section ────────────────────────────────────────────────────
  function initGallery() {
    const section = document.getElementById("section-gallery");
    const grid = document.getElementById("gallery-grid");
    if (!section || !grid || grid.dataset.ready === "1") return;
    grid.dataset.ready = "1";

    const items = [
      {
        src: "images/pic1.jpg",
        alt: "A sweet memory of us together",
        title: "Soft Beginnings",
        text: "The night felt quieter, but my heart felt louder with you.",
        r: -8,
        x: -15,
        y: -10, // Feature 1: Scattered rotation
      },
      {
        src: "images/pic1.jpg",
        alt: "A precious smile from our journey",
        title: "Held In Light",
        text: "You smiled once, and the whole evening turned golden.",
        r: 6,
        x: 10,
        y: 15,
      },
      {
        src: "images/pic1.jpg",
        alt: "A memory where we looked happiest",
        title: "Near, Even Far",
        text: "Distance kept our hands apart, never our souls.",
        r: -4,
        x: 5,
        y: 30,
      },
      {
        src: "images/pic1.jpg",
        alt: "A shared moment from our love story",
        title: "Quiet Magic",
        text: "In the smallest moments, you always feel like home.",
        r: 7,
        x: -10,
        y: 10,
      },
      {
        src: "images/pic1.jpg",
        alt: "A warm photo from one of our beautiful days",
        title: "Golden Hour Us",
        text: "Time slows down whenever your eyes find mine.",
        r: -12,
        x: 20,
        y: -5,
      },
      {
        src: "images/pic1.jpg",
        alt: "Another chapter of our shared memories",
        title: "Still Choosing You",
        text: "Every season changed, but my choice stayed the same.",
        r: 5,
        x: 0,
        y: -20,
      },
    ];

    grid.innerHTML = items
      .map(
        (item, idx) =>
          '<article class="gallery-item" style="--r: ' +
          item.r +
          "deg; --tx: " +
          item.x +
          "; --ty: " +
          item.y +
          ';" role="listitem" data-gallery-idx="' +
          idx +
          '">' +
          '<div class="gallery-tape"></div>' + // Feature 2: Washi Tape Element
          '<button class="gallery-card" type="button" aria-label="Open photo ' +
          (idx + 1) +
          ' in viewer">' +
          '<div class="gallery-figure">' +
          '<div class="gallery-glare"></div>' + // Feature 3: Specular Glare/Reflection
          '<img class="gallery-image" src="' +
          item.src +
          '" alt="' +
          item.alt +
          '" loading="lazy" decoding="async" fetchpriority="low" />' +
          "</div>" +
          '<div class="gallery-caption">' + // Showing caption below image on card
          '<h3 class="gallery-item-title">' +
          item.title +
          "</h3>" +
          '<p class="gallery-item-text">' +
          item.text +
          "</p>" +
          "</div>" +
          "</button>" +
          "</article>",
      )
      .join("");

    // Feature 5: Interactive 3D tilt and Parallax on hover across the gallery container
    section.addEventListener("mousemove", (e) => {
      const rect = section.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;

      const items = grid.querySelectorAll(".gallery-item");
      items.forEach((item, index) => {
        const factor = index % 2 === 0 ? 0.02 : -0.03; // Different speeds for different depths
        item.style.transform = `translate(${x * factor}px, ${y * factor}px)`;
      });
    });

    section.addEventListener("mouseleave", () => {
      const items = grid.querySelectorAll(".gallery-item");
      items.forEach((item) => {
        item.style.transform = `translate(0px, 0px)`; // Reset
      });
    });

    const itemWrappers = Array.from(grid.querySelectorAll(".gallery-item"));

    const lightbox = document.getElementById("gallery-lightbox");
    const backdrop = document.getElementById("gallery-lb-backdrop");
    const panel = lightbox?.querySelector(".gallery-lightbox-panel");
    const lbImage = document.getElementById("gallery-lb-image");
    const lbTitle = document.getElementById("gallery-lb-title");
    const lbText = document.getElementById("gallery-lb-text");

    if (!lightbox || !panel || !lbImage || !lbTitle || !lbText) {
      return;
    }

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let activeIndex = 0;
    let lastFocused = null;
    let touchStartX = 0;
    let touchStartY = 0;
    const imageReady = new Set();

    function markImageReady(src) {
      if (typeof src === "string" && src.length > 0) {
        imageReady.add(src);
      }
    }

    function warmImageCache() {
      items.forEach((item) => {
        const img = new Image();
        img.src = item.src;
        if (img.complete) {
          markImageReady(item.src);
          return;
        }
        img.addEventListener("load", () => markImageReady(item.src), {
          once: true,
        });
      });
    }

    warmImageCache();

    function preloadNeighbors(idx) {
      const prev = items[(idx - 1 + items.length) % items.length];
      const next = items[(idx + 1) % items.length];
      [prev, next].forEach((item) => {
        if (!item || imageReady.has(item.src)) return;
        const img = new Image();
        img.src = item.src;
        if (img.complete) {
          markImageReady(item.src);
        } else {
          img.addEventListener("load", () => markImageReady(item.src), {
            once: true,
          });
        }
      });
    }

    function updateLightbox(idx) {
      activeIndex = (idx + items.length) % items.length;
      const current = items[activeIndex];

      lbImage.style.opacity = "0";
      lbImage.style.transition = "opacity 0.28s ease";
      lbImage.src = current.src;
      lbImage.alt = current.alt;
      lbTitle.textContent = current.title;
      lbText.textContent = current.text;

      preloadNeighbors(activeIndex);

      if (!prefersReducedMotion && typeof lbImage.animate === "function") {
        lbImage.animate(
          [
            { transform: "scale(1.035)", opacity: 0.86 },
            { transform: "scale(1)", opacity: 1 },
          ],
          {
            duration: 420,
            easing: "cubic-bezier(0.22, 1, 0.36, 1)",
            fill: "both",
          },
        );
      }

      const reveal = () => {
        lbImage.style.opacity = "1";
      };

      if (lbImage.complete || imageReady.has(current.src)) {
        markImageReady(current.src);
        requestAnimationFrame(() => requestAnimationFrame(reveal));
      } else {
        lbImage.addEventListener(
          "load",
          () => {
            markImageReady(current.src);
            reveal();
          },
          { once: true },
        );
      }
    }

    function trapFocus(e) {
      if (e.key !== "Tab") return;
      const focusable = panel.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    function onGlobalKeyDown(e) {
      if (!lightbox.classList.contains("open")) return;
      if (e.key === "Escape") {
        closeLightbox();
      }
      if (e.key === "ArrowLeft") {
        updateLightbox(activeIndex - 1);
      }
      if (e.key === "ArrowRight") {
        updateLightbox(activeIndex + 1);
      }
      trapFocus(e);
    }

    function openLightbox(idx, triggerEl) {
      lastFocused = triggerEl || document.activeElement;
      lightbox.classList.add("open");
      lightbox.setAttribute("aria-hidden", "false");
      document.body.classList.add("gallery-lightbox-open");
      requestAnimationFrame(() => {
        updateLightbox(idx);
        panel.focus();
      });
      document.addEventListener("keydown", onGlobalKeyDown);
    }

    function closeLightbox() {
      lightbox.classList.remove("open");
      lightbox.setAttribute("aria-hidden", "true");
      document.body.classList.remove("gallery-lightbox-open");
      lbImage.style.transform = "";
      document.removeEventListener("keydown", onGlobalKeyDown);
      if (lastFocused && typeof lastFocused.focus === "function") {
        lastFocused.focus();
      }
    }

    itemWrappers.forEach((wrapper, idx) => {
      const button = wrapper.querySelector(".gallery-card");
      if (!button) return;

      button.addEventListener("click", () => openLightbox(idx, button));

      wrapper.addEventListener("mouseenter", () => {
        wrapper.classList.add("is-focused");
      });

      wrapper.addEventListener("mouseleave", () => {
        wrapper.classList.remove("is-focused");
        if (!prefersReducedMotion) {
          button.style.transform = "";
        }
      });

      button.addEventListener("focus", () =>
        wrapper.classList.add("is-focused"),
      );
      button.addEventListener("blur", () =>
        wrapper.classList.remove("is-focused"),
      );

      if (!prefersReducedMotion) {
        button.addEventListener("mousemove", (e) => {
          if (!window.matchMedia("(hover: hover)").matches) return;
          const rect = button.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          const rotateX = ((y - rect.height / 2) / rect.height) * -5;
          const rotateY = ((x - rect.width / 2) / rect.width) * 6;
          button.style.transform =
            "perspective(900px) rotateX(" +
            rotateX +
            "deg) rotateY(" +
            rotateY +
            "deg) translateY(-5px) scale(1.012)";
        });
      }
    });

    backdrop?.addEventListener("click", closeLightbox);
    // Allow clicking the panel (outside the image) to close as well
    panel.addEventListener("click", (e) => {
      // if click is exactly on panel or figure, but not the image/caption
      if (
        e.target === panel ||
        e.target.classList.contains("gallery-lb-figure")
      ) {
        closeLightbox();
      }
    });

    panel.addEventListener("touchstart", (e) => {
      const touch = e.changedTouches[0];
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
    });

    panel.addEventListener("touchend", (e) => {
      const touch = e.changedTouches[0];
      const dx = touch.clientX - touchStartX;
      const dy = touch.clientY - touchStartY;

      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) {
        if (dx > 0) {
          updateLightbox(activeIndex - 1);
        } else {
          updateLightbox(activeIndex + 1);
        }
      }
    });

    if (!prefersReducedMotion) {
      panel.addEventListener("mousemove", (e) => {
        if (!lightbox.classList.contains("open")) return;
        const rect = panel.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width - 0.5;
        const py = (e.clientY - rect.top) / rect.height - 0.5;
        lbImage.style.transform =
          "translate(" + px * 6 + "px," + py * 4 + "px) scale(1.005)";
      });

      panel.addEventListener("mouseleave", () => {
        lbImage.style.transform = "";
      });
    }
  }
  // ── End Our Gallery Section ────────────────────────────────────────────────

  // ── Make a Wish & Finale Section ───────────────────────────────────────────
  const wishBtn = document.getElementById("wish-btn");
  const wishInputContainer = document.querySelector(".wish-container");
  const wishInput = document.getElementById("wish-input");
  const finaleSection = document.getElementById("section-finale");

  const isMobileWishDevice = window.matchMedia(
    "(max-width: 768px), (pointer: coarse)",
  ).matches;

  const burstProfile = isMobileWishDevice
    ? {
        totalStars: 140,
        starsPerFrame: 28,
        minDuration: 1.8,
        maxDuration: 3.2,
        maxDelay: 2.8,
        minScale: 0.5,
        maxScale: 1.3,
        tx: "130vw",
        ty: "-130vh",
      }
    : {
        totalStars: 200,
        starsPerFrame: 40,
        minDuration: 2.0,
        maxDuration: 4.0,
        maxDelay: 3.5,
        minScale: 0.5,
        maxScale: 2.0,
        tx: "150vw",
        ty: "-150vh",
      };

  const burstStarPool = [];
  const burstColors = [
    "#ffffff", // white
    "#ffd700", // gold
    "#ff69b4", // pink
    "#00ffff", // cyan
    "#9370db", // purple
    "#ff4500", // orange
  ];

  function primeBurstPool() {
    while (burstStarPool.length < burstProfile.totalStars) {
      const star = document.createElement("div");
      star.className = "burst-star";
      burstStarPool.push(star);
    }
  }

  function hydrateBurstStar(star) {
    const startX = Math.random() * 120 - 20;
    const startY = Math.random() * 100 + 50;
    const duration =
      burstProfile.minDuration +
      Math.random() * (burstProfile.maxDuration - burstProfile.minDuration);
    const delay = Math.random() * burstProfile.maxDelay;
    const scale =
      burstProfile.minScale +
      Math.random() * (burstProfile.maxScale - burstProfile.minScale);

    star.classList.remove("active");
    star.style.setProperty("--sx", `${startX}vw`);
    star.style.setProperty("--sy", `${startY}vh`);
    star.style.setProperty("--tx", burstProfile.tx);
    star.style.setProperty("--ty", burstProfile.ty);
    star.style.setProperty("--s", `${scale}`);
    star.style.setProperty("--dur", `${duration}s`);
    star.style.setProperty("--delay", `${delay}s`);
    star.style.setProperty(
      "--c",
      burstColors[Math.floor(Math.random() * burstColors.length)],
    );
  }

  function createBurstFrameMonitor(sampleWindowMs = 1000) {
    let lastTs = 0;
    let startTs = 0;
    let rafId = 0;
    let samples = 0;
    let longFrames = 0;
    let reducedSuggested = false;
    let running = false;

    const onFrame = (ts) => {
      if (!running) return;

      if (!startTs) {
        startTs = ts;
        lastTs = ts;
      }

      const delta = ts - lastTs;
      lastTs = ts;

      // Ignore the first frame; detect sustained pacing issues afterwards.
      if (samples > 0 && delta > 22) {
        longFrames += 1;
      }
      samples += 1;

      if (ts - startTs < sampleWindowMs) {
        rafId = requestAnimationFrame(onFrame);
      } else {
        const longFrameRatio = longFrames / Math.max(samples - 1, 1);
        reducedSuggested = longFrameRatio >= 0.3;
        running = false;
      }
    };

    return {
      start() {
        if (running) return;
        running = true;
        rafId = requestAnimationFrame(onFrame);
      },
      stop() {
        if (!running) return;
        running = false;
        if (rafId) cancelAnimationFrame(rafId);
      },
      shouldReduce() {
        return reducedSuggested;
      },
    };
  }

  function launchWishBurst(burstContainer) {
    burstContainer.innerHTML = "";

    let runtimeTotalStars = burstProfile.totalStars;
    let runtimeStarsPerFrame = burstProfile.starsPerFrame;
    let reducedApplied = false;
    const frameMonitor = createBurstFrameMonitor(1000);
    frameMonitor.start();

    const appendBatch = (startIndex) => {
      if (!reducedApplied && frameMonitor.shouldReduce()) {
        // Dynamic downshift for low-end devices if pacing degrades.
        runtimeTotalStars = Math.max(
          Math.floor(burstProfile.totalStars * 0.72),
          80,
        );
        runtimeStarsPerFrame = Math.max(
          Math.floor(burstProfile.starsPerFrame * 0.6),
          12,
        );
        reducedApplied = true;
      }

      const fragment = document.createDocumentFragment();
      const activatedStars = [];
      const endIndex = Math.min(
        startIndex + runtimeStarsPerFrame,
        runtimeTotalStars,
      );

      for (let i = startIndex; i < endIndex; i++) {
        const star = burstStarPool[i];
        hydrateBurstStar(star);
        fragment.appendChild(star);
        activatedStars.push(star);
      }

      burstContainer.appendChild(fragment);

      requestAnimationFrame(() => {
        activatedStars.forEach((star) => star.classList.add("active"));
      });

      if (endIndex < runtimeTotalStars) {
        requestAnimationFrame(() => appendBatch(endIndex));
      } else {
        frameMonitor.stop();
      }
    };

    appendBatch(0);
  }

  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(() => primeBurstPool(), { timeout: 300 });
  } else {
    setTimeout(() => primeBurstPool(), 0);
  }

  if (wishBtn && wishInputContainer) {
    let wishSent = false;

    wishBtn.addEventListener("click", () => {
      // It's just visual, but let's make sure she typed something to make her feel it matters
      if (wishInput.value.trim() === "") {
        wishInput.focus();
        // Shake animation for empty input could go here
        return;
      }

      if (wishSent) return;
      wishSent = true;

      // Transition the box out
      wishInputContainer.classList.add("sent");
      const wishHeader = document.querySelector(".wish-header");
      const wishCosmicBg = document.querySelector(".wish-cosmic-bg");

      // We removed the inline opacity styles and added class lists instead
      if (wishHeader) wishHeader.classList.add("sent");
      if (wishCosmicBg) wishCosmicBg.classList.add("sent");

      const inputWrapper = document.getElementById("wish-input-wrapper");
      if (inputWrapper) inputWrapper.classList.add("sent");

      // Grand Meteor Shower Burst Effect in DOM
      const burstContainer = document.getElementById("wish-star-burst");
      if (burstContainer) {
        launchWishBurst(burstContainer);
      }

      // Trigger the main cosmic scene wish comet once (prevents the giant thick line issue)
      if (app.comets && typeof app.comets.spawnWishComet === "function") {
        app.comets.spawnWishComet();
      } else {
        console.log("Wish sent to the stars!");
      }

      // Reveal finale section exactly where the box was
      if (finaleSection) {
        setTimeout(() => {
          finaleSection.style.display = "flex";
          // Small delay to allow display flex to apply before adding class
          setTimeout(() => {
            finaleSection.classList.add("active");
            // Make footer accessible after finale starts
            const footer = finaleSection.querySelector(".story-footer");
            if (footer) footer.setAttribute("aria-hidden", "false");
          }, 50);
        }, 1200); // Trigger just as the box finishes imploding
      }
    });

    // We no longer need the IntersectionObserver for finale text, because we
    // manually trigger it visually upon clicking the wish button now.
  }

  let count = 3;
  const interval = setInterval(() => {
    count--;
    if (count > 0) {
      countdownEl.textContent = count;
    } else {
      clearInterval(interval);

      // Countdown finished — smoothly collapse instruction & countdown, show the button
      instruction.style.opacity = "0";
      instruction.style.maxHeight = "0";
      instruction.style.marginBottom = "0";
      countdownEl.style.opacity = "0";
      countdownEl.style.maxHeight = "0";
      countdownEl.style.marginBottom = "0";

      // Reveal the candle prompt and blow-candle button
      candlePrompt.classList.add("visible");
      blowBtn.classList.add("visible");
    }
  }, 1000);
};
