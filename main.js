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

    this.initScene();
    this.initPostProcessing();
    this.initObjects();
    this.addEventListeners();

    this.clock = new THREE.Clock();
    this.animate();
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
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Limit pixel ratio for performance
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
  }

  onWindowResize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(this.width, this.height);
    this.composer.setSize(this.width, this.height);
  }

  animate() {
    requestAnimationFrame(this.animate.bind(this));

    const time = this.clock.getElapsedTime();

    // Update systems
    if (this.nebula) this.nebula.update(time);
    if (this.starfield) this.starfield.update(time);
    if (this.planet) this.planet.update(time);
    if (this.comets) this.comets.update(time);
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

  // Called after the user clicks "Blow the Candle"
  function triggerBlowSequence() {
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
    overlay.style.backgroundColor = "transparent";

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
    }, 4500);
  }

  blowBtn.addEventListener("click", triggerBlowSequence);

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
