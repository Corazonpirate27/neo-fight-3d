import * as THREE from 'three';
import { Fighter } from '../entities/Fighter';
import { Hitbox, Hurtbox, Pushbox } from './Hitbox';

export interface Projectile {
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  owner: Fighter;
  radius: number;
  damage: number;
  knockback: number;
  active: boolean;
  color: string;
}

export class CombatSystem {
  private p1Hurtbox: Hurtbox = new Hurtbox();
  private p2Hurtbox: Hurtbox = new Hurtbox();
  
  private p1Hitbox: Hitbox = new Hitbox(1.5); // Attack sphere
  private p2Hitbox: Hitbox = new Hitbox(1.5);
  
  private p1Pushbox: Pushbox = new Pushbox(2.2); // Character boundary sphere
  private p2Pushbox: Pushbox = new Pushbox(2.2);

  private projectiles: Projectile[] = [];
  private scene: THREE.Scene;

  // Global visual indicators
  public hitStopTimer: number = 0;
  
  // Combos counters
  public p1ComboHits: number = 0;
  public p1ComboDamage: number = 0;
  public p1ComboTimer: number = 0;

  public p2ComboHits: number = 0;
  public p2ComboDamage: number = 0;
  public p2ComboTimer: number = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  public reset(): void {
    // Clean all active projectiles
    this.projectiles.forEach(p => this.scene.remove(p.mesh));
    this.projectiles = [];
    
    this.hitStopTimer = 0;
    this.resetCombos(1);
    this.resetCombos(2);
  }

  public update(p1: Fighter, p2: Fighter): void {
    if (this.hitStopTimer > 0) {
      this.hitStopTimer--;
      // Hold models completely frozen during active hitstop
      p1.vel.set(0, 0, 0);
      p2.vel.set(0, 0, 0);
      return;
    }

    // 1. Update pushboxes and resolve character-to-character solid boundaries
    if (p1.state !== 'defeated' && p2.state !== 'defeated') {
      this.p1Pushbox.update(p1.pos);
      this.p2Pushbox.update(p2.pos);
      
      if (this.p1Pushbox.intersects(this.p2Pushbox)) {
        this.p1Pushbox.resolveOverlap(this.p2Pushbox, p1, p2);
      }
    }

    // 2. Extract real-time world joint coordinates
    const p1TorsoPos = new THREE.Vector3();
    p1.torsoNode.getWorldPosition(p1TorsoPos);
    this.p1Hurtbox.update(p1TorsoPos, p1.isCrouching, p1.name === 'Vanguard-01');

    const p2TorsoPos = new THREE.Vector3();
    p2.torsoNode.getWorldPosition(p2TorsoPos);
    this.p2Hurtbox.update(p2TorsoPos, p2.isCrouching, p2.name === 'Vanguard-01');

    // 3. Update and check attack hitboxes
    this.updateFighterHitbox(p1, this.p1Hitbox);
    this.updateFighterHitbox(p2, this.p2Hitbox);
    
    // Check P1 Active Attacks -> P2 Hurtbox
    if (this.p1Hitbox.isActive && this.p1Hitbox.intersects(this.p2Hurtbox) && p2.invincibilityTimer <= 0) {
      this.resolveHit(p1, p2, this.p1Hitbox);
    }
    
    // Check P2 Active Attacks -> P1 Hurtbox
    if (this.p2Hitbox.isActive && this.p2Hitbox.intersects(this.p1Hurtbox) && p1.invincibilityTimer <= 0) {
      this.resolveHit(p2, p1, this.p2Hitbox);
    }

    // 4. Update and check 3D Special Projectiles
    this.updateProjectiles(p1, p2);
    
    // 5. Tick combo timers
    if (this.p1ComboTimer > 0) {
      this.p1ComboTimer--;
      if (this.p1ComboTimer === 0) this.resetCombos(1);
    }
    
    if (this.p2ComboTimer > 0) {
      this.p2ComboTimer--;
      if (this.p2ComboTimer === 0) this.resetCombos(2);
    }
  }

