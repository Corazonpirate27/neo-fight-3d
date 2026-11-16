// ================= NEO-FIGHT ARCADE FIGHTER CLASS =================
import { particles } from './particles.js?v=1.0.5';
import { audio } from './audio.js?v=1.0.5';

// Projectile Class for Special Ranged Attacks
class Projectile {
  constructor(x, y, dir, type, ownerColor) {
    this.x = x;
    this.y = y;
    this.vx = dir * 12;
    this.vy = 0;
    this.radius = 18;
    this.type = type; // 'shuriken' or 'fireball'
    this.color = ownerColor;
    this.active = true;
    this.damage = 15;
    this.hitRegistered = false;
  }

  update(canvasWidth) {
    this.x += this.vx;
    this.y += this.vy;
    
    // Spawn trailing energy particles
    particles.createFireballTrail(this.x, this.y, this.color);
    
    // Out of bounds check
    if (this.x < 0 || this.x > canvasWidth) {
      this.active = false;
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.shadowBlur = 20;
    ctx.shadowColor = this.color;
    ctx.fillStyle = this.color;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;

    if (this.type === 'shuriken') {
      // Draw rotating ninja star
      ctx.translate(this.x, this.y);
      // Rotation based on time/frames
      const rot = (Date.now() / 60) % (Math.PI * 2);
      ctx.rotate(rot);
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        ctx.lineTo(0, -this.radius);
        ctx.lineTo(this.radius / 3, -this.radius / 3);
        ctx.rotate(Math.PI / 2);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      // Draw blazing fireball
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();
      
      // Outer shell ring
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius * 1.3, 0, Math.PI * 2);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.stroke();
    }

    ctx.restore();
  }
}

export class Fighter {
  constructor({
    x,
    y,
    color,
    name,
    characterType, // 'shadow' or 'blaze'
    opponent = null,
    isPlayer2 = false,
    groundY = 560
  }) {
    this.name = name;
    this.characterType = characterType;
    this.isPlayer2 = isPlayer2;
    this.opponent = opponent;
    
    // Positions & Velocities
    this.pos = { x, y };
    this.vel = { x: 0, y: 0 };
    this.scale = 1.0;
    
    // Physical attributes
    this.width = 65;
    this.height = 135;
    this.gravity = 0.85; // Snappier gravity!
    this.groundY = groundY; // relative to canvas height
    
    // Neon design
    this.color = color;
    this.glowColor = characterType === 'shadow' ? 'rgba(0, 243, 255, 0.4)' : 'rgba(255, 0, 85, 0.4)';
    
    // Combat parameters
    this.health = 300;
    this.maxHealth = 300;
    this.energy = 0;
    this.maxEnergy = 100;
    
    // Fighter direction (1: facing right, -1: facing left)
    this.dir = isPlayer2 ? -1 : 1;
    
    // Combat state machine
    this.state = 'IDLE'; // IDLE, RUN, JUMP, CROUCH, ATTACK, HIT, BLOCK, DEFEATED
    this.animationTimer = 0;
    
    // Jump mechanics
    this.doubleJumpCount = 0;
    this.maxJumps = 2;
    
    // Attack metrics
    this.isAttacking = false;
    this.attackType = null; // 'light', 'heavy', 'kick', 'special', 'ultimate'
    this.attackCooldown = 0;
    this.attackTimer = 0; // frame tracker for attacks
    
    // Hit Stun / Block Stun
    this.hitStunTimer = 0;
    this.blockStunTimer = 0;
    this.invincibilityTimer = 0;
    
    // Projectiles
    this.projectiles = [];
    
    // Collision bounding box structures
    this.hurtbox = { pos: { x: 0, y: 0 }, width: 0, height: 0 };
    this.hitbox = { pos: { x: 0, y: 0 }, width: 0, height: 0, active: false };

    // Move statistics
    this.speed = characterType === 'shadow' ? 7.8 : 5.6; // Dynamic fast speeds!
    this.jumpForce = characterType === 'shadow' ? -16.5 : -14.8; // Punchier brawler jumps!
    
    // Frame stats (in frames @ 60fps)
    this.lightPunchFrames = { startup: 4, active: 6, total: 14, damage: 5, knockback: 2, energyGain: 8 };
    this.heavyPunchFrames = { startup: 8, active: 8, total: 24, damage: 12, knockback: 5, energyGain: 12 };
    this.kickFrames = { startup: 6, active: 8, total: 18, damage: 8, knockback: 4, energyGain: 10 };
    this.specialFrames = { startup: 15, active: 10, total: 40, damage: 15, knockback: 8, energyGain: 0 };
    
    // Combo track
    this.comboCounter = 0;
    this.comboResetTimer = 0;

    // Cyber Upgrades
    this.dashTimer = 0;
    this.dashDir = 0;
    this.landingSquashTimer = 0;
  }

  // Define hurtbox dimensions dynamically based on current state (jumping, crouching, etc.)
  updateHurtbox() {
    this.hurtbox.width = this.width;
    this.hurtbox.height = this.state === 'CROUCH' ? this.height * 0.65 : this.height;
    
    // Pivot bottom center
    this.hurtbox.pos.x = this.pos.x - this.hurtbox.width / 2;
    this.hurtbox.pos.y = this.state === 'CROUCH' 
      ? this.pos.y - this.hurtbox.height
      : this.pos.y - this.height;
  }

  // Create hitboxes dynamically depending on attack frames
  updateHitbox() {
    if (!this.isAttacking || !this.hitbox.active) {
      this.hitbox.active = false;
      return;
    }

    const directionOffset = this.dir === 1 ? 0 : -this.hitbox.width;
    
    // Pivot from center of player
    this.hitbox.pos.y = this.pos.y - this.height * 0.75 + this.hitbox.yOffset;
    this.hitbox.pos.x = this.pos.x + (this.dir === 1 ? this.width / 2 : -this.width / 2 - this.hitbox.width) + this.hitbox.xOffset * this.dir;
  }

  update(canvasWidth) {
    this.animationTimer++;
    
    // Cooldown reductions
    if (this.attackCooldown > 0) this.attackCooldown--;
    if (this.hitStunTimer > 0) this.hitStunTimer--;
    if (this.blockStunTimer > 0) this.blockStunTimer--;
    if (this.invincibilityTimer > 0) this.invincibilityTimer--;
    
    // Combo reset
    if (this.comboResetTimer > 0) {
      this.comboResetTimer--;
      if (this.comboResetTimer === 0) this.comboCounter = 0;
    }

    // Active dash kinematics
    if (this.dashTimer > 0) {
      this.dashTimer--;
      this.vel.x = this.dashDir * this.speed * 2.2;
      
      // Cyber neon trail
      if (this.dashTimer % 3 === 0) {
        particles.createDashAfterimage(this.pos.x, this.pos.y, this.characterType, this.color, this.dir);
      }
      
      if (this.dashTimer === 0) {
        this.dashDir = 0;
      }
    }

    // Landing squash timer
    if (this.landingSquashTimer > 0) this.landingSquashTimer--;

    // Facing direction: always face the opponent unless dead or hit-stunned or dashing
    if (this.opponent && this.state !== 'DEFEATED' && this.hitStunTimer <= 0 && this.dashTimer <= 0) {
      this.dir = this.opponent.pos.x > this.pos.x ? 1 : -1;
    }

    // Apply movement physics
    this.pos.x += this.vel.x;
    this.pos.y += this.vel.y;

    // Gravity logic
    const isOnGround = this.pos.y >= this.groundY;
    if (!isOnGround) {
      this.vel.y += this.gravity;
    } else {
      // Just landed squash check
      if (this.vel.y > 0.1) {
        this.landingSquashTimer = 8;
        particles.createLandingDust(this.pos.x, this.groundY);
      }
      this.pos.y = this.groundY;
      this.vel.y = 0;
      this.doubleJumpCount = 0;
      if (this.state === 'JUMP') {
        this.state = 'IDLE';
      }
    }

    // Screen boundary limits (corner clamping) and Wall Bounce/Splat!
    const hitLeft = this.pos.x <= this.width / 2;
    const hitRight = this.pos.x >= canvasWidth - this.width / 2;
    
    if (hitLeft || hitRight) {
      this.pos.x = hitLeft ? this.width / 2 : canvasWidth - this.width / 2;
      
      // Wall splat bounce when hit hard in corners!
      if (this.hitStunTimer > 10 && Math.abs(this.vel.x) > 3.0) {
        const wallX = hitLeft ? 0 : canvasWidth;
        const splatY = this.pos.y - this.height * 0.55;
        
        // Wall spark explosion
        particles.createWallSplatSparks(wallX, splatY, this.color);
        
        // Bounce pop-up!
        this.vel.x = (hitLeft ? 1 : -1) * 6.5;
        this.vel.y = -6.2; // vertical pop-up for air juggles
        this.hitStunTimer = 28; // extend hitstun for juggle timing
        
        if (window.game) {
          window.game.triggerScreenShake(12, 10);
        }
        
        audio.playHitSplat();
      }
    }

    // Handle Attack frames and damage activations
    if (this.isAttacking) {
      this.attackTimer++;
      const data = this.getAttackFrameData();
      
      if (data) {
        // Startup phase done, now activate hitbox
        if (this.attackTimer >= data.startup && this.attackTimer < data.startup + data.active) {
          this.hitbox.active = true;
          this.updateHitbox();
          
          // Collision check frame by frame
          this.checkAttackCollision();
        } else {
          this.hitbox.active = false;
        }

        // Entire attack duration finished
        if (this.attackTimer >= data.total) {
          this.isAttacking = false;
          this.attackType = null;
          this.hitbox.active = false;
          this.state = isOnGround ? 'IDLE' : 'JUMP';
        }
      }
    }

    // Update projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      proj.update(canvasWidth);
      
      // Collision test for projectiles
      if (proj.active && !proj.hitRegistered) {
        this.checkProjectileCollision(proj);
      }
      
      if (!proj.active) {
        this.projectiles.splice(i, 1);
      }
    }

    // Resolve general states
    if (this.health <= 0) {
      this.state = 'DEFEATED';
      this.vel.x = 0;
    } else if (this.hitStunTimer > 0) {
      this.state = 'HIT';
    } else if (this.blockStunTimer > 0) {
      this.state = 'BLOCK';
    } else if (!this.isAttacking) {
      if (!isOnGround) {
        this.state = 'JUMP';
      } else if (Math.abs(this.vel.x) > 0.1) {
        this.state = 'RUN';
      } else if (this.state !== 'CROUCH') {
        this.state = 'IDLE';
      }
    }

