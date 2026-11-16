// ================= NEO-FIGHT ARCADE CORE PARTICLES =================

class Particle {
  constructor() {
    this.reset();
  }

  reset() {
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.color = '#fff';
    this.size = 0;
    this.maxSize = 0;
    this.life = 0;
    this.maxLife = 0;
    this.gravity = 0;
    this.fade = true;
    this.active = false;
    this.glow = false;
    this.shape = 'circle'; // circle, square, ring
  }

  update() {
    if (!this.active) return;

    this.x += this.vx;
    this.y += this.vy;
    this.vy += this.gravity;
    this.life--;

    // Physical ground boundary collision check at groundY = 560
    const groundY = 560;
    if (this.gravity > 0 && this.y >= groundY) {
      this.y = groundY;
      // Bounce with vertical restitution: v_y = -v_y * 0.55
      this.vy = -Math.abs(this.vy) * 0.55;
      // Slide with friction: v_x = v_x * 0.72
      this.vx = this.vx * 0.72;

      // Rest the bouncing if vertical velocity becomes negligible
      if (Math.abs(this.vy) < 0.25) {
        this.vy = 0;
      }
    }

    if (this.life <= 0) {
      this.active = false;
    }
  }

  draw(ctx) {
    if (!this.active) return;

    ctx.save();
    
    // Fade opacity relative to remaining life
    const alpha = this.fade ? Math.max(0, this.life / this.maxLife) : 1;
    ctx.globalAlpha = alpha;

    if (this.glow && this.shape !== 'ring') {
      ctx.shadowBlur = this.size * 2.5;
      ctx.shadowColor = this.color;
    }

    ctx.fillStyle = this.color;
    ctx.strokeStyle = this.color;

    if (this.shape === 'circle') {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.shape === 'square') {
      ctx.fillRect(this.x - this.size, this.y - this.size, this.size * 2, this.size * 2);
    } else if (this.shape === 'ring') {
      // Premium multi-layered, screen-blended shockwave rings
      ctx.globalCompositeOperation = 'screen';
      
      const currentRadius = this.maxSize * (1 - this.life / this.maxLife);
      const lifeRatio = this.life / this.maxLife;
      
      // Converted main color or predefined saturated neon palette
      const baseColor = this.color || '#ffffff';
      const layers = [
        { scale: 1.0, color: baseColor, dir: 1, width: 4 },
        { scale: 0.82, color: '#ff007f', dir: -1, width: 2.5 },
        { scale: 0.65, color: '#00f3ff', dir: 1, width: 1.5 }
      ];
      
      layers.forEach((layer) => {
        ctx.save();
        ctx.translate(this.x, this.y);
        
        // Dynamic opposite rotations based on progress through life cycle
        const rotationAngle = layer.dir * (1 - lifeRatio) * Math.PI * 1.5;
        ctx.rotate(rotationAngle);
        
        ctx.beginPath();
        ctx.strokeStyle = layer.color;
        ctx.lineWidth = layer.width * lifeRatio;
        
        // Specular glow on the shockwave bands
        ctx.shadowBlur = layer.width * 4;
        ctx.shadowColor = layer.color;
        
        // Draw 2 gorgeous rotating arcs
        ctx.arc(0, 0, currentRadius * layer.scale, 0, Math.PI * 0.45);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.arc(0, 0, currentRadius * layer.scale, Math.PI, Math.PI * 1.45);
        ctx.stroke();
        
        ctx.restore();
      });
    }

    ctx.restore();
  }
}

class ParticleManager {
  constructor() {
    this.maxParticles = 500;
    this.pool = [];
    
    // Allocate pool upfront to prevent garbage collection stutters
    for (let i = 0; i < this.maxParticles; i++) {
      this.pool.push(new Particle());
    }
  }

  // Retrieve an inactive particle from the pool
  spawn(x, y, vx, vy, color, size, maxLife, gravity = 0, glow = true, shape = 'circle', fade = true) {
    let p = this.pool.find(part => !part.active);
    
    // If pool is fully active, reuse the oldest active particle
    if (!p) {
      p = this.pool[0];
      let minLife = p.life;
      for (let i = 1; i < this.pool.length; i++) {
        if (this.pool[i].life < minLife) {
          minLife = this.pool[i].life;
          p = this.pool[i];
        }
      }
    }

    p.reset();
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.color = color;
    p.size = size;
    p.maxSize = size * 3; // for ring shape expanders
    p.life = maxLife;
    p.maxLife = maxLife;
    p.gravity = gravity;
    p.glow = glow;
    p.shape = shape;
    p.fade = fade;
    p.active = true;
  }

  // Spawn spark explosion on hit
  createHitSparks(x, y, color) {
    const sparkCount = 18;
    for (let i = 0; i < sparkCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 8;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed - 1.5; // slight upward drift
      const size = 3 + Math.random() * 4;
      const life = 15 + Math.floor(Math.random() * 20);
      
      this.spawn(x, y, vx, vy, color, size, life, 0.25, true, 'circle');
    }

    // Spawn an expanding impact ring
    this.spawn(x, y, 0, 0, '#ffffff', 12, 12, 0, true, 'ring', true);
  }