  private updateFighterHitbox(fighter: Fighter, hitbox: Hitbox): void {
    // Map attack parameters depending on attack state frames
    if (fighter.state === 'attack_light' && fighter.attackTimer > 6 && fighter.attackTimer < 10) {
      // Fast jab frame active
      const nodePos = new THREE.Vector3();
      fighter.rightHandNode.getWorldPosition(nodePos);
      
      hitbox.isActive = true;
      hitbox.radius = 1.6;
      hitbox.damage = 10;
      hitbox.knockback = 0.38;
      hitbox.update(nodePos);
    } 
    else if (fighter.state === 'attack_heavy' && fighter.attackTimer > 10 && fighter.attackTimer < 16) {
      // Slow heavy frame active
      const nodePos = new THREE.Vector3();
      fighter.rightHandNode.getWorldPosition(nodePos);
      
      hitbox.isActive = true;
      hitbox.radius = 2.4;
      hitbox.damage = 25;
      hitbox.knockback = 0.85;
      hitbox.update(nodePos);
    } 
    else if (fighter.state === 'attack_kick' && fighter.attackTimer > 8 && fighter.attackTimer < 13) {
      // Mid sweep active (crouching version scores a knockdown)
      const nodePos = new THREE.Vector3();
      fighter.rightFootNode.getWorldPosition(nodePos);

      hitbox.isActive = true;
      hitbox.radius = 1.9;
      hitbox.damage = fighter.isSweeping ? 14 : 15;
      hitbox.knockback = fighter.isSweeping ? 0.9 : 0.55;
      hitbox.update(nodePos);
    }
    else if (fighter.state === 'attack_shoryuken' && fighter.attackTimer > 20 && fighter.attackTimer < 32) {
      // Rising dragon punch: fist is active on the way up, launches on hit
      const nodePos = new THREE.Vector3();
      fighter.rightHandNode.getWorldPosition(nodePos);

      hitbox.isActive = true;
      hitbox.radius = 2.1;
      hitbox.damage = 24;
      hitbox.knockback = 0.5;
      hitbox.update(nodePos);
    }
    else if (fighter.state === 'attack_hurricane' && fighter.attackTimer > 6 && fighter.attackTimer < 30) {
      // Spinning kick: long active window (hitstop spaces out repeat hits)
      const nodePos = new THREE.Vector3();
      fighter.rightFootNode.getWorldPosition(nodePos);

      hitbox.isActive = true;
      hitbox.radius = 2.2;
      hitbox.damage = 12;
      hitbox.knockback = 0.7;
      hitbox.update(nodePos);
    }
    else {
      hitbox.isActive = false;
    }
  }

  private resolveHit(attacker: Fighter, defender: Fighter, hitbox: Hitbox): void {
    hitbox.isActive = false; // Disable hitbox immediately on first contact frame
    
    const attackDirSign = attacker.pos.x < defender.pos.x ? 1 : -1;
    const cleanHit = defender.takeDamage(hitbox.damage, hitbox.knockback, attackDirSign);

    if (cleanHit) {
      // Street Fighter hit reactions
      if (attacker.state === 'attack_shoryuken') {
        // Shoryuken launches the defender skyward
        defender.vel.y = 0.72;
        defender.hitStunTimer = Math.max(defender.hitStunTimer, 34);
      } else if (attacker.isSweeping) {
        // Crouching sweep scores a knockdown
        defender.vel.y = 0.38;
        defender.hitStunTimer = Math.max(defender.hitStunTimer, 42);
      }

      // Accumulate combo stats on attacker
      if (attacker.id === 1) {
        this.p1ComboHits++;
        this.p1ComboDamage += hitbox.damage;
        this.p1ComboTimer = 120; // reset combo reset timeout
        this.dispatchComboEvent(1, this.p1ComboHits, this.p1ComboDamage);
      } else {
        this.p2ComboHits++;
        this.p2ComboDamage += hitbox.damage;
        this.p2ComboTimer = 120;
        this.dispatchComboEvent(2, this.p2ComboHits, this.p2ComboDamage);
      }
      
      // Trigger Hitstop freeze frames (organic weight simulation)
      this.hitStopTimer = hitbox.damage >= 20 ? 14 : 7;
      
      // Flash screen / shake camera
      const cameraShakeEvent = new CustomEvent('camerashake', {
        detail: { amount: hitbox.damage >= 20 ? 12 : 5, duration: hitbox.damage >= 20 ? 16 : 8 }
      });
      window.dispatchEvent(cameraShakeEvent);
    } else {
      // Block freeze stop
      this.hitStopTimer = 4;
    }
  }

  // --- 3D PROJECTILE MANAGEMENT ---
  // EX projectile (meter-spending version, kept from the arena prototype)
  public spawnSpecialProjectile(owner: Fighter): void {
    if (owner.energy < 30) return;
    owner.energy -= 30; // Deduct special energy
    this.spawnFireball(owner, 35, 0.65, 0.45, 1.2, false);
  }