    this.updateHurtbox();
  }

  // Retrieve current active attack's frame information
  getAttackFrameData() {
    switch (this.attackType) {
      case 'light': return this.lightPunchFrames;
      case 'heavy': return this.heavyPunchFrames;
      case 'kick': return this.kickFrames;
      case 'special': return this.specialFrames;
      default: return null;
    }
  }

  // --- CHARACTER INPUTS & CONTROLS ---

  move(directionSign) {
    if (this.state === 'DEFEATED' || this.hitStunTimer > 0 || this.blockStunTimer > 0) return;
    if (this.dashTimer > 0) return; // lock standard movement during active dash
    
    // Slow down speed while crouching
    const speedMultiplier = this.state === 'CROUCH' ? 0.35 : 1.0;
    this.vel.x = directionSign * this.speed * speedMultiplier;
    
    // Dash visual smoke particles
    if (this.state === 'RUN' && this.animationTimer % 5 === 0) {
      particles.createDashCloud(this.pos.x - (this.width / 2 * this.dir), this.pos.y, directionSign);
    }
  }

  stopMoving() {
    if (this.dashTimer > 0) return;
    this.vel.x = 0;
  }

  jump() {
    if (this.state === 'DEFEATED' || this.hitStunTimer > 0 || this.blockStunTimer > 0) return;
    if (this.isAttacking && this.state !== 'JUMP') return; // block jump during ground attacks
    if (this.dashTimer > 0) return; // block jump during active dashes
    
    if (this.doubleJumpCount < this.maxJumps) {
      this.vel.y = this.jumpForce;
      this.state = 'JUMP';
      this.doubleJumpCount++;
      
      // Puff smoke at feet
      particles.createDashCloud(this.pos.x, this.pos.y, this.dir);
      
      if (this.doubleJumpCount === 2) {
        // High double-jump sound or mini teleport wave
        audio.playLaser();
      }
    }
  }

  crouch(crouchActive) {
    if (this.state === 'DEFEATED' || this.hitStunTimer > 0 || this.blockStunTimer > 0 || this.dashTimer > 0) return;
    
    if (crouchActive && this.pos.y >= this.groundY) {
      this.state = 'CROUCH';
    } else if (!crouchActive && this.state === 'CROUCH') {
      this.state = 'IDLE';
    }
  }

  // Trigger dashes
  dash(directionSign) {
    if (this.state === 'DEFEATED' || this.hitStunTimer > 0 || this.blockStunTimer > 0 || this.isAttacking) return;
    if (this.pos.y < this.groundY) return; // Ground only
    
    this.dashTimer = 14;
    this.dashDir = directionSign;
    this.state = 'RUN';
    this.invincibilityTimer = 8; // dodges hits at the start of dash
    
    audio.playLaser();
    particles.createDashCloud(this.pos.x, this.pos.y, directionSign);
  }

  // Trigger attacks
  attack(type) {
    if (this.state === 'DEFEATED' || this.hitStunTimer > 0 || this.blockStunTimer > 0 || this.isAttacking || this.dashTimer > 0) return;
    if (this.attackCooldown > 0) return;

    // Energy threshold verification for Special attack
    if (type === 'special' && this.energy < 30) return;

    this.isAttacking = true;
    this.attackType = type;
    this.attackTimer = 0;
    this.state = 'ATTACK';
    this.vel.x = 0; // stop moving on strike

    // Setup hitbox dimensions and relative offsets
    switch (type) {
      case 'light':
        this.hitbox.width = 75;
        this.hitbox.height = 30;
        this.hitbox.xOffset = 10;
        this.hitbox.yOffset = -5;
        audio.playLaser();
        break;
      case 'heavy':
        this.hitbox.width = 90;
        this.hitbox.height = 45;
        this.hitbox.xOffset = 15;
        this.hitbox.yOffset = -15;
        audio.playLaser();
        // Give a slight forward lunge
        this.vel.x = this.dir * 4.5;
        break;
      case 'kick':
        this.hitbox.width = 85;
        this.hitbox.height = 25;
        this.hitbox.xOffset = 12;
        this.hitbox.yOffset = 20;
        audio.playLaser();
        break;
      case 'special':
        // Spend energy
        this.energy = Math.max(0, this.energy - 30);
        this.attackCooldown = 25; // added delay to avoid spamming
        
        audio.playSpecial();

        // Spawn Projectile
        const projX = this.pos.x + (this.width / 2) * this.dir;
        const projY = this.pos.y - this.height * 0.65;
        const pType = this.characterType === 'shadow' ? 'shuriken' : 'fireball';
        this.projectiles.push(new Projectile(projX, projY, this.dir, pType, this.color));
        break;
    }
  }

  // --- COLLISION DETECTION & FIGHT COMBAT LOGIC ---

  // Check overlap of P1 attack Hitbox -> P2 Hurtbox
  checkAttackCollision() {
    if (!this.opponent || this.opponent.state === 'DEFEATED' || this.opponent.invincibilityTimer > 0) return;

    const hb = this.hitbox;
    const opp = this.opponent.hurtbox;

    if (
      hb.pos.x < opp.pos.x + opp.width &&
      hb.pos.x + hb.width > opp.pos.x &&
      hb.pos.y < opp.pos.y + opp.height &&
      hb.pos.y + hb.height > opp.pos.y
    ) {
      // HIT REGISTERED! Deactivate hitbox instantly to prevent multi-hits in one stroke
      this.hitbox.active = false;
      
      const frameData = this.getAttackFrameData();
      const dmg = frameData ? frameData.damage : 10;
      const kb = frameData ? frameData.knockback : 4;
      const eg = frameData ? frameData.energyGain : 10;

      // Earn energy on successful hit
      this.gainEnergy(eg);

      this.opponent.takeDamage(dmg, kb, this.dir);
    }
  }

  // Check projectile impact on opponent
  checkProjectileCollision(proj) {
    if (!this.opponent || this.opponent.state === 'DEFEATED' || this.opponent.invincibilityTimer > 0) return;

    const opp = this.opponent.hurtbox;

    if (
      proj.x - proj.radius < opp.pos.x + opp.width &&
      proj.x + proj.radius > opp.pos.x &&
      proj.y - proj.radius < opp.pos.y + opp.height &&
      proj.y + proj.radius > opp.pos.y
    ) {
      proj.hitRegistered = true;
      proj.active = false;
      
      this.opponent.takeDamage(proj.damage, 6, proj.vx > 0 ? 1 : -1);
    }
  }

  takeDamage(amount, knockbackValue, attackerDirection) {
    // Determine blocking states
    // A block occurs if the target character is in IDLE/RUN/CROUCH state AND moving/holding away from the attack direction
    const isHoldingBack = (this.isPlayer2 && attackerDirection === 1) 
      ? (this.opponent.pos.x < this.pos.x && this.vel.x > 0.01) // moving away
      : (this.opponent.pos.x > this.pos.x && this.vel.x < -0.01);
      
    // Better blocking: if in crouch state or hit-stun is not active
    const isBlocking = (this.state === 'CROUCH' || this.state === 'BLOCK' || (this.vel.x * attackerDirection < -0.1)) && this.hitStunTimer <= 0;

    if (isBlocking) {
      // Reduced Guard Damage (10% of standard damage)
      const guardDmg = Math.max(1, Math.floor(amount * 0.1));
      this.health = Math.max(0, this.health - guardDmg);
      
      // Tiny knockback
      this.vel.x = attackerDirection * (knockbackValue * 0.25);
      this.blockStunTimer = 12; // Block stun lock
      
      // Spark sparks at shield position
      const sparkX = this.pos.x - (this.width / 3 * attackerDirection);
      const sparkY = this.pos.y - this.height * 0.6;
      particles.createBlockSparks(sparkX, sparkY, this.color);
      
      audio.playBlock();
      
      // Short blocking impact freeze
      if (window.game) {
        window.game.hitStopTimer = 4;
      }
      return;
    }

    // FULL DAMAGE
    this.health = Math.max(0, this.health - amount);
    
    // Knockback physics
    this.vel.x = attackerDirection * knockbackValue;
    this.vel.y = -3.5; // slight pop-up
    this.hitStunTimer = 22; // Hit stun lock frames
    this.isAttacking = false;
    
    // Trigger sparks
    const sparkX = this.pos.x - (this.width / 4 * attackerDirection);
    const sparkY = this.pos.y - this.height * 0.65;
    particles.createHitSparks(sparkX, sparkY, this.opponent.color);
    
    // Track Combo on Attacker
    if (this.opponent) {
      this.opponent.gainCombo();
    }

    // Audio hit splat sound and screen shakes/hit freeze
    if (amount >= 12) {
      audio.playHitSplat();
      if (window.game) {
        window.game.triggerScreenShake(14, 12);
        window.game.triggerHitFlash();
        window.game.hitStopTimer = 14; // Heavy hit stop frames
      }
    } else {
      audio.playPunch();
      if (window.game) {
        window.game.triggerScreenShake(6, 6);
        window.game.hitStopTimer = 7; // Light hit stop frames
      }
    }

    // Screen Shake effect can be handled in parent game file by setting shake parameter
  }

  gainEnergy(val) {
    this.energy = Math.min(this.maxEnergy, this.energy + val);
  }

  gainCombo() {
    this.comboCounter++;
    this.comboResetTimer = 100; // Reset combo after 1.6s of inactivity
  }

  drawFloorShadow(ctx) {
    const h = this.groundY - this.pos.y;
    const scale = Math.max(0.15, 1.0 - h / 400);
    const opacity = Math.max(0, 0.5 * (1.0 - h / 450));
    
    if (opacity <= 0) return;
    
    ctx.save();
    ctx.translate(this.pos.x, this.groundY);
    ctx.scale(scale, 0.3 * scale); // flat ellipse perspective
    
    const grad = ctx.createRadialGradient(0, 0, 5, 0, 0, this.width);
    grad.addColorStop(0, `rgba(0, 0, 0, ${opacity * 1.5})`);
    grad.addColorStop(0.5, `rgba(6, 2, 17, ${opacity * 0.8})`);
    grad.addColorStop(1, 'rgba(6, 2, 17, 0)');
    
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, this.width, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // --- PROCEDURAL NEON RENDERING ---

  draw(ctx, showHitboxes = false) {
    // Draw active projectiles
    this.projectiles.forEach(p => p.draw(ctx));

    ctx.save();
    
    // Visual indicators for damage hit flash
    if (this.hitStunTimer > 0 && Math.floor(this.animationTimer / 4) % 2 === 0) {
      ctx.shadowBlur = 35;
      ctx.shadowColor = '#ffffff';
    } else {
      ctx.shadowBlur = 18;
      ctx.shadowColor = this.color;
    }

    ctx.strokeStyle = this.color;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Calculate dynamic squash and stretch factors
    let squashX = 1.0;
    let squashY = 1.0;
    
    if (this.landingSquashTimer > 0) {
      const progress = this.landingSquashTimer / 8;
      squashY = 1.0 - 0.22 * progress;
      squashX = 1.0 + 0.15 * progress;
    } else if (this.pos.y < this.groundY) {
      const vLimit = Math.min(15, Math.abs(this.vel.y));
      squashY = 1.0 + vLimit * 0.015;
      squashX = 1.0 - vLimit * 0.010;
    }

    // High-frequency tremble/vibration in hit stop freeze
    let vibrateX = 0;
    if (this.state === 'HIT' && this.hitStunTimer > 0) {
      vibrateX = Math.sin(Date.now() * 0.12) * this.hitStunTimer * 0.45;
    }

    // Character drawing translations (mirroring based on dir + squash/stretch)
    ctx.translate(this.pos.x + vibrateX, this.pos.y);
    ctx.scale(this.dir * squashX, squashY);

    // Procedural skeletal drawing based on states
    this.drawSkeleton(ctx);

    ctx.restore();

    // Render visual hitbox lines (active debugging)
    if (showHitboxes) {
      // Draw Hurtbox (Green)
      ctx.strokeStyle = 'rgba(34, 197, 94, 0.6)';
      ctx.lineWidth = 2;
      ctx.strokeRect(this.hurtbox.pos.x, this.hurtbox.pos.y, this.hurtbox.width, this.hurtbox.height);

      // Draw Hitbox (Red)
      if (this.isAttacking && this.hitbox.active) {
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.8)';
        ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
        ctx.fillRect(this.hitbox.pos.x, this.hitbox.pos.y, this.hitbox.width, this.hitbox.height);
        ctx.strokeRect(this.hitbox.pos.x, this.hitbox.pos.y, this.hitbox.width, this.hitbox.height);
      }
    }
  }

  drawSkeleton(ctx) {
    const time = this.animationTimer;
    
    // --- CHIBI STYLIZATION: COMPACT BODY, BIG HEAD SILHOUETTE ---
    let head = { x: 0, y: -95 };
    let neck = { x: 0, y: -76 };
    let hip = { x: 0, y: -42 };
    
    let lShoulder = { x: -14, y: -72 };
    let rShoulder = { x: 14, y: -72 };
    let lElbow = { x: -22, y: -56 };
    let rElbow = { x: 22, y: -56 };
    let lHand = { x: -20, y: -42 };
    let rHand = { x: 20, y: -42 };
    
    let lHip = { x: -10, y: -42 };
    let rHip = { x: 10, y: -42 };
    let lKnee = { x: -12, y: -21 };
    let rKnee = { x: 12, y: -21 };
    let lFoot = { x: -14, y: 0 };
    let rFoot = { x: 14, y: 0 };

    // --- PROCEDURAL CHIBI JOINT KINEMATICS ---

    if (this.state === 'DEFEATED') {
      // Laying flat on ground
      head = { x: 38, y: -10 };
      neck = { x: 20, y: -10 };
      hip = { x: -20, y: -10 };
      lShoulder = { x: 15, y: -10 }; rShoulder = { x: 25, y: -10 };
      lElbow = { x: 15, y: -5 }; rElbow = { x: 28, y: -5 };
      lHand = { x: 12, y: 0 }; rHand = { x: 32, y: 0 };
      lHip = { x: -20, y: -10 }; rHip = { x: -16, y: -10 };
      lKnee = { x: -28, y: -8 }; rKnee = { x: -24, y: -8 };
      lFoot = { x: -36, y: 0 }; rFoot = { x: -32, y: 0 };
    } 
    else if (this.state === 'HIT') {
      // Whipping back in pain
      head = { x: -12, y: -90 };
      neck = { x: -6, y: -75 };
      hip = { x: 8, y: -42 };
      lShoulder = { x: -16, y: -65 }; rShoulder = { x: 8, y: -68 };
      lElbow = { x: -28, y: -52 }; rElbow = { x: 20, y: -60 };
      lHand = { x: -32, y: -36 }; rHand = { x: 24, y: -48 };
      lFoot = { x: -8, y: 0 }; rFoot = { x: 20, y: 0 };
    }
    else if (this.state === 'BLOCK') {
      // Double forearm shield defense
      head = { x: -4, y: -95 };
      lShoulder = { x: -8, y: -72 }; rShoulder = { x: 12, y: -72 };
      lHand = { x: 20, y: -82 }; rHand = { x: 16, y: -68 };
      lElbow = { x: 12, y: -78 }; rElbow = { x: 14, y: -64 };
      lFoot = { x: -12, y: 0 }; rFoot = { x: 12, y: 0 };
    }
    else if (this.state === 'CROUCH') {
      // Squat close to ground
      head = { x: 4, y: -65 };
      neck = { x: 2, y: -50 };
      hip = { x: -4, y: -28 };
      lShoulder = { x: -8, y: -48 }; rShoulder = { x: 12, y: -48 };
      lElbow = { x: -18, y: -38 }; rElbow = { x: 18, y: -38 };
      lHand = { x: -14, y: -24 }; rHand = { x: 14, y: -24 };
      
      lKnee = { x: -18, y: -14 }; rKnee = { x: 18, y: -14 };
      lFoot = { x: -20, y: 0 }; rFoot = { x: 20, y: 0 };
    }
    else if (this.state === 'JUMP') {
      // Dynamic jumping leg curl
      head.y = -100;
      lFoot = { x: -8, y: -20 };
      rFoot = { x: 8, y: -12 };
      lKnee = { x: -12, y: -36 };
      rKnee = { x: 12, y: -32 };
      
      // Float arms up
      lHand = { x: -28, y: -82 };
      rHand = { x: 28, y: -82 };
    } 
    else if (this.state === 'RUN') {
      // Sprint lean and cycle limbs
      const cycle = Math.sin(time * 0.22);
      const cycleCos = Math.cos(time * 0.22);
      
      head = { x: 10, y: -90 };
      neck = { x: 6, y: -76 };
      hip = { x: -8, y: -42 };
      
      // Arm swing
      lHand = { x: -20 + cycle * 24, y: -56 + cycleCos * 8 };
      rHand = { x: 16 - cycle * 28, y: -52 - cycleCos * 12 };
      
      // Running legs
      lFoot = { x: -8 + cycle * 22, y: cycle > 0 ? -12 * cycle : 0 };
      rFoot = { x: 8 - cycle * 22, y: cycle < 0 ? 12 * cycle : 0 };
    }
    else if (this.state === 'ATTACK') {
      const data = this.getAttackFrameData();
      if (data) {
        const attackProgress = this.attackTimer / data.total;
        
        if (this.attackType === 'light') {
          // Fast forward jab
          rHand = { 
            x: 20 + Math.sin(attackProgress * Math.PI) * 36, 
            y: -72 
          };
          rElbow = { x: 16 + Math.sin(attackProgress * Math.PI) * 16, y: -72 };
        } 
        else if (this.attackType === 'heavy') {
          // Slow massive downward swing
          rHand = { 
            x: 12 + Math.sin(attackProgress * Math.PI) * 44, 
            y: -110 + attackProgress * 88 
          };
          rElbow = { x: 14 + Math.sin(attackProgress * Math.PI) * 20, y: -80 + attackProgress * 24 };
        }
        else if (this.attackType === 'kick') {
          // Horizontal leg sweep kick
          rFoot = { 
            x: 14 + Math.sin(attackProgress * Math.PI) * 44, 
            y: -32 + Math.sin(attackProgress * Math.PI) * 16 
          };
          rKnee = { x: 12 + Math.sin(attackProgress * Math.PI) * 16, y: -24 };
          lHand = { x: -28, y: -52 };
        }
        else if (this.attackType === 'special') {
          // Spell/Energy thrust launch pose
          lHand = { x: 28, y: -66 };
          rHand = { x: 28, y: -60 };
          lElbow = { x: 14, y: -68 };
          rElbow = { x: 14, y: -62 };
        }
      }
    }
    else {
      // IDLE breathing bob
      const bob = Math.sin(time * 0.06) * 2.5;
      head.y += bob;
      neck.y += bob;
      lHand.y += bob / 2;
      rHand.y += bob / 2;
      
      if (this.characterType === 'blaze') {
        // Boxer stance hands up close to face
        lHand = { x: 12, y: -80 + bob };
        rHand = { x: 22, y: -74 + bob };
        lElbow = { x: 10, y: -62 };
        rElbow = { x: 18, y: -60 };
      } else {
        // Martial arts balance palms open stance
        lHand = { x: -22, y: -56 + bob };
        rHand = { x: 18, y: -68 + bob };
      }
    }

    // --- DYNAMIC LEANING OFFSET proportional to horizontal velocity ---
    if (this.state !== 'DEFEATED' && this.state !== 'CROUCH') {
      const lean = this.vel.x * this.dir * 1.3;
      
      head.x += lean;
      neck.x += lean * 0.8;
      hip.x += lean * 0.3;
      lShoulder.x += lean * 0.7;
      rShoulder.x += lean * 0.7;
      lElbow.x += lean * 0.6;
      rElbow.x += lean * 0.6;
      lHand.x += lean * 0.5;
      rHand.x += lean * 0.5;
    }

    // --- 3D Y-AXIS YAW ROTATION DETERMINATION ---
    let yaw = 0.22;
    if (this.state === 'IDLE') {
      yaw = 0.22 + Math.sin(time * 0.06) * 0.04;
    } else if (this.state === 'RUN') {
      yaw = 0.26 + Math.sin(time * 0.22) * 0.14;
    } else if (this.state === 'CROUCH') {
      yaw = 0.35;
    } else if (this.state === 'BLOCK') {
      yaw = 0.45;
    } else if (this.state === 'HIT') {
      yaw = -0.15;
    } else if (this.state === 'DEFEATED') {
      yaw = 0.0;
    } else if (this.state === 'ATTACK') {
      const data = this.getAttackFrameData();
      if (data) {
        const progress = this.attackTimer / data.total;
        if (this.attackType === 'light') {
          yaw = 0.22 + Math.sin(progress * Math.PI) * 0.3;
        } else if (this.attackType === 'heavy') {
          yaw = 0.22 - Math.sin(progress * Math.PI * 0.5) * 0.4 + Math.pow(progress, 2) * 0.7;
        } else if (this.attackType === 'kick') {
          yaw = 0.22 + Math.sin(progress * Math.PI) * 0.35;
        } else if (this.attackType === 'special') {
          yaw = 0.22 * (1.0 - Math.sin(progress * Math.PI));
        }
      }
    }

    // --- 3D PERSPECTIVE DIVISION PROJECTION MATH ---
    const project = (j, baseRadius) => {
      const cosY = Math.cos(yaw);
      const sinY = Math.sin(yaw);
      
      const rx = j.x * cosY + j.z * sinY;
      const rz = -j.x * sinY + j.z * cosY;
      const ry = j.y;
      
      const d = 300;
      const scale = d / (d + rz);
      
      return {
        px: rx * scale,
        py: ry * scale,
        pz: rz,
        pr: baseRadius * scale,
        baseRadius: baseRadius
      };
    };

    const headR = this.characterType === 'blaze' ? 23 : 22;

    const joints = {
      head: project({ x: head.x, y: head.y, z: 0 }, headR),
      neck: project({ x: neck.x, y: neck.y, z: 0 }, 5),
      hip: project({ x: hip.x, y: hip.y, z: 0 }, 7.5),
      lShoulder: project({ x: lShoulder.x, y: lShoulder.y, z: 12 }, 7),
      rShoulder: project({ x: rShoulder.x, y: rShoulder.y, z: -12 }, 7),
      lElbow: project({ x: lElbow.x, y: lElbow.y, z: 14 }, 6),
      rElbow: project({ x: rElbow.x, y: rElbow.y, z: -14 }, 6),
      lHand: project({ x: lHand.x, y: lHand.y, z: 16 }, 7.5),
      rHand: project({ x: rHand.x, y: rHand.y, z: -16 }, 7.5),
      lHip: project({ x: lHip.x, y: lHip.y, z: 6 }, 7),
      rHip: project({ x: rHip.x, y: rHip.y, z: -6 }, 7),
      lKnee: project({ x: lKnee.x, y: lKnee.y, z: 8 }, 6),
      rKnee: project({ x: rKnee.x, y: rKnee.y, z: -8 }, 6),
      lFoot: project({ x: lFoot.x, y: lFoot.y, z: 10 }, 8),
      rFoot: project({ x: rFoot.x, y: rFoot.y, z: -10 }, 8)
    };

    const bones = [
      { from: joints.neck, to: joints.hip, baseThickness: 6 },
      { from: joints.lShoulder, to: joints.rShoulder, baseThickness: 5.5 },
      { from: joints.lShoulder, to: joints.lElbow, baseThickness: 5 },
      { from: joints.lElbow, to: joints.lHand, baseThickness: 4.5 },
      { from: joints.rShoulder, to: joints.rElbow, baseThickness: 5 },
      { from: joints.rElbow, to: joints.rHand, baseThickness: 4.5 },
      { from: joints.lHip, to: joints.rHip, baseThickness: 6 },
      { from: joints.lHip, to: joints.lKnee, baseThickness: 5.5 },
      { from: joints.lKnee, to: joints.lFoot, baseThickness: 5 },
      { from: joints.rHip, to: joints.rKnee, baseThickness: 5.5 },
      { from: joints.rKnee, to: joints.rFoot, baseThickness: 5 }
    ];

    // Build Painter's depth rendering queue
    const renderQueue = [];
    
    // Add joints to queue
    Object.keys(joints).forEach(name => {
      renderQueue.push({
        type: 'joint',
        name: name,
        z: joints[name].pz,
        draw: () => {
          const j = joints[name];
          const r = j.pr;
          
          if (name === 'head') {
            // Volumetric head circle
            const grad = ctx.createRadialGradient(
              j.px - r / 3, j.py - r / 3, r / 10,
              j.px, j.py, r
            );
            grad.addColorStop(0, '#ffffff');
            grad.addColorStop(0.25, this.color);
            grad.addColorStop(1, '#070314');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(j.px, j.py, r, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw character-specific overlays
            if (this.characterType === 'shadow') {
              ctx.save();
              ctx.strokeStyle = this.color;
              ctx.lineWidth = 3 * (r / 22);
              ctx.shadowColor = this.glowColor;
              ctx.shadowBlur = 8;
              
              const ribbonPhase1 = Math.sin(time * 0.12) * 10;
              const ribbonPhase2 = Math.cos(time * 0.12) * 12;
              
              ctx.beginPath();
              ctx.moveTo(j.px - r, j.py - 2 * (r / 22));
              ctx.bezierCurveTo(
                j.px - r - 13 * (r / 22), j.py + ribbonPhase1 * (r / 22),
                j.px - r - 18 * (r / 22), j.py + (10 + ribbonPhase1) * (r / 22),
                j.px - r - 26 * (r / 22), j.py + 8 * (r / 22)
              );
              ctx.stroke();
              
              ctx.beginPath();
              ctx.moveTo(j.px - r, j.py + 3 * (r / 22));
              ctx.bezierCurveTo(
                j.px - r - 10 * (r / 22), j.py + (10 + ribbonPhase2) * (r / 22),
                j.px - r - 16 * (r / 22), j.py + (18 + ribbonPhase2) * (r / 22),
                j.px - r - 24 * (r / 22), j.py + 22 * (r / 22)
              );
              ctx.stroke();
              ctx.restore();
              
              ctx.fillStyle = this.color;
              ctx.beginPath();
              ctx.moveTo(j.px - 14 * (r / 22), j.py - 4 * (r / 22));
              ctx.lineTo(j.px + 18 * (r / 22), j.py - 4 * (r / 22));
              ctx.lineTo(j.px + 14 * (r / 22), j.py + 5 * (r / 22));
              ctx.lineTo(j.px - 10 * (r / 22), j.py + 5 * (r / 22));
              ctx.closePath();
              ctx.fill();
              
              ctx.fillStyle = '#ffffff';
              ctx.beginPath();
              ctx.ellipse(j.px - 3 * (r / 22), j.py, 4 * (r / 22), 1.2 * (r / 22), 0, 0, Math.PI * 2);
              ctx.ellipse(j.px + 9 * (r / 22), j.py, 4 * (r / 22), 1.2 * (r / 22), 0, 0, Math.PI * 2);
              ctx.fill();
            } else if (this.characterType === 'blaze') {
              ctx.save();
              ctx.fillStyle = '#ff3c00';
              ctx.strokeStyle = '#ffd700';
              ctx.lineWidth = 1.5 * (r / 23);
              ctx.shadowBlur = 10;
              ctx.shadowColor = '#ff0055';
              
              const fireWobble = Math.sin(time * 0.18) * 3;
              
              ctx.beginPath();
              ctx.moveTo(j.px - 21 * (r / 23), j.py - 8 * (r / 23));
              ctx.lineTo(j.px - 28 * (r / 23), j.py - (25 - fireWobble) * (r / 23));
              ctx.lineTo(j.px - 14 * (r / 23), j.py - 20 * (r / 23));
              ctx.lineTo(j.px - 16 * (r / 23), j.py - (38 - fireWobble) * (r / 23));
              ctx.lineTo(j.px - 4 * (r / 23), j.py - 24 * (r / 23));
              ctx.lineTo(j.px + 2 * (r / 23), j.py - (42 + fireWobble) * (r / 23));
              ctx.lineTo(j.px + 8 * (r / 23), j.py - 24 * (r / 23));
              ctx.lineTo(j.px + 22 * (r / 23), j.py - (30 - fireWobble) * (r / 23));
              ctx.lineTo(j.px + 20 * (r / 23), j.py - 6 * (r / 23));
              ctx.closePath();
              ctx.fill();
              ctx.stroke();
              ctx.restore();
              
              ctx.fillStyle = '#ff0055';
              ctx.beginPath();
              ctx.arc(j.px, j.py, r, -0.6 * Math.PI, -0.2 * Math.PI);
              ctx.lineWidth = 4 * (r / 23);
              ctx.strokeStyle = '#ff0055';
              ctx.stroke();
              
              ctx.save();
              ctx.fillStyle = '#ffd700';
              ctx.shadowColor = '#ffeb3b';
              ctx.shadowBlur = 8;
              ctx.beginPath();
              ctx.ellipse(j.px - 6 * (r / 23), j.py + 4 * (r / 23), 4 * (r / 23), 2 * (r / 23), -0.15, 0, Math.PI * 2);
              ctx.ellipse(j.px + 6 * (r / 23), j.py + 4 * (r / 23), 4 * (r / 23), 2 * (r / 23), 0.15, 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();
            }
          } else {
            // Draw joint sphere with radial metallic glint
            const grad = ctx.createRadialGradient(
              j.px - r / 3, j.py - r / 3, r / 10,
              j.px, j.py, r
            );
            grad.addColorStop(0, '#ffffff');
            grad.addColorStop(0.2, this.color);
            grad.addColorStop(1, '#070314');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(j.px, j.py, r, 0, Math.PI * 2);
            ctx.fill();
            
            // Blaze Fire Knuckles dynamic effects
            if (this.characterType === 'blaze' && this.state !== 'DEFEATED' && (name === 'lHand' || name === 'rHand')) {
              ctx.save();
              ctx.fillStyle = '#ff3c00';
              ctx.shadowColor = '#ff0055';
              ctx.shadowBlur = 15;
              ctx.beginPath();
              ctx.arc(j.px, j.py, r * 1.25, 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();
              
              if (this.isAttacking && this.attackTimer % 2 === 0 && name === 'rHand') {
                particles.createChargeAura(this.pos.x + j.px * this.dir, this.pos.y + j.py, '#ff0055');
              }
            }
          }
        }
      });
    });
    
    // Add bones to queue
    bones.forEach(b => {
      renderQueue.push({
        type: 'bone',
        z: (b.from.pz + b.to.pz) / 2,
        draw: () => {
          const from = b.from;
          const to = b.to;
          const pxA = from.px;
          const pyA = from.py;
          const pxB = to.px;
          const pyB = to.py;
          
          const dx = pxB - pxA;
          const dy = pyB - pyA;
          const len = Math.hypot(dx, dy);
          if (len < 0.1) return;
          
          const angle = Math.atan2(dy, dx);
          const norm = angle + Math.PI / 2;
          
          const scaleA = from.pr / from.baseRadius;
          const scaleB = to.pr / to.baseRadius;
          
          const thicknessA = b.baseThickness * scaleA;
          const thicknessB = b.baseThickness * scaleB;
          
          ctx.beginPath();
          ctx.moveTo(pxA + Math.cos(norm) * thicknessA, pyA + Math.sin(norm) * thicknessA);
          ctx.lineTo(pxB + Math.cos(norm) * thicknessB, pyB + Math.sin(norm) * thicknessB);
          ctx.lineTo(pxB - Math.cos(norm) * thicknessB, pyB - Math.sin(norm) * thicknessB);
          ctx.lineTo(pxA - Math.cos(norm) * thicknessA, pyA - Math.sin(norm) * thicknessA);
          ctx.closePath();
          
          const grad = ctx.createLinearGradient(
            pxA + Math.cos(norm) * thicknessA, pyA + Math.sin(norm) * thicknessA,
            pxA - Math.cos(norm) * thicknessA, pyA - Math.sin(norm) * thicknessA
          );
          grad.addColorStop(0, '#070314');
          grad.addColorStop(0.3, this.color);
          grad.addColorStop(0.5, '#ffffff'); // shiny light reflect center
          grad.addColorStop(0.7, this.color);
          grad.addColorStop(1, '#070314');
          
          ctx.fillStyle = grad;
          ctx.fill();
        }
      });
    });
    
    // Add Sword blade / slash arc to queue if Shadow
    if (this.characterType === 'shadow' && this.state !== 'DEFEATED') {
      let pSwordStart, pSwordEnd;
      if (this.isAttacking && (this.attackType === 'light' || this.attackType === 'heavy')) {
        pSwordStart = project({ x: rHand.x, y: rHand.y, z: -16 }, 2);
        pSwordEnd = project({ x: rHand.x + 36, y: rHand.y - 8, z: -16 }, 2);
      } else {
        pSwordStart = project({ x: hip.x - 4, y: hip.y - 6, z: 8 }, 2);
        pSwordEnd = project({ x: neck.x - 18, y: neck.y - 24, z: 8 }, 2);
      }
      
      renderQueue.push({
        type: 'sword',
        z: (pSwordStart.pz + pSwordEnd.pz) / 2,
        draw: () => {
          ctx.save();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2.5 * (pSwordStart.pr / 2);
          ctx.shadowColor = '#00f3ff';
          ctx.shadowBlur = 10;
          
          ctx.beginPath();
          ctx.moveTo(pSwordStart.px, pSwordStart.py);
          ctx.lineTo(pSwordEnd.px, pSwordEnd.py);
          ctx.stroke();
          
          if (this.isAttacking && (this.attackType === 'light' || this.attackType === 'heavy')) {
            ctx.strokeStyle = 'rgba(0, 243, 255, 0.45)';
            ctx.lineWidth = 6 * (pSwordStart.pr / 2);
            ctx.beginPath();
            ctx.arc(pSwordStart.px + 10 * (pSwordStart.pr / 2), pSwordStart.py - 4 * (pSwordStart.pr / 2), 25 * (pSwordStart.pr / 2), -Math.PI / 4, Math.PI / 4);
            ctx.stroke();
          }
          ctx.restore();
        }
      });
    }
    
    // Z depth sorting (largest Z to smallest Z)
    renderQueue.sort((a, b) => b.z - a.z);
    
    // Draw in order
    renderQueue.forEach(item => item.draw());
  }

  reset(x, y) {
    this.pos = { x, y };
    this.vel = { x: 0, y: 0 };
    this.health = this.maxHealth;
    this.energy = 0;
    this.state = 'IDLE';
    this.isAttacking = false;
    this.attackType = null;
    this.attackCooldown = 0;
    this.hitStunTimer = 0;
    this.blockStunTimer = 0;
    this.invincibilityTimer = 0;
    this.comboCounter = 0;
    this.projectiles = [];
    this.dir = this.isPlayer2 ? -1 : 1;
    this.doubleJumpCount = 0;
  }
}
