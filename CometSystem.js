import * as THREE from 'three';

export class CometSystem {
    constructor(scene) {
        this.scene = scene;
        this.comets = [];
        this.maxComets = 3;
        
        // Setup texture for comet head
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');
        const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.2, 'rgba(150, 200, 255, 0.8)');
        gradient.addColorStop(1, 'rgba(0, 50, 255, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 32, 32);
        this.cometTexture = new THREE.CanvasTexture(canvas);
        
        this.material = new THREE.SpriteMaterial({
            map: this.cometTexture,
            color: 0xffffff,
            blending: THREE.AdditiveBlending,
            transparent: true,
            depthWrite: false
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

        const comet = {
            head: new THREE.Sprite(this.material),
            velocity: new THREE.Vector3(velX, velY, velZ),
            life: 1.0, // Fades out
            tailPositions: [], // Store recent positions for the tail
            tailGeometry: new THREE.BufferGeometry(),
            tailMaterial: new THREE.LineBasicMaterial({
                color: 0x88ccff,
                transparent: true,
                opacity: 0.8,
                blending: THREE.AdditiveBlending
            }),
            tailLine: null
        };

        comet.head.position.set(startX, startY, startZ);
        comet.head.scale.set(10, 10, 1);
        
        // Initialize tail line
        comet.tailLine = new THREE.Line(comet.tailGeometry, comet.tailMaterial);

        this.scene.add(comet.head);
        this.scene.add(comet.tailLine);
        this.comets.push(comet);
    }

    update(time) {
        // Randomly spawn
        if (Math.random() < 0.005) {
            this.spawnComet();
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
                comet.tailGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            }

            // Fade out
            comet.life -= 0.002;
            comet.head.material.opacity = comet.life;
            comet.tailMaterial.opacity = comet.life * 0.8;

            // Remove if dead or too low
            if (comet.life <= 0 || comet.head.position.y < -400) {
                this.scene.remove(comet.head);
                this.scene.remove(comet.tailLine);
                comet.tailGeometry.dispose();
                comet.tailMaterial.dispose();
                this.comets.splice(i, 1);
            }
        }
    }
}