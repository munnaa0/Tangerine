import * as THREE from "three";

export class CometSystem {
  constructor(scene) {
    this.scene = scene;
    this.comets = [];
    this.maxComets = 3;

    // Setup texture for comet head
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext("2d");
    const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
    gradient.addColorStop(0.2, "rgba(150, 200, 255, 0.8)");
    gradient.addColorStop(1, "rgba(0, 50, 255, 0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 32, 32);
    this.cometTexture = new THREE.CanvasTexture(canvas);

    this.material = new THREE.SpriteMaterial({
      map: this.cometTexture,
      color: 0xffffff,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
  }

  spawnComet() {
    if (this.comets.length >= this.maxComets) return;

    // Random starting position (far away)
    const startX = (Math.random() - 0.5) * 800;
    const startY = 200 + Math.random() * 200; // High up
    const startZ = -300 - Math.random() * 200; // Deep in bg

    // Velocity directed generally downward and across
    const velX = (Math.random() - 0.5) * 4.0;
    const velY = -2.0 - Math.random() * 3.0;
    const velZ = Math.random() * 2.0;

    return this.createCometInstance(
      startX,
      startY,
      startZ,
      velX,
      velY,
      velZ,
      1.0,
      0x88ccff,
      10,
    );
  }

  spawnWishComet() {
    // Special, big, persistent comet traversing from bottom-left to top-right
    const startX = -400;
    const startY = -300;
    const startZ = -100;

    // Going up and right
    const velX = 2.5;
    const velY = 1.5;
    const velZ = -0.5;

    // More pink/gold color and larger size, slower decay
    const comet = this.createCometInstance(
      startX,
      startY,
      startZ,
      velX,
      velY,
      velZ,
      5.0,
      0xff88cc,
      25,
    );
    this.wishCometActive = true;
    return comet;
  }

  createCometInstance(
    startX,
    startY,
    startZ,
    velX,
    velY,
    velZ,
    initialLife,
    tailColor,
    headSize,
  ) {
    const comet = {
      head: new THREE.Sprite(this.material),
      velocity: new THREE.Vector3(velX, velY, velZ),
      life: initialLife, // Fades out
      tailPositions: [], // Store recent positions for the tail
      tailGeometry: new THREE.BufferGeometry(),
      tailMaterial: new THREE.LineBasicMaterial({
        color: tailColor,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        linewidth: 2,
      }),
      tailLine: null,
      isWishComet: initialLife > 1.0,
    };

    comet.head.position.set(startX, startY, startZ);
    comet.head.scale.set(headSize, headSize, 1);
    if (comet.isWishComet) {
      comet.head.material = comet.head.material.clone();
      comet.head.material.color.setHex(0xffaadd);
    }

    // Initialize tail line
    comet.tailLine = new THREE.Line(comet.tailGeometry, comet.tailMaterial);

    this.scene.add(comet.head);
    this.scene.add(comet.tailLine);
    this.comets.push(comet);
    return comet;
  }

  update(time) {
    // Randomly spawn
    if (Math.random() < 0.005) {
      this.spawnComet();
    }

    // Periodically spawn wish comet if activated
    if (this.wishCometActive && Math.random() < 0.002) {
      let hasWish = this.comets.some((c) => c.isWishComet);
      if (!hasWish) this.spawnWishComet();
    }

    for (let i = this.comets.length - 1; i >= 0; i--) {
      const comet = this.comets[i];

      // Move head
      comet.head.position.add(comet.velocity);

      // Record position for tail
      comet.tailPositions.push(comet.head.position.clone());
      if (comet.tailPositions.length > 30) {
        comet.tailPositions.shift(); // Keep tail length limited
      }

      // Update tail geometry
      if (comet.tailPositions.length > 1) {
        const positions = new Float32Array(comet.tailPositions.length * 3);
        for (let j = 0; j < comet.tailPositions.length; j++) {
          positions[j * 3] = comet.tailPositions[j].x;
          positions[j * 3 + 1] = comet.tailPositions[j].y;
          positions[j * 3 + 2] = comet.tailPositions[j].z;
        }
        comet.tailGeometry.setAttribute(
          "position",
          new THREE.BufferAttribute(positions, 3),
        );
      }

      // Fade out
      if (!comet.isWishComet) {
        comet.life -= 0.002;
      } else {
        comet.life -= 0.001; // Slower fade for wish comet
      }
      comet.head.material.opacity = Math.min(1.0, comet.life);
      comet.tailMaterial.opacity = Math.min(1.0, comet.life * 0.8);

      // Remove if dead or too low / too high
      const outOfBounds = comet.isWishComet
        ? comet.head.position.y > 600 || comet.head.position.x > 800
        : comet.head.position.y < -400;

      if (comet.life <= 0 || outOfBounds) {
        this.scene.remove(comet.head);
        this.scene.remove(comet.tailLine);
        comet.tailGeometry.dispose();
        comet.tailMaterial.dispose();
        this.comets.splice(i, 1);
      }
    }
  }
}