  // Block shields sparks
  createBlockSparks(x, y, color) {
    const sparkCount = 10;
    for (let i = 0; i < sparkCount; i++) {
      // Sparks bounce backward from blocking direction
      const angle = (Math.random() * Math.PI) - Math.PI / 2; // sweep to right
      const speed = 2 + Math.random() * 5;
      // Mirror direction randomly, we'll let fighter call handle directional offset
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      const size = 2 + Math.random() * 3;
      const life = 10 + Math.floor(Math.random() * 12);
      
      this.spawn(x, y, vx, vy, '#fff', size, life, 0.1, true, 'square');
    }
  }

  // Dash smoke cloud at character feet
  createDashCloud(x, y, dirSign) {
    const cloudCount = 6;
    for (let i = 0; i < cloudCount; i++) {
      const vx = -dirSign * (1 + Math.random() * 2);
      const vy = -0.5 - Math.random() * 1.5;
      const size = 6 + Math.random() * 8;
      const life = 20 + Math.random() * 15;
      
      this.spawn(x, y, vx, vy, 'rgba(200, 200, 255, 0.25)', size, life, 0, false, 'circle', true);
    }
  }

  // Energy/Magic sparks trailing behind fireballs
  createFireballTrail(x, y, color) {
    const vx = (Math.random() - 0.5) * 1.5;
    const vy = (Math.random() - 0.5) * 1.5;
    const size = 4 + Math.random() * 5;
    const life = 12 + Math.random() * 8;
    
    this.spawn(x, y, vx, vy, color, size, life, 0, true, 'circle', true);
  }

  // Charging aura effect
  createChargeAura(x, y, color) {
    // Spawn particles around feet that float up
    const offset = 25;
    const px = x + (Math.random() - 0.5) * offset * 2;
    const py = y + (Math.random() - 0.5) * 10;
    const vx = (Math.random() - 0.5) * 0.8;
    const vy = -1.5 - Math.random() * 2.5; // floating upwards
    const size = 3 + Math.random() * 4;
    const life = 25 + Math.random() * 15;
    
    this.spawn(px, py, vx, vy, color, size, life, -0.05, true, 'circle', true);
  }

  // Spawns light grey dust clouds drifting outward from feet when landing
  createLandingDust(x, y) {
    const count = 8;
    for (let i = 0; i < count; i++) {
      const vx = (Math.random() - 0.5) * 5;
      const vy = -0.5 - Math.random() * 1.5;
      const size = 4 + Math.random() * 5;
      const life = 15 + Math.random() * 10;
      this.spawn(x, y, vx, vy, 'rgba(200, 200, 255, 0.22)', size, life, 0, false, 'circle', true);
    }
  }

  // Wall splat sparks exploding from screen bounds
  createWallSplatSparks(x, y, color) {
    const count = 25;
    for (let i = 0; i < count; i++) {
      const angle = (Math.random() - 0.5) * Math.PI;
      const speed = 4 + Math.random() * 10;
      const vx = (x === 0 ? 1 : -1) * Math.abs(Math.cos(angle)) * speed;
      const vy = Math.sin(angle) * speed;
      const size = 3 + Math.random() * 4;
      const life = 20 + Math.random() * 15;
      this.spawn(x, y, vx, vy, color, size, life, 0.2, true, 'circle', true);
    }
    
    // Expanding neon impact ring at wall splat
    this.spawn(x, y, 0, 0, '#ffffff', 18, 14, 0, true, 'ring', true);
  }

  // Spawns joint-based dots tracing the fighter's skeleton to leave a neon afterimage trail
  createDashAfterimage(x, y, charType, color, dir) {
    const joints = [
      { x: 0, y: -95 }, // head
      { x: 0, y: -76 }, // neck
      { x: 0, y: -42 }, // hip
      { x: -14, y: -72 }, // left shoulder
      { x: 14, y: -72 }, // right shoulder
      { x: -20, y: -42 }, // left hand
      { x: 20, y: -42 }, // right hand
      { x: -14, y: 0 }, // left foot
      { x: 14, y: 0 }  // right foot
    ];
    
    joints.forEach(j => {
      const px = x + j.x * dir;
      const py = y + j.y;
      
      const vx = -dir * 1.5;
      const vy = (Math.random() - 0.5) * 0.5;
      const size = 4 + Math.random() * 2;
      const life = 14 + Math.random() * 8;
      
      this.spawn(px, py, vx, vy, color, size, life, 0, true, 'circle', true);
    });
  }

  update() {
    for (let i = 0; i < this.pool.length; i++) {
      if (this.pool[i].active) {
        this.pool[i].update();
      }
    }
  }

  draw(ctx) {
    for (let i = 0; i < this.pool.length; i++) {
      if (this.pool[i].active) {
        this.pool[i].draw(ctx);
      }
    }
  }

  clear() {
    this.pool.forEach(p => p.reset());
  }
}

// Single instance to export
export const particles = new ParticleManager();