  // Street Fighter Hadouken: free command fireball off a quarter-circle motion
  public spawnHadouken(owner: Fighter): void {
    this.spawnFireball(owner, 16, 0.55, 0.5, 1.0, false);
  }

  // Super Combo: spends a full super meter for a massive screen-clearing fireball
  public spawnSuperFireball(owner: Fighter): void {
    this.spawnFireball(owner, 55, 1.0, 0.42, 1.7, true);
  }

  private spawnFireball(owner: Fighter, damage: number, knockback: number, speed: number, sizeScale: number, isSuper: boolean): void {
    const isVanguard = owner.name === 'Vanguard-01';
    const colorHex = isSuper ? 0xffd23a : (isVanguard ? 0x00f3ff : 0xff3300);

    // Geometry & Material
    const geom = isVanguard && !isSuper
      ? new THREE.CylinderGeometry(1.2 * sizeScale, 1.2 * sizeScale, 0.15, 8) // Cyan energy disk
      : new THREE.SphereGeometry(0.85 * sizeScale, 12, 12);                   // Fire sphere

    const mat = new THREE.MeshBasicMaterial({
      color: colorHex,
      wireframe: isVanguard && !isSuper
    });

    const mesh = new THREE.Mesh(geom, mat);
    mesh.castShadow = true;

    const spawnPos = new THREE.Vector3();
    owner.rightHandNode.getWorldPosition(spawnPos);
    spawnPos.z = 0;
    mesh.position.copy(spawnPos);

    if (isVanguard && !isSuper) {
      mesh.rotation.x = Math.PI / 2; // Flat horizontal rotating disk
    }

    this.scene.add(mesh);

    const proj: Projectile = {
      mesh,
      pos: mesh.position,
      vel: new THREE.Vector3(owner.dirSign * speed, 0, 0), // Travel horizontal
      owner,
      radius: (isVanguard && !isSuper ? 1.4 : 1.0) * sizeScale,
      damage,
      knockback,
      active: true,
      color: isSuper ? '#ffd23a' : (isVanguard ? '#00f3ff' : '#ff0055')
    };

    this.projectiles.push(proj);

    // Sound trigger
    const soundEvent = new CustomEvent('playprojectile', { detail: { isP1: owner.id === 1 } });
    window.dispatchEvent(soundEvent);
  }

  private updateProjectiles(p1: Fighter, p2: Fighter): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      if (!p.active) continue;
      
      // Update coordinates
      p.pos.add(p.vel);
      p.mesh.position.copy(p.pos);
      
      // Spin Vanguard disc
      if (p.owner.name === 'Vanguard-01') {
        p.mesh.rotation.y += 0.25;
      }
      
      // Check boundaries
      if (Math.abs(p.pos.x) >= 24.5) {
        p.active = false;
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
        continue;
      }
      
      // Check intersections
      const target = p.owner.id === 1 ? p2 : p1;
      const targetHurtbox = p.owner.id === 1 ? this.p2Hurtbox : this.p1Hurtbox;
      
      const closestPoint = new THREE.Vector3();
      targetHurtbox.box.clampPoint(p.pos, closestPoint);
      
      if (p.pos.distanceToSquared(closestPoint) <= p.radius * p.radius && target.invincibilityTimer <= 0) {
        // EXPLOSION HIT!
        p.active = false;
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
        
        const attackDirSign = p.owner.pos.x < target.pos.x ? 1 : -1;
        const hit = target.takeDamage(p.damage, p.knockback, attackDirSign);
        
        if (hit) {
          this.hitStopTimer = 16; // Projectile heavy explosion hitstop
          
          const cameraShakeEvent = new CustomEvent('camerashake', {
            detail: { amount: 16, duration: 20 }
          });
          window.dispatchEvent(cameraShakeEvent);
        }
      }
    }
  }

  private resetCombos(playerNum: 1 | 2): void {
    if (playerNum === 1) {
      this.p1ComboHits = 0;
      this.p1ComboDamage = 0;
      this.p1ComboTimer = 0;
    } else {
      this.p2ComboHits = 0;
      this.p2ComboDamage = 0;
      this.p2ComboTimer = 0;
    }
    this.dispatchComboEvent(playerNum, 0, 0);
  }

  private dispatchComboEvent(playerNum: 1 | 2, hits: number, dmg: number): void {
    const event = new CustomEvent('comboupdate', { detail: { playerNum, hits, dmg } });
    window.dispatchEvent(event);
  }
}
