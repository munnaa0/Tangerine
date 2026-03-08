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
  const birthdayText = document.getElementById("happy-birthday-text");
  const bgm = document.getElementById("bgm");

  let count = 3;
  const interval = setInterval(() => {
    count--;
    if (count > 0) {
      countdownEl.textContent = count;

      // AUDIO: Start playing exactly when timer reaches 1
      if (count === 1 && bgm) {
        bgm.volume = 0; // start silent
        bgm.loop = true; // explicitly ensure loop is applied
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
    } else {
      clearInterval(interval);

      // Blow the candle (softly fade out instruction, countdown, and candle)
      instruction.style.transition = "opacity 0.5s";
      countdownEl.style.transition = "opacity 0.5s";
      instruction.style.opacity = "0";
      countdownEl.style.opacity = "0";
      candleWrapper.classList.add("hidden");

      // Fade out overlay *background* to reveal the planet instantly behind the text
      overlay.style.backgroundColor = "transparent";

      // Show Happy Birthday text with the new glow animation
      birthdayText.classList.add("show");

      // TRIGGER CONSTELLATION: wait just 1.5 seconds so they look at the text first
      setTimeout(() => {
        if (app.starfield) {
          app.starfield.formConstellation();
        }
      }, 1500);

      // After showing the text for a bit, fade out the whole overlay
      setTimeout(() => {
        overlay.classList.add("fade-out");
      }, 4500); // Decreased by 0.5s to make text disappear earlier
    }
  }, 1000);
};
