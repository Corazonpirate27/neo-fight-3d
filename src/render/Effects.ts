import * as THREE from 'three';

export interface VisualParticle {
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  gravity: number;
  life: number;
  maxLife: number;
  active: boolean;
  color: string;
}

export interface Shockwave {
  mesh: THREE.Mesh;
  scale: number;
  maxScale: number;
  life: number;
  maxLife: number;
  active: boolean;
  color: string;
}

export class Effects {
  private static scene: THREE.Scene;
  private static particlePool: VisualParticle[] = [];
  private static shockwaves: Shockwave[] = [];
  
  private static maxParticles: number = 80;

  public static init(scene: THREE.Scene): void {
    this.scene = scene;
    this.particlePool = [];
    this.shockwaves = [];
    
    // Allocate particle pool upfront (to prevent garbage collection stutters)
    const geom = new THREE.BoxGeometry(0.12, 0.12, 0.12);
    
    for (let i = 0; i < this.maxParticles; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 1.0
      });
      
      const mesh = new THREE.Mesh(geom, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      
      this.particlePool.push({
        mesh,
        pos: mesh.position,
        vel: new THREE.Vector3(),
        gravity: 0,
        life: 0,
        maxLife: 0,
        active: false,
        color: '#ffffff'
      });
    }
  }

  public static update(): void {
    // 1. Update physical spark particles
    this.particlePool.forEach(p => {
      if (!p.active) return;
      
      p.pos.add(p.vel);
      p.vel.y -= p.gravity; // Apply gravity force
      p.life--;
      
      // Ground-bouncing collision at y = 0
      if (p.pos.y <= 0 && p.vel.y < 0) {
        p.pos.y = 0;
        p.vel.y = -p.vel.y * 0.55; // reverse and damp vertical velocity
        p.vel.x *= 0.72; // apply horizontal sliding friction
        p.vel.z *= 0.72;
      }
      
      p.mesh.position.copy(p.pos);
      
      // Scale down over lifetime
      const lifeRatio = p.life / p.maxLife;
      p.mesh.scale.set(lifeRatio, lifeRatio, lifeRatio);
      
      // Update opacity
      const mat = p.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = lifeRatio;
      
      if (p.life <= 0) {
        p.active = false;
        p.mesh.visible = false;
      }
    });

    // 2. Update shockwave rings
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      if (!sw.active) continue;
      
      sw.life--;
      const progress = 1 - (sw.life / sw.maxLife);
      const currentScale = 0.5 + sw.maxScale * progress;
      
      sw.mesh.scale.set(currentScale, currentScale, currentScale);
      
      // Fade out opacity
      const mat = sw.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = sw.life / sw.maxLife;
      
      // Spin the rings oppositely over time
      sw.mesh.rotation.z += 0.05 * (i % 2 === 0 ? 1 : -1);
      
      if (sw.life <= 0) {
        sw.active = false;
        this.scene.remove(sw.mesh);
        this.shockwaves.splice(i, 1);
      }
    }
  }

  // --- SPAWN EVENTS ---
  public static spawnHitSparks(pos: THREE.Vector3, colorHex: string | number): void {
    const count = 16;
    const colorVal = typeof colorHex === 'string' ? parseInt(colorHex.replace('#', '0x')) : colorHex;
    
    for (let i = 0; i < count; i++) {
      const p = this.particlePool.find(part => !part.active);
      if (!p) break;
      
      p.active = true;
      p.mesh.visible = true;
      p.pos.copy(pos);
      
      // Random spray speed velocities
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.1 + Math.random() * 0.28;
      
      p.vel.set(
        Math.cos(angle) * speed,
        0.1 + Math.random() * 0.25, // upward force
        (Math.random() - 0.5) * 0.12
      );
      
      p.gravity = 0.015;
      p.life = 20 + Math.floor(Math.random() * 20);
      p.maxLife = p.life;
      
      const mat = p.mesh.material as THREE.MeshBasicMaterial;
      mat.color.setHex(colorVal);
      mat.opacity = 1.0;
    }

    // Spawn an expanding impact shockwave ring facing the camera
    this.spawnShockwaveRing(pos, colorVal, 3.5, 14);
  }

  public static spawnBlockSparks(pos: THREE.Vector3, _colorHex: string | number): void {
    const count = 8;

    for (let i = 0; i < count; i++) {
      const p = this.particlePool.find(part => !part.active);
      if (!p) break;

      p.active = true;
      p.mesh.visible = true;
      p.pos.copy(pos);

      // Sparks spray back towards the attacker side
      p.vel.set(
        (Math.random() - 0.5) * 0.1,
        0.05 + Math.random() * 0.18,
        (Math.random() - 0.5) * 0.08
      );

      p.gravity = 0.012;
      p.life = 12 + Math.floor(Math.random() * 10);
      p.maxLife = p.life;

      const mat = p.mesh.material as THREE.MeshBasicMaterial;
      mat.color.setHex(0xffaa00); // Guard sparks are always retro orange/yellow
      mat.opacity = 1.0;
    }
  }

  public static spawnWallBounceSparks(pos: THREE.Vector3, colorHex: string | number): void {
    const count = 24;
    const colorVal = typeof colorHex === 'string' ? parseInt(colorHex.replace('#', '0x')) : colorHex;
    
    for (let i = 0; i < count; i++) {
      const p = this.particlePool.find(part => !part.active);
      if (!p) break;
      
      p.active = true;
      p.mesh.visible = true;
      p.pos.copy(pos);
      
      // Spray away from wall boundary limit
      const wallDir = pos.x > 0 ? -1 : 1;
      p.vel.set(
        wallDir * (0.05 + Math.random() * 0.32),
        (Math.random() - 0.5) * 0.22 + 0.1,
        (Math.random() - 0.5) * 0.18
      );
      
      p.gravity = 0.018;
      p.life = 25 + Math.floor(Math.random() * 15);
      p.maxLife = p.life;
      
      const mat = p.mesh.material as THREE.MeshBasicMaterial;
      mat.color.setHex(colorVal);
      mat.opacity = 1.0;
    }
    
    // Spawn heavy expanding neon ring at wall splat coordinates
    this.spawnShockwaveRing(pos, 0xff0055, 5.5, 18);
  }

  public static spawnLandingDust(pos: THREE.Vector3): void {
    const count = 10;
    
    for (let i = 0; i < count; i++) {
      const p = this.particlePool.find(part => !part.active);
      if (!p) break;
      
      p.active = true;
      p.mesh.visible = true;
      p.pos.copy(pos);
      
      // Spray flat along floor grates
      p.vel.set(
        (Math.random() - 0.5) * 0.22,
        0.02 + Math.random() * 0.05,
        (Math.random() - 0.5) * 0.22
      );
      
      p.gravity = 0.002;
      p.life = 15 + Math.floor(Math.random() * 15);
      p.maxLife = p.life;
      
      const mat = p.mesh.material as THREE.MeshBasicMaterial;
      mat.color.setHex(0xa6b2c9); // dust is soft blue-grey
      mat.opacity = 0.65;
    }
  }

  private static spawnShockwaveRing(pos: THREE.Vector3, colorHex: number, maxScale: number, maxLife: number): void {
    const ringGeo = new THREE.RingGeometry(0.8, 1.0, 16);
    const ringMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85
    });
    
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.copy(pos);
    ringMesh.lookAt(this.scene.parent?.position || new THREE.Vector3(pos.x, pos.y, pos.z + 10)); // orient toward camera direction
    
    this.scene.add(ringMesh);
    
    this.shockwaves.push({
      mesh: ringMesh,
      scale: 1,
      maxScale,
      life: maxLife,
      maxLife,
      active: true,
      color: '#' + colorHex.toString(16)
    });
  }
}
