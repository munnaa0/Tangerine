import * as THREE from "three";

export class Starfield {
  constructor(scene, numStars = 15000) {
    this.scene = scene;
    this.numStars = numStars;
    this.init();
  }

  init() {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.numStars * 3);
    const colors = new Float32Array(this.numStars * 3);

    const colorPalette = [
      new THREE.Color(0xffffff), // White
      new THREE.Color(0xaaccff), // Blue-white (hot)
      new THREE.Color(0xffccaa), // Orange (cool)
      new THREE.Color(0xddddff), // Light blue
    ];

    for (let i = 0; i < this.numStars; i++) {
      // Distribute in a huge sphere
      const radius = 200 + Math.random() * 800; // between 200 and 1000 units
      const theta = 2 * Math.PI * Math.random();
      const phi = Math.acos(2 * Math.random() - 1);

      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      // Pick a random color based on temperature probability
      const color =
        colorPalette[Math.floor(Math.random() * colorPalette.length)];

      // Randomize brightness slightly
      const brightness = 0.5 + Math.random() * 0.5;

      colors[i * 3] = color.r * brightness;
      colors[i * 3 + 1] = color.g * brightness;
      colors[i * 3 + 2] = color.b * brightness;
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    // Save original positions and setup targets for constellation animation
    this.originalPositions = new Float32Array(positions);
    this.targetPositions = new Float32Array(positions);
    this.isFormingConstellation = false;
    this.constellationProgress = 0;

    // Create circle texture procedurally via canvas for round stars
    const canvas = document.createElement("canvas");
    canvas.width = 16;
    canvas.height = 16;
    const context = canvas.getContext("2d");
    const gradient = context.createRadialGradient(8, 8, 0, 8, 8, 8);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.2, "rgba(255,255,255,0.8)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 16, 16);
    const texture = new THREE.CanvasTexture(canvas);

    const material = new THREE.PointsMaterial({
      size: 2.0,
      vertexColors: true,
      map: texture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.points = new THREE.Points(geometry, material);
    this.scene.add(this.points);
  }

  formConstellation() {
    if (this.isFormingConstellation) return;
    this.isFormingConstellation = true;
    this.constellationProgress = 0;

    // 1. Create a 2D canvas to render the text and extract pixel data
    const canvas = document.createElement("canvas");
    const cw = 1200;
    const ch = 400;
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d");

    // 2. Draw the text accurately into the canvas
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Main Text
    ctx.font = 'bold 80px "Times New Roman", Arial, sans-serif';
    ctx.fillText("The Galaxy Shines for You Today", cw / 2, ch / 2 - 40);

    // Sub Text
    ctx.font = 'italic 70px "Times New Roman", Arial, sans-serif';
    ctx.fillText('" My Universe, My Tangerine "', cw / 2, ch / 2 + 50);

    // 3. Extract pixel data to map to 3D points
    const imgData = ctx.getImageData(0, 0, cw, ch).data;
    const points = [];

    // Sample pixels (every 3rd pixel to manage total star count)
    for (let y = 0; y < ch; y += 3) {
      for (let x = 0; x < cw; x += 3) {
        const alpha = imgData[(y * cw + x) * 4 + 3];
        if (alpha > 128) {
          points.push({ x: x, y: y });
        }
      }
    }

    const colors = this.points.geometry.attributes.color.array;
    let starIndex = 0;

    // Space the points appropriately on the screen
    const scale = 0.16;

    // 4. Map background stars to each extracted text point
    for (let i = 0; i < points.length; i++) {
      // Leave at least half the stars undisturbed in the background
      if (starIndex >= Math.floor(this.numStars * 0.5)) break;

      const pt = points[i];

      // Transform canvas coordinates to 3D space
      const nx = (pt.x - cw / 2) * scale + (Math.random() - 0.5) * 0.5;
      const ny = -(pt.y - ch / 2) * scale + (Math.random() - 0.5) * 0.5;
      const nz = -100 + (Math.random() - 0.5); // Fixed Z plane slightly offset from camera

      this.targetPositions[starIndex * 3] = nx;
      this.targetPositions[starIndex * 3 + 1] = ny;
      this.targetPositions[starIndex * 3 + 2] = nz;

      // Color: Distinctive Tangerine Orange/Gold
      colors[starIndex * 3] = 1.0; // Red
      colors[starIndex * 3 + 1] = 0.55; // Green
      colors[starIndex * 3 + 2] = 0.1; // Blue

      starIndex++;
    }

    // Notify Three.js that color buffer changed
    this.points.geometry.attributes.color.needsUpdate = true;
  }

  update(time) {
    // Slow rotation of the entire starfield
    this.points.rotation.y = time * 0.02;
    this.points.rotation.x = time * 0.005;

    // Animate the stars into the "23" formation
    if (this.isFormingConstellation && this.constellationProgress < 1.0) {
      // Fixed increment independent of complex clock delta calculations,
      // taking approx 4 seconds at 60fps (0.004 * 60 = 0.24 progress/sec)
      this.constellationProgress += 0.004;
      if (this.constellationProgress > 1.0) this.constellationProgress = 1.0;

      const positions = this.points.geometry.attributes.position.array;

      // Ease-out cubic formula for smooth slowing down at the end
      const t = 1.0 - Math.pow(1.0 - this.constellationProgress, 3);

      // Interpolate the positions of the stars
      for (let i = 0; i < this.numStars * 3; i++) {
        positions[i] =
          this.originalPositions[i] +
          (this.targetPositions[i] - this.originalPositions[i]) * t;
      }

      // CRITICAL: Notify Three.js that positions changed
      this.points.geometry.attributes.position.needsUpdate = true;
    }
  }
}
