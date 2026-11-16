import * as THREE from 'three';
import { AssetLoader } from '../core/AssetLoader';
import { InputManager } from '../input/InputManager';

export type FighterState = 'idle' | 'walk' | 'jump' | 'block' | 'dash' | 'hitstun' | 'blockstun' | 'attack_light' | 'attack_heavy' | 'attack_kick' | 'attack_special' | 'attack_shoryuken' | 'attack_hurricane' | 'attack_super' | 'defeated';

const ATTACK_STATES: ReadonlySet<FighterState> = new Set([
  'attack_light', 'attack_heavy', 'attack_kick',
  'attack_special', 'attack_shoryuken', 'attack_hurricane', 'attack_super'
]);

export class Fighter {
  public name: string;
  public id: 1 | 2;
  public opponent!: Fighter;
  public isPlayer2: boolean = false;
  
  // Visual groups
  public group: THREE.Group;
  public meshGroup: THREE.Group; // Visual components that stretch/squash
  
  // Hierarchical node bounds (for hitbox mapping)
  public headNode!: THREE.Object3D;
  public torsoNode!: THREE.Object3D;
  public leftHandNode!: THREE.Object3D;
  public rightHandNode!: THREE.Object3D;
  public leftFootNode!: THREE.Object3D;
  public rightFootNode!: THREE.Object3D;

  // Hierarchical skeleton joints for arm structures
  public lUpperArm!: THREE.Group;
  public lLowerArm!: THREE.Group;
  public rUpperArm!: THREE.Group;
  public rLowerArm!: THREE.Group;

  // Hierarchical skeleton joints for leg structures
  public lThigh!: THREE.Group;
  public lShin!: THREE.Group;
  public rThigh!: THREE.Group;
  public rShin!: THREE.Group;

  // Dynamic visual assets / trims
  private scarfSegments: THREE.Group[] = [];
  private thrusterGlows: THREE.Mesh[] = [];
  private spriteTextures: Partial<Record<FighterState | 'default', THREE.CanvasTexture>> = {};
  private spriteMesh?: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private currentSpriteKey: FighterState | 'default' = 'default';
  
  // Stance breathing twist angle
  private breathTime: number = 0;

  // Kinematic Physics variables
  public pos: THREE.Vector3 = new THREE.Vector3();
  public vel: THREE.Vector3 = new THREE.Vector3();
  public dirSign: number = 1; // 1 = facing right, -1 = facing left
  public groundY: number = 0;
  
  // Fight stats
  public health: number = 300;
  public maxHealth: number = 300;
  public energy: number = 0;
  public maxEnergy: number = 100;
  
  // State machine variables
  public state: FighterState = 'idle';
  public isCrouching: boolean = false;
  public isGrounded: boolean = true;
  
  // Attack frame indicators
  public attackTimer: number = 0;
  public hitStunTimer: number = 0;
  public blockStunTimer: number = 0;
  public dashTimer: number = 0;
  public invincibilityTimer: number = 0;
  public recoveryTimer: number = 0;

  // Street Fighter mechanics
  public isSweeping: boolean = false; // crouching sweep = knockdown on hit
  public pendingProjectile: 'hadouken' | 'super' | 'ex' | null = null;
  public projectileDelay: number = 0;
  
  // Visual shake / tremble
  public trembleAmount: number = 0;
  
  // Dynamic Squash & Stretch frames
  private squashTimer: number = 0;
  private currentSquashX: number = 1;
  private currentSquashY: number = 1;

  // Sound placeholders
  public color: string;

  constructor(id: 1 | 2, name: string, color: string, startX: number, scene: THREE.Scene) {
    this.id = id;
    this.isPlayer2 = id === 2;
    this.name = name;
    this.color = color;
    this.dirSign = this.isPlayer2 ? -1 : 1;
    this.pos.set(startX, 0, 0); // Ground plane is y = 0
    
    this.group = new THREE.Group();
    this.group.position.copy(this.pos);
    scene.add(this.group);
    
    this.meshGroup = new THREE.Group();
    this.group.add(this.meshGroup);
    
    // Assemble the procedural low-poly visual nodes!
    this.buildCharacterMesh();
    
    this.breathTime = Math.random() * 100;
  }

  public reset(startX: number): void {
    this.pos.set(startX, 0, 0);
    this.vel.set(0, 0, 0);
    this.group.position.copy(this.pos);
    this.dirSign = this.isPlayer2 ? -1 : 1;
    
    this.health = this.maxHealth;
    this.energy = 0;
    this.state = 'idle';
    this.isCrouching = false;
    this.isGrounded = true;
    
    this.attackTimer = 0;
    this.hitStunTimer = 0;
    this.blockStunTimer = 0;
    this.dashTimer = 0;
    this.invincibilityTimer = 0;
    this.recoveryTimer = 0;
    this.trembleAmount = 0;
    this.isSweeping = false;
    this.pendingProjectile = null;
    this.projectileDelay = 0;

    this.meshGroup.position.set(0, 0, 0);
    this.meshGroup.rotation.set(0, 0, 0);
    this.meshGroup.scale.set(1, 1, 1);
  }

  public update(time: number): void {
    // 1. Tick state and timers
    this.tickTimers();
    
    // 2. Resolve movements
    if (this.state !== 'defeated' && this.hitStunTimer <= 0 && this.blockStunTimer <= 0) {
      this.resolveStateMovements();
    }
    
    // 3. Process kinematic gravity
    this.applyKinematicPhysics();
    
    // 4. Stance Breathing & visual lean updates
    this.animateVisualModel(time);
  }

  private tickTimers(): void {
    if (this.invincibilityTimer > 0) this.invincibilityTimer--;
    
    if (this.hitStunTimer > 0) {
      this.hitStunTimer--;
      if (this.hitStunTimer === 0) this.state = 'idle';
    }
    
    if (this.blockStunTimer > 0) {
      this.blockStunTimer--;
      if (this.blockStunTimer === 0) this.state = 'idle';
    }
    
    if (this.dashTimer > 0) {
      this.dashTimer--;
      if (this.dashTimer === 0) {
        this.state = 'idle';
        this.vel.x = 0;
        this.vel.z = 0;
      }
    }
    
    if (this.attackTimer > 0) {
      this.attackTimer--;
      if (this.attackTimer === 0) {
        if (this.state !== 'defeated') {
          this.state = this.isGrounded ? 'idle' : 'jump';
        }
        this.isSweeping = false;
      }
    }
    
    if (this.squashTimer > 0) {
      this.squashTimer--;
      if (this.squashTimer === 0) {
        this.currentSquashX = 1;
        this.currentSquashY = 1;
      }
    }
  }

  public isAttacking(): boolean {
    return ATTACK_STATES.has(this.state);
  }

  private resolveStateMovements(): void {
    if (this.state === 'attack_shoryuken') {
      // Rising uppercut: fully ballistic, keeps its launch momentum
      return;
    }
    if (this.state === 'attack_hurricane') {
      // Hurricane kick travels forward with a floaty spin
      this.vel.x = this.dirSign * 0.42;
      this.vel.y = Math.max(this.vel.y, -0.03);
      return;
    }
    if (this.isAttacking()) {
      // Grounded attacks preserve a little committed momentum, then bleed it off.
      this.vel.x *= 0.72;
      this.vel.z *= 0.72;
      return;
    }
    
    // Face the opponent at all times unless defeated or special movement
    const toOpponent = this.opponent.pos.x - this.pos.x;
    if (Math.abs(toOpponent) > 0.1) {
      this.dirSign = toOpponent > 0 ? 1 : -1;
    }
    
    // Check Dashing (horizontal double tap consumed)
    const dash = InputManager.consumeDash(this.id);
    if (dash && this.isGrounded && this.energy >= 20) {
      this.state = 'dash';
      this.dashTimer = 14;
      this.energy = Math.max(0, this.energy - 20);
      
      const dashDir = dash === 'left' ? -1 : 1;
      this.vel.x = dashDir * 1.55;
      this.vel.z = 0;
      this.invincibilityTimer = 8; // startup invincibility
      this.currentSquashX = 1.22;
      this.currentSquashY = 0.88;
      this.squashTimer = 10;
      return;
    }
    
    if (this.state === 'dash') return;

    // Movement speeds (Street Fighter walks: forward slightly faster than backward)
    const walkSpeed = 0.38;

    // Directions input — pure 2D plane, no sidestepping
    const isMovingLeft = InputManager.isActionPressed('left', this.id);
    const isMovingRight = InputManager.isActionPressed('right', this.id);
    const isHoldingUp = InputManager.isActionPressed('up', this.id);
    const isHoldingDown = InputManager.isActionPressed('down', this.id);

    // Crouching: hold DOWN like Street Fighter (crouch-block by also holding back)
    this.isCrouching = isHoldingDown && this.isGrounded;
    if (this.isCrouching) {
      this.state = 'block'; // reuse crouch pose
      this.vel.x *= 0.55;
      this.vel.z *= 0.55;
      return;
    }

    // Manual High Guard (dedicated block button still supported)
    const isBlocking = InputManager.isActionPressed('block', this.id);
    if (isBlocking && this.isGrounded) {
      this.state = 'block';
      this.vel.x *= 0.55;
      this.vel.z *= 0.55;
      return;
    }

    // Standard horizontal walk movement; walking back doubles as pre-guard
    let mvX = 0;
    if (isMovingLeft) mvX = -walkSpeed;
    if (isMovingRight) mvX = walkSpeed;
    if (mvX !== 0 && mvX * this.dirSign < 0) mvX *= 0.82; // slower backwalk

    const mvZ = 0;

    if (this.isGrounded) {
      const groundAccel = 0.16;
      const groundFriction = 0.76;

      this.vel.x += (mvX - this.vel.x) * groundAccel;
      this.vel.z += (mvZ - this.vel.z) * groundAccel;

      if (mvX === 0) this.vel.x *= groundFriction;
      if (mvZ === 0) this.vel.z *= groundFriction;

      if (Math.abs(this.vel.x) < 0.01) this.vel.x = 0;
      if (Math.abs(this.vel.z) < 0.01) this.vel.z = 0;

      this.state = (Math.abs(this.vel.x) > 0.03 || Math.abs(this.vel.z) > 0.03) ? 'walk' : 'idle';
      
      // Jump trigger: UP jumps like Street Fighter (dedicated jump key still works)
      if (isHoldingUp || InputManager.isActionPressed('jump', this.id)) {
        this.vel.y = 0.78; // Strong jump ascent impulse
        this.isGrounded = false;
        this.state = 'jump';
        
        // Dynamic stretch scale
        this.currentSquashX = 0.82;
        this.currentSquashY = 1.25;
      }
    } else {
      // In-air adjustment physics with reduced air control.
      if (mvX !== 0) {
        this.vel.x += mvX * 0.035;
        this.vel.x = Math.max(-walkSpeed * 1.15, Math.min(walkSpeed * 1.15, this.vel.x));
      }
      this.vel.x *= 0.992;
      this.vel.z *= 0.992;
    }
  }

  private applyKinematicPhysics(): void {
    // Apply gravity in mid-air
    let gravityForce = this.vel.y > 0 ? 0.04 : 0.062;
    if (this.state === 'attack_hurricane') gravityForce *= 0.4; // floaty spin
    if (!this.isGrounded) {
      this.vel.y -= gravityForce;
      this.vel.y = Math.max(this.vel.y, -1.15);
      // Preserve air attacks (jump-ins, shoryuken) and hitstun juggles
      if (!this.isAttacking() && this.hitStunTimer <= 0 && this.state !== 'defeated') {
        this.state = 'jump';
      }
    } else if (this.state !== 'dash' && this.hitStunTimer <= 0 && this.blockStunTimer <= 0) {
      this.vel.x *= 0.985;
      this.vel.z *= 0.985;
    }
    
    // Integrate positions
    this.pos.add(this.vel);
    
    // Arena bounds limits at x = -25 and x = 25
    const boundaryLimit = 24.0;
    if (this.pos.x < -boundaryLimit) {
      this.pos.x = -boundaryLimit;
      if (this.state === 'hitstun' && this.vel.x < -0.1) {
        this.triggerWallBounce(-1);
      }
    } else if (this.pos.x > boundaryLimit) {
      this.pos.x = boundaryLimit;
      if (this.state === 'hitstun' && this.vel.x > 0.1) {
        this.triggerWallBounce(1);
      }
    }

    // Street Fighter style: combat is locked to a single 2D plane
    this.pos.z *= 0.85;
    if (Math.abs(this.pos.z) < 0.01) this.pos.z = 0;
    this.vel.z = 0;

    // Ground check y = 0
    if (this.pos.y < 0) {
      this.pos.y = 0;
      this.vel.y = 0;
      
      // Check landing splash trigger
      if (!this.isGrounded) {
        this.isGrounded = true;
        if (this.hitStunTimer <= 0 && this.state !== 'defeated' && !this.isAttacking()) {
          this.state = 'idle';
        } else if (this.isAttacking() && this.state !== 'attack_shoryuken' && this.state !== 'attack_hurricane') {
          // Landing recovers jump normals immediately
          this.attackTimer = Math.min(this.attackTimer, 4);
        }

        // Squash model upon landing
        this.squashTimer = 8;
        this.currentSquashX = 1.15;
        this.currentSquashY = 0.78;
        
        // Dispatch landing effect event
        const landEvent = new CustomEvent('fighterland', { detail: { pos: this.pos.clone() } });
        window.dispatchEvent(landEvent);
      }
    }
    
    // Move 3D Group matrix
    this.group.position.copy(this.pos);
  }

  private triggerWallBounce(wallDirSign: number): void {
    // Reverse speed on hitting arena fences in high hitstun, pop up
    this.vel.x = -wallDirSign * 0.75;
    this.vel.y = 0.65;
    this.hitStunTimer = 28; // Extended hitstun frame lock
    
    const wallEvent = new CustomEvent('fighterwallbounce', {
      detail: { pos: new THREE.Vector3(wallDirSign * 24.5, this.pos.y + 2, this.pos.z), color: this.opponent.color }
    });
    window.dispatchEvent(wallEvent);
  }

  private animateVisualModel(time: number): void {
    // Face visual components depending on dynamic direction sign.
    this.meshGroup.rotation.y = this.dirSign === 1 ? 0 : Math.PI;

    // Hurricane kick: spin the entire body around its vertical axis
    if (this.state === 'attack_hurricane') {
      this.meshGroup.rotation.y += (36 - this.attackTimer) * 0.62;
    }
    
    // Stance breathing stance twist
    this.breathTime += 0.05;
    const breatheFactor = Math.sin(this.breathTime) * 0.055;
    
    // Lean offset proportional to velocity
    const leanAngle = this.vel.x * this.dirSign * 0.22;
    this.meshGroup.rotation.z = leanAngle;
    
    // Horizontal high frequency tremors during hit
    if (this.hitStunTimer > 0) {
      const tremble = Math.sin(time * 0.25) * this.trembleAmount;
      this.meshGroup.position.x = tremble;
    } else {
      this.meshGroup.position.x = 0;
    }

    // Apply active Squash & Stretch factors
    let activeSquashX = this.currentSquashX;
    let activeSquashY = this.currentSquashY;
    
    // In-air stretch proportional to velocity
    if (!this.isGrounded && this.state === 'jump') {
      const stretch = Math.max(-0.25, Math.min(0.25, this.vel.y * 0.35));
      activeSquashY = 1.0 + stretch;
      activeSquashX = 1.0 - stretch * 0.5;
    }
    
    this.meshGroup.scale.set(activeSquashX, activeSquashY, 1.0);
    
    // Core animation pose mappings
    this.resolveSkeletonPose(breatheFactor);
    this.updateSpriteFrame();
  }

  private resolveSkeletonPose(_breathe: number): void {
    const isVanguard = this.name === 'Vanguard-01';
    
    // Reset all nodes/joints to default values first
    this.torsoNode.position.set(0, 3.6, 0);
    this.torsoNode.rotation.set(0, 0, 0);
    this.headNode.rotation.set(0, 0, 0);
    
    this.lUpperArm.rotation.set(0, 0, 0);
    this.lLowerArm.rotation.set(0, 0, 0);
    this.rUpperArm.rotation.set(0, 0, 0);
    this.rLowerArm.rotation.set(0, 0, 0);
    
    this.lThigh.rotation.set(0, 0, 0);
    this.lShin.rotation.set(0, 0, 0);
    this.rThigh.rotation.set(0, 0, 0);
    this.rShin.rotation.set(0, 0, 0);
    
    this.leftFootNode.rotation.set(0, 0, 0);
    this.rightFootNode.rotation.set(0, 0, 0);
    
    // Base height configuration
    let baseTorsoY = isVanguard ? 3.7 : 3.5;
    
    if (this.state === 'idle') {
      const stanceWave = Math.sin(this.breathTime * 3.5);
      
      // Bob Torso & breathe
      this.torsoNode.position.y = baseTorsoY + stanceWave * 0.08;
      this.torsoNode.rotation.y = this.dirSign * 0.25; // face semi-sideways
      this.headNode.rotation.y = -this.dirSign * 0.22; // keep eyes locked on target
      this.headNode.rotation.x = stanceWave * 0.04;
      
      // Knees bend slightly
      const kneeBendL = 0.35 + stanceWave * 0.03;
      const kneeBendR = 0.28 - stanceWave * 0.03;
      
      const thighSwingL = -0.2;
      const thighSwingR = 0.25;
      
      // Left leg (Rear)
      this.lThigh.rotation.z = thighSwingL;
      this.lShin.rotation.z = -kneeBendL;
      this.leftFootNode.rotation.z = kneeBendL - thighSwingL;
      
      // Right leg (Front)
      this.rThigh.rotation.z = thighSwingR;
      this.rShin.rotation.z = -kneeBendR;
      this.rightFootNode.rotation.z = kneeBendR - thighSwingR;
      
      // Guarding arms
      this.lUpperArm.rotation.set(0.2, 0.4, -0.3);
      this.lLowerArm.rotation.z = 1.3;
      
      this.rUpperArm.rotation.set(-0.2, -0.4, 0.25);
      this.rLowerArm.rotation.z = 1.1;
    } 
    else if (this.state === 'walk') {
      const walkCycle = Math.sin(this.breathTime * 4.0);
      const walkBob = Math.abs(walkCycle) * 0.12;
      
      this.torsoNode.position.y = baseTorsoY - walkBob;
      this.torsoNode.rotation.y = this.dirSign * 0.15;
      this.torsoNode.rotation.z = -this.vel.x * this.dirSign * 0.08; // lean slightly forward
      this.headNode.rotation.y = -this.dirSign * 0.12;
      
      // Legs swing back & forth
      const thighSwingL = -walkCycle * 0.45;
      const thighSwingR = walkCycle * 0.45;
      
      const kneeBendL = walkCycle > 0 ? 0.18 : 0.55; // bend on back swing
      const kneeBendR = walkCycle < 0 ? 0.18 : 0.55;
      
      this.lThigh.rotation.z = thighSwingL;
      this.lShin.rotation.z = -kneeBendL;
      this.leftFootNode.rotation.z = kneeBendL - thighSwingL;
      
      this.rThigh.rotation.z = thighSwingR;
      this.rShin.rotation.z = -kneeBendR;
      this.rightFootNode.rotation.z = kneeBendR - thighSwingR;
      
      // Arms swinging
      this.lUpperArm.rotation.set(0, 0.25, -walkCycle * 0.55);
      this.lLowerArm.rotation.z = 0.75;
      
      this.rUpperArm.rotation.set(0, -0.25, walkCycle * 0.55);
      this.rLowerArm.rotation.z = 0.75;
    } 
    else if (this.state === 'block' || this.state === 'blockstun') {
      const crouchDmg = this.isCrouching ? 0.9 : 0.0;
      this.torsoNode.position.y = baseTorsoY - 0.2 - crouchDmg;
      this.torsoNode.position.z = -this.dirSign * 0.2; // lean back
      this.torsoNode.rotation.z = -this.dirSign * 0.15; // arch back defensive
      
      // Super deep defensive crouch knees bend
      const thighSwingL = this.isCrouching ? -0.7 : -0.35;
      const kneeBendL = this.isCrouching ? 1.4 : 0.8;
      
      const thighSwingR = this.isCrouching ? 0.4 : 0.45;
      const kneeBendR = this.isCrouching ? 1.3 : 0.7;
      
      this.lThigh.rotation.z = thighSwingL;
      this.lShin.rotation.z = -kneeBendL;
      this.leftFootNode.rotation.z = kneeBendL - thighSwingL;
      
      this.rThigh.rotation.z = thighSwingR;
      this.rShin.rotation.z = -kneeBendR;
      this.rightFootNode.rotation.z = kneeBendR - thighSwingR;
      
      // Tight face guard shielding arms
      this.lUpperArm.rotation.set(0.55, 0.5, 0.2);
      this.lLowerArm.rotation.z = 1.8;
      
      this.rUpperArm.rotation.set(0.55, -0.5, 0.35);
      this.rLowerArm.rotation.z = 1.8;
    } 
    else if (this.state === 'attack_light') {
      const progress = this.attackTimer / 12;
      const punchReach = Math.sin(progress * Math.PI);
      
      this.torsoNode.position.y = baseTorsoY - punchReach * 0.12;
      this.torsoNode.position.x = this.dirSign * punchReach * 0.4;
      this.torsoNode.rotation.z = this.dirSign * punchReach * 0.15; // lean in
      
      // Right arm thrust punch!
      this.rUpperArm.rotation.set(-0.15, -0.2, 1.3 * punchReach);
      this.rLowerArm.rotation.z = (1 - punchReach) * 1.0 + 0.15; // extends straight
      
      // Left arm shielding
      this.lUpperArm.rotation.set(0.25, 0.45, -0.2);
      this.lLowerArm.rotation.z = 1.3;
      
      // Legs bracing
      const thighSwingL = -0.3;
      const kneeBendL = 0.55;
      
      const thighSwingR = 0.35;
      const kneeBendR = 0.45;
      
      this.lThigh.rotation.z = thighSwingL;
      this.lShin.rotation.z = -kneeBendL;
      this.leftFootNode.rotation.z = kneeBendL - thighSwingL;
      
      this.rThigh.rotation.z = thighSwingR;
      this.rShin.rotation.z = -kneeBendR;
      this.rightFootNode.rotation.z = kneeBendR - thighSwingR;
    } 
    else if (this.state === 'attack_heavy') {
      const progress = this.attackTimer / 22;
      const swing = Math.sin(progress * Math.PI);
      
      this.torsoNode.position.y = baseTorsoY - swing * 0.15;
      this.torsoNode.rotation.z = this.dirSign * swing * 0.22; // huge lean forward
      
      // Overhead heavy slash!
      this.rUpperArm.rotation.set(-swing * 0.45, -0.25, -0.4 + swing * 2.2);
      this.rLowerArm.rotation.z = 0.25 + (1 - swing) * 0.95;
      
      // Left arm swings back slightly for balancing torque
      this.lUpperArm.rotation.set(0.2, 0.35, -0.45 - swing * 0.4);
      this.lLowerArm.rotation.z = 1.0;
      
      // Legs bracing deep
      const thighSwingL = -0.35;
      const kneeBendL = 0.65;
      
      const thighSwingR = 0.4;
      const kneeBendR = 0.55;
      
      this.lThigh.rotation.z = thighSwingL;
      this.lShin.rotation.z = -kneeBendL;
      this.leftFootNode.rotation.z = kneeBendL - thighSwingL;
      
      this.rThigh.rotation.z = thighSwingR;
      this.rShin.rotation.z = -kneeBendR;
      this.rightFootNode.rotation.z = kneeBendR - thighSwingR;
    } 
    else if (this.state === 'attack_kick') {
      const progress = this.attackTimer / 16;
      const kickSnap = Math.sin(progress * Math.PI);
      
      this.torsoNode.rotation.z = -this.dirSign * kickSnap * 0.32; // lean backwards
      
      // Left leg (standing leg) bends deep to balance weight
      const thighSwingL = -0.25;
      const kneeBendL = 0.85;
      this.lThigh.rotation.z = thighSwingL;
      this.lShin.rotation.z = -kneeBendL;
      this.leftFootNode.rotation.z = kneeBendL - thighSwingL;
      
      // Right leg (Kicking leg) snaps high!
      const thighSwingR = 1.35 * kickSnap;
      const kneeBendR = (1 - kickSnap) * 0.85 + 0.12; // straightens at apex
      this.rThigh.rotation.set(0, 0.25, thighSwingR);
      this.rShin.rotation.z = -kneeBendR;
      this.rightFootNode.rotation.z = kneeBendR - thighSwingR;
      
      // Arms flail slightly for balance
      this.lUpperArm.rotation.set(0.2, 0.4, -0.6 * kickSnap - 0.2);
      this.lLowerArm.rotation.z = 1.0;
      this.rUpperArm.rotation.set(-0.2, -0.4, -0.5 * kickSnap + 0.2);
      this.rLowerArm.rotation.z = 0.9;
    } 
    else if (this.state === 'attack_special' || this.state === 'attack_super') {
      // Hadouken: both palms thrust forward from the hip
      const total = this.state === 'attack_super' ? 30 : 24;
      const progress = 1 - this.attackTimer / total;
      const thrust = Math.min(1, progress * 2.2);

      this.torsoNode.position.y = baseTorsoY - 0.25;
      this.torsoNode.position.x = this.dirSign * thrust * 0.35;
      this.torsoNode.rotation.y = this.dirSign * 0.35;
      this.torsoNode.rotation.z = this.dirSign * thrust * 0.12;

      // Both arms extend forward together
      this.rUpperArm.rotation.set(-0.1, -0.15, 1.25 * thrust);
      this.rLowerArm.rotation.z = (1 - thrust) * 1.1 + 0.12;
      this.lUpperArm.rotation.set(0.1, 0.15, -1.25 * thrust);
      this.lLowerArm.rotation.z = (1 - thrust) * 1.1 + 0.12;

      // Wide braced horse stance
      this.lThigh.rotation.z = -0.5;
      this.lShin.rotation.z = -0.7;
      this.leftFootNode.rotation.z = 0.7 + 0.5;
      this.rThigh.rotation.z = 0.55;
      this.rShin.rotation.z = -0.6;
      this.rightFootNode.rotation.z = 0.6 - 0.55;
    }
    else if (this.state === 'attack_shoryuken') {
      // Rising dragon punch: lead fist punches straight up
      const progress = 1 - this.attackTimer / 34;
      const rise = Math.min(1, progress * 1.8);

      this.torsoNode.position.y = baseTorsoY;
      this.torsoNode.rotation.y = this.dirSign * 0.5;
      this.torsoNode.rotation.z = this.dirSign * 0.18;

      // Right arm rockets skyward, left arm tucks
      this.rUpperArm.rotation.set(0, -0.1, 2.6 * rise + 0.4);
      this.rLowerArm.rotation.z = 0.1;
      this.lUpperArm.rotation.set(0.3, 0.4, -0.5);
      this.lLowerArm.rotation.z = 1.6;

      // Knees tuck up during the rise
      this.lThigh.rotation.z = -0.8 * rise;
      this.lShin.rotation.z = -1.3 * rise;
      this.leftFootNode.rotation.z = 1.3 * rise + 0.8 * rise;
      this.rThigh.rotation.z = 0.9 * rise;
      this.rShin.rotation.z = -1.2 * rise;
      this.rightFootNode.rotation.z = 1.2 * rise - 0.9 * rise;
    }
    else if (this.state === 'attack_hurricane') {
      // Hurricane kick: extended leg while whole body spins (spin applied in animateVisualModel)
      this.torsoNode.rotation.z = -this.dirSign * 0.15;

      // Extended spinning leg
      this.rThigh.rotation.set(0, 0.2, 1.45);
      this.rShin.rotation.z = -0.1;
      this.rightFootNode.rotation.z = 0.1 - 1.45;

      // Standing leg bent
      this.lThigh.rotation.z = -0.3;
      this.lShin.rotation.z = -0.9;
      this.leftFootNode.rotation.z = 0.9 + 0.3;

      // Arms tucked for rotation speed
      this.lUpperArm.rotation.set(0.4, 0.4, -0.4);
      this.lLowerArm.rotation.z = 1.7;
      this.rUpperArm.rotation.set(0.4, -0.4, 0.4);
      this.rLowerArm.rotation.z = 1.7;
    }
    else if (this.state === 'hitstun') {
      this.torsoNode.position.z = -this.dirSign * 0.4;
      this.torsoNode.rotation.z = -this.dirSign * 0.38; // snap back torso in pain
      this.headNode.rotation.z = -this.dirSign * 0.35; // snap back head
      
      // Arms flail outwards in shock
      this.lUpperArm.rotation.set(0.4, 0.45, -0.85);
      this.lLowerArm.rotation.z = 0.35;
      
      this.rUpperArm.rotation.set(0.4, -0.45, -0.85);
      this.rLowerArm.rotation.z = 0.35;
      
      // Legs fold weak
      this.lThigh.rotation.z = -0.15;
      this.lShin.rotation.z = -0.65;
      this.leftFootNode.rotation.z = 0.65 - (-0.15);
      
      this.rThigh.rotation.z = -0.15;
      this.rShin.rotation.z = -0.65;
      this.rightFootNode.rotation.z = 0.65 - (-0.15);
    } 
    else if (this.state === 'defeated') {
      // Collapse flat on canvas floor
      this.meshGroup.position.y = -3.8;
      this.meshGroup.rotation.z = this.dirSign * Math.PI / 2;
    }

    // Animate accessories dynamically based on performance timer
    const time = performance.now();
    this.animateAccessories(time);
  }

  private animateAccessories(time: number): void {
    const isVanguard = this.name === 'Vanguard-01';
    
    if (isVanguard) {
      if (this.scarfSegments.length >= 3) {
        const t = time * 0.01;
        const speedScale = this.state === 'dash' ? 2.5 : (this.state === 'walk' ? 1.8 : 1.0);
        
        // Dynamic wave propagation through chain segments
        const baseAngleZ = -Math.PI / 2 - 0.2; // flow backwards
        
        this.scarfSegments[0].rotation.z = baseAngleZ + Math.sin(t * speedScale) * 0.12;
        this.scarfSegments[0].rotation.y = Math.cos(t * speedScale) * 0.12;
        
        this.scarfSegments[1].rotation.z = 0.2 + Math.sin(t * speedScale - 0.6) * 0.25;
        this.scarfSegments[1].rotation.y = Math.cos(t * speedScale - 0.6) * 0.18;
        
        this.scarfSegments[2].rotation.z = 0.3 + Math.sin(t * speedScale - 1.2) * 0.38;
        this.scarfSegments[2].rotation.y = Math.cos(t * speedScale - 1.2) * 0.32;
      }
    } else {
      // Heavy Titan booster flames scale depending on movement intensity
      const t = time * 0.015;
      let scaleY = 1.0;
      let scaleXZ = 1.0;
      
      if (this.state === 'dash') {
        scaleY = 2.6 + Math.random() * 0.4;
        scaleXZ = 1.3;
      } else if (this.state === 'jump' || !this.isGrounded) {
        scaleY = 1.9 + Math.sin(t * 1.8) * 0.3;
        scaleXZ = 1.15;
      } else if (this.state === 'walk') {
        scaleY = 1.35 + Math.sin(t) * 0.15;
        scaleXZ = 1.05;
      } else if (this.state === 'hitstun') {
        scaleY = 0.05; // sputter out
        scaleXZ = 0.05;
      } else {
        // Idle gentle pulse
        scaleY = 0.75 + Math.sin(t) * 0.08;
        scaleXZ = 0.85 + Math.sin(t) * 0.04;
      }
      
      this.thrusterGlows.forEach(glow => {
        glow.scale.set(scaleXZ, scaleY, scaleXZ);
      });
    }
  }

  // --- PROCEDURAL 3D MESH GENERATION ---
  private buildCharacterMesh(): void {
    const isVanguard = this.name === 'Vanguard-01';
    
    // Materials
    const baseMat = AssetLoader.getMaterial(isVanguard ? 'vanguard' : 'aegis')!;
    const glowMat = AssetLoader.getMaterial(isVanguard ? 'vanguardGlow' : 'aegisGlow')!;
    const bladeMat = AssetLoader.getMaterial('energyBlade')!;
    const fireMat = AssetLoader.getMaterial('fireFist')!;
    const skinMat = AssetLoader.getMaterial(isVanguard ? 'skinWarm' : 'skinDeep')!;
    const hairMat = AssetLoader.getMaterial('hairDark')!;
    const clothMat = AssetLoader.getMaterial(isVanguard ? 'vanguardGi' : 'aegisGi')!;
    const gloveMat = AssetLoader.getMaterial('fightGlove')!;
    const bootMat = AssetLoader.getMaterial('fightBoot')!;
    
    // Core torso node: rounded fighter anatomy instead of a blocky robot hull.
    const torsoGeo = isVanguard 
      ? new THREE.CapsuleGeometry(0.82, 1.6, 8, 18)
      : new THREE.CapsuleGeometry(1.08, 1.75, 8, 18);
    
    const torsoMesh = new THREE.Mesh(torsoGeo, clothMat);
    torsoMesh.castShadow = true;
    torsoMesh.receiveShadow = true;
    this.meshGroup.add(torsoMesh);
    this.torsoNode = torsoMesh;

    const chestGeo = new THREE.SphereGeometry(isVanguard ? 0.86 : 1.12, 18, 12);
    const chest = new THREE.Mesh(chestGeo, clothMat);
    chest.scale.set(1.0, 0.58, 0.55);
    chest.position.set(0, 0.35, 0.12);
    chest.castShadow = true;
    torsoMesh.add(chest);

    const waistGeo = new THREE.CylinderGeometry(isVanguard ? 0.62 : 0.82, isVanguard ? 0.78 : 1.0, 0.45, 18);
    const waist = new THREE.Mesh(waistGeo, clothMat);
    waist.position.y = -1.1;
    waist.castShadow = true;
    torsoMesh.add(waist);

    const beltGeo = new THREE.CylinderGeometry(isVanguard ? 0.66 : 0.87, isVanguard ? 0.66 : 0.87, 0.12, 18);
    const belt = new THREE.Mesh(beltGeo, gloveMat);
    belt.position.y = -0.85;
    torsoMesh.add(belt);
    
    // Glowing Core visors on chest reactors
    const reactorGeo = isVanguard
      ? new THREE.CylinderGeometry(0.4, 0.4, 0.2, 16)
      : new THREE.CylinderGeometry(0.6, 0.6, 0.25, 16);
    
    const reactor = new THREE.Mesh(reactorGeo, glowMat);
    reactor.rotation.x = Math.PI / 2; // face forward
    reactor.position.set(0, 0.45, isVanguard ? 0.55 : 0.72);
    torsoMesh.add(reactor);

    // Head, hair and face details.
    const headGeo = new THREE.SphereGeometry(isVanguard ? 0.75 : 0.95, 16, 16);
    const headMesh = new THREE.Mesh(headGeo, skinMat);
    headMesh.scale.set(0.82, 1.02, 0.88);
    headMesh.position.y = isVanguard ? 2.05 : 2.22;
    headMesh.castShadow = true;
    torsoMesh.add(headMesh);
    this.headNode = headMesh;

    const hairGeo = new THREE.SphereGeometry(isVanguard ? 0.78 : 0.98, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55);
    const hair = new THREE.Mesh(hairGeo, hairMat);
    hair.scale.set(0.9, 0.72, 0.86);
    hair.position.set(0, 0.26, -0.02);
    hair.castShadow = true;
    headMesh.add(hair);

    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 8), skinMat);
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, -0.05, isVanguard ? 0.66 : 0.82);
    headMesh.add(nose);

    const eyeGeo = new THREE.SphereGeometry(isVanguard ? 0.055 : 0.065, 8, 8);
    const eyeL = new THREE.Mesh(eyeGeo, glowMat);
    eyeL.position.set(-0.22, 0.08, isVanguard ? 0.62 : 0.78);
    headMesh.add(eyeL);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.22;
    headMesh.add(eyeR);
    
    // Visor design
    if (isVanguard) {
      // Sleek martial headband with neon trim.
      const visorGeo = new THREE.BoxGeometry(1.05, 0.16, 0.16);
      const visor = new THREE.Mesh(visorGeo, glowMat);
      visor.position.set(0, 0.2, 0.62);
      headMesh.add(visor);
      
      const tieGeo = new THREE.BoxGeometry(0.12, 0.65, 0.05);
      const tieL = new THREE.Mesh(tieGeo, glowMat);
      tieL.position.set(-0.25, 0.08, -0.72);
      tieL.rotation.z = -0.35;
      headMesh.add(tieL);
      const tieR = tieL.clone();
      tieR.position.x = 0.25;
      tieR.rotation.z = 0.35;
      headMesh.add(tieR);
    } else {
      // Heavy fighter brow guard.
      const faceplateGeo = new THREE.BoxGeometry(1.25, 0.18, 0.18);
      const faceplate = new THREE.Mesh(faceplateGeo, gloveMat);
      faceplate.position.set(0, 0.18, 0.78);
      headMesh.add(faceplate);
      
      const slitGeo = new THREE.BoxGeometry(0.95, 0.06, 0.08);
      const slit = new THREE.Mesh(slitGeo, glowMat);
      slit.position.set(0, 0.0, 0.08);
      faceplate.add(slit);
    }

    // Cylindrical Limbs: Left/Right arms
    const shoulderOffset = isVanguard ? 1.0 : 1.28;
    const handRadius = isVanguard ? 0.32 : 0.46;
    
    // ---- LEFT ARM ----
    const lUpperArm = new THREE.Group();
    lUpperArm.position.set(-shoulderOffset, 0.8, 0);
    torsoMesh.add(lUpperArm);
    this.lUpperArm = lUpperArm;

    // Upper arm mesh
    const upperArmGeo = new THREE.CapsuleGeometry(isVanguard ? 0.22 : 0.32, 0.75, 6, 12);
    const lUpperArmMesh = new THREE.Mesh(upperArmGeo, skinMat);
    lUpperArmMesh.position.y = -0.6;
    lUpperArmMesh.castShadow = true;
    lUpperArm.add(lUpperArmMesh);

    // Pauldron shoulder guard
    const pauldronGeo = isVanguard
      ? new THREE.BoxGeometry(0.5, 0.28, 0.75)
      : new THREE.BoxGeometry(0.72, 0.36, 0.95);
    const lPauldron = new THREE.Mesh(pauldronGeo, clothMat);
    lPauldron.position.set(isVanguard ? -0.12 : -0.18, 0.14, 0);
    if (!isVanguard) {
      const trimGeo = new THREE.BoxGeometry(0.74, 0.06, 0.97);
      const trim = new THREE.Mesh(trimGeo, glowMat);
      trim.position.y = 0.38;
      lPauldron.add(trim);
    } else {
      const trimGeo = new THREE.BoxGeometry(0.52, 0.05, 0.77);
      const trim = new THREE.Mesh(trimGeo, glowMat);
      trim.position.y = 0.18;
      lPauldron.add(trim);
    }
    lUpperArm.add(lPauldron);

    // Left Lower Arm (Elbow joint)
    const lLowerArm = new THREE.Group();
    lLowerArm.position.set(0, -1.2, 0);
    lUpperArm.add(lLowerArm);
    this.lLowerArm = lLowerArm;

    const lowerArmGeo = new THREE.CapsuleGeometry(isVanguard ? 0.2 : 0.3, 0.72, 6, 12);
    const lLowerArmMesh = new THREE.Mesh(lowerArmGeo, skinMat);
    lLowerArmMesh.position.y = -0.6;
    lLowerArmMesh.castShadow = true;
    lLowerArm.add(lLowerArmMesh);

    if (!isVanguard) {
      const jointGeo = new THREE.SphereGeometry(0.4, 10, 10);
      const joint = new THREE.Mesh(jointGeo, glowMat);
      lLowerArm.add(joint);
      
      const forearmShieldGeo = new THREE.BoxGeometry(0.48, 0.65, 0.5);
      const forearmShield = new THREE.Mesh(forearmShieldGeo, gloveMat);
      forearmShield.position.y = -0.6;
      lLowerArm.add(forearmShield);
    }

    // Left Hand cuff/fist
    const cuffGeo = new THREE.SphereGeometry(handRadius, 12, 12);
    const lHandMesh = new THREE.Mesh(cuffGeo, isVanguard ? gloveMat : fireMat);
    lHandMesh.position.set(0, -1.2, 0);
    lHandMesh.castShadow = true;
    lLowerArm.add(lHandMesh);
    this.leftHandNode = lHandMesh;

    // ---- RIGHT ARM ----
    const rUpperArm = new THREE.Group();
    rUpperArm.position.set(shoulderOffset, 0.8, 0);
    torsoMesh.add(rUpperArm);
    this.rUpperArm = rUpperArm;

    const rUpperArmMesh = new THREE.Mesh(upperArmGeo, skinMat);
    rUpperArmMesh.position.y = -0.6;
    rUpperArmMesh.castShadow = true;
    rUpperArm.add(rUpperArmMesh);

    const rPauldron = lPauldron.clone();
    rPauldron.position.x = isVanguard ? 0.15 : 0.3;
    rUpperArm.add(rPauldron);

    const rLowerArm = new THREE.Group();
    rLowerArm.position.set(0, -1.2, 0);
    rUpperArm.add(rLowerArm);
    this.rLowerArm = rLowerArm;

    const rLowerArmMesh = new THREE.Mesh(lowerArmGeo, skinMat);
    rLowerArmMesh.position.y = -0.6;
    rLowerArmMesh.castShadow = true;
    rLowerArm.add(rLowerArmMesh);

    if (!isVanguard) {
      const joint = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 10), glowMat);
      rLowerArm.add(joint);
      
      const forearmShield = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.65, 0.5), gloveMat);
      forearmShield.position.y = -0.6;
      rLowerArm.add(forearmShield);
    }

    const rHandMesh = new THREE.Mesh(cuffGeo, isVanguard ? gloveMat : fireMat);
    rHandMesh.position.set(0, -1.2, 0);
    rHandMesh.castShadow = true;
    rLowerArm.add(rHandMesh);
    this.rightHandNode = rHandMesh;

    // Vanguard Twin Katana meshes!
    if (isVanguard) {
      const handleGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.75, 8);
      const handleMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
      
      // Left Katana
      const lHandle = new THREE.Mesh(handleGeo, handleMat);
      lHandle.position.set(0, -0.25, 0);
      lHandle.rotation.x = -Math.PI / 2; // point forward
      lHandMesh.add(lHandle);
      
      const lBladeGeo = new THREE.BoxGeometry(0.03, 2.4, 0.2);
      const lBlade = new THREE.Mesh(lBladeGeo, bladeMat);
      lBlade.position.set(0, -1.3, 0.05);
      lBlade.castShadow = true;
      lHandle.add(lBlade);
      
      // Right Katana
      const rHandle = new THREE.Mesh(handleGeo, handleMat);
      rHandle.position.set(0, -0.25, 0);
      rHandle.rotation.x = -Math.PI / 2;
      rHandMesh.add(rHandle);
      
      const rBlade = new THREE.Mesh(lBladeGeo, bladeMat);
      rBlade.position.set(0, -1.3, 0.05);
      rBlade.castShadow = true;
      rHandle.add(rBlade);
    } else {
      const spikeGeo = new THREE.ConeGeometry(0.12, 0.4, 6);
      for (let i = 0; i < 3; i++) {
        const spikeL = new THREE.Mesh(spikeGeo, baseMat);
        spikeL.position.set((i - 1) * 0.3, 0, 0.4);
        spikeL.rotation.x = Math.PI / 2;
        lHandMesh.add(spikeL);

        const spikeR = spikeL.clone();
        rHandMesh.add(spikeR);
      }
    }

    // ---- LEGS ASSEMBLY ----
    const thighLength = 1.05;
    const shinLength = 1.08;
    const legRadius = isVanguard ? 0.28 : 0.38;

    // LEFT LEG
    const lThigh = new THREE.Group();
    lThigh.position.set(isVanguard ? -0.46 : -0.58, -1.35, 0);
    torsoMesh.add(lThigh);
    this.lThigh = lThigh;

    const thighGeo = new THREE.CapsuleGeometry(legRadius, thighLength * 0.62, 6, 12);
    const lThighMesh = new THREE.Mesh(thighGeo, clothMat);
    lThighMesh.position.y = -thighLength / 2;
    lThighMesh.castShadow = true;
    lThigh.add(lThighMesh);

    const kneeGeo = new THREE.SphereGeometry(legRadius * 0.85, 10, 10);
    const lKnee = new THREE.Mesh(kneeGeo, gloveMat);
    lKnee.position.set(0, -thighLength, 0);
    lThigh.add(lKnee);

    // Left Shin
    const lShin = new THREE.Group();
    lShin.position.set(0, -thighLength, 0);
    lThigh.add(lShin);
    this.lShin = lShin;

    const shinGeo = new THREE.CapsuleGeometry(legRadius * 0.88, shinLength * 0.64, 6, 12);
    const lShinMesh = new THREE.Mesh(shinGeo, bootMat);
    lShinMesh.position.y = -shinLength / 2;
    lShinMesh.castShadow = true;
    lShin.add(lShinMesh);

    if (isVanguard) {
      const guardGeo = new THREE.BoxGeometry(0.08, 0.55, 0.6);
      const guard = new THREE.Mesh(guardGeo, glowMat);
      guard.position.set(0, -0.3, 0.28);
      lShin.add(guard);
    } else {
      const strutGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.8, 6);
      const strut = new THREE.Mesh(strutGeo, glowMat);
      strut.position.set(0.35, -0.5, 0.22);
      lShin.add(strut);
    }

    // Left Foot
    const footWidth = isVanguard ? 0.58 : 0.82;
    const footHeight = isVanguard ? 0.3 : 0.38;
    const footLength = isVanguard ? 1.15 : 1.38;
    const footGeo = new THREE.BoxGeometry(footWidth, footHeight, footLength);
    const lFootMesh = new THREE.Mesh(footGeo, bootMat);
    lFootMesh.position.set(0, -footHeight / 2, footLength * 0.22);
    lFootMesh.castShadow = true;
    lShin.add(lFootMesh);
    this.leftFootNode = lFootMesh;

    const soleGlowGeo = new THREE.BoxGeometry(footWidth * 1.02, 0.05, footLength * 1.02);
    const soleGlow = new THREE.Mesh(soleGlowGeo, glowMat);
    soleGlow.position.y = -footHeight / 2 - 0.01;
    lFootMesh.add(soleGlow);

    // RIGHT LEG
    const rThigh = new THREE.Group();
    rThigh.position.set(isVanguard ? 0.46 : 0.58, -1.35, 0);
    torsoMesh.add(rThigh);
    this.rThigh = rThigh;

    const rThighMesh = new THREE.Mesh(thighGeo, clothMat);
    rThighMesh.position.y = -thighLength / 2;
    rThighMesh.castShadow = true;
    rThigh.add(rThighMesh);

    const rKnee = lKnee.clone();
    rThigh.add(rKnee);

    // Right Shin
    const rShin = new THREE.Group();
    rShin.position.set(0, -thighLength, 0);
    rThigh.add(rShin);
    this.rShin = rShin;

    const rShinMesh = new THREE.Mesh(shinGeo, bootMat);
    rShinMesh.position.y = -shinLength / 2;
    rShinMesh.castShadow = true;
    rShin.add(rShinMesh);

    const shinTrim = lShin.children[1];
    if (shinTrim) {
      rShin.add(shinTrim.clone());
    }

    // Right Foot
    const rFootMesh = new THREE.Mesh(footGeo, bootMat);
    rFootMesh.position.set(0, -footHeight / 2, footLength * 0.22);
    rFootMesh.castShadow = true;
    rShin.add(rFootMesh);
    this.rightFootNode = rFootMesh;

    const rSoleGlow = soleGlow.clone();
    rFootMesh.add(rSoleGlow);

    // ---- FUTURISTIC BACK DECORATIONS ----
    if (isVanguard) {
      // 1. Digital flowing ribbon scarf (attached to back of neck)
      const scarfSegmentGeo = new THREE.BoxGeometry(0.3, 0.5, 0.05);
      
      const scarf1 = new THREE.Group();
      scarf1.position.set(0, 1.3, -0.65); // back of neck
      torsoMesh.add(scarf1);
      
      const m1 = new THREE.Mesh(scarfSegmentGeo, glowMat);
      m1.position.y = -0.22;
      scarf1.add(m1);
      
      const scarf2 = new THREE.Group();
      scarf2.position.set(0, -0.45, 0);
      scarf1.add(scarf2);
      
      const m2 = new THREE.Mesh(scarfSegmentGeo, glowMat);
      m2.position.y = -0.22;
      scarf2.add(m2);

      const scarf3 = new THREE.Group();
      scarf3.position.set(0, -0.45, 0);
      scarf2.add(scarf3);
      
      const m3 = new THREE.Mesh(scarfSegmentGeo, glowMat);
      m3.position.y = -0.22;
      scarf3.add(m3);

      this.scarfSegments = [scarf1, scarf2, scarf3];

      // 2. Crossed twin sword scabbards on the back
      const scabbardGeo = new THREE.BoxGeometry(0.1, 1.8, 0.2);
      const scabbardL = new THREE.Mesh(scabbardGeo, baseMat);
      scabbardL.position.set(-0.3, 0.2, -0.75);
      scabbardL.rotation.set(0.1, 0.2, Math.PI / 4);
      scabbardL.castShadow = true;
      torsoMesh.add(scabbardL);

      const scabbardR = scabbardL.clone();
      scabbardR.position.x = 0.3;
      scabbardR.rotation.z = -Math.PI / 4;
      torsoMesh.add(scabbardR);
    } else {
      // 1. Heavy boiler fusion core thrusters on back
      const thrusterGeo = new THREE.CylinderGeometry(0.28, 0.22, 1.0, 8);
      
      // Left Thruster
      const thrusterL = new THREE.Group();
      thrusterL.position.set(-0.8, 0.7, -1.1);
      thrusterL.rotation.x = -Math.PI / 6; // angle down and back
      torsoMesh.add(thrusterL);

      const thrusterLMesh = new THREE.Mesh(thrusterGeo, baseMat);
      thrusterLMesh.position.y = -0.5;
      thrusterLMesh.castShadow = true;
      thrusterL.add(thrusterLMesh);

      const glowConeGeo = new THREE.ConeGeometry(0.18, 0.55, 8);
      const glowL = new THREE.Mesh(glowConeGeo, fireMat);
      glowL.position.set(0, -1.1, 0);
      glowL.rotation.x = Math.PI; // point down
      thrusterL.add(glowL);
      this.thrusterGlows.push(glowL);

      // Right Thruster
      const thrusterR = new THREE.Group();
      thrusterR.position.set(0.8, 0.7, -1.1);
      thrusterR.rotation.x = -Math.PI / 6;
      torsoMesh.add(thrusterR);

      const thrusterRMesh = new THREE.Mesh(thrusterGeo, baseMat);
      thrusterRMesh.position.y = -0.5;
      thrusterRMesh.castShadow = true;
      thrusterR.add(thrusterRMesh);

      const glowR = new THREE.Mesh(glowConeGeo, fireMat);
      glowR.position.set(0, -1.1, 0);
      glowR.rotation.x = Math.PI;
      thrusterR.add(glowR);
      this.thrusterGlows.push(glowR);
    }

    this.installSpriteFighter(isVanguard);
  }

  private installSpriteFighter(isVanguard: boolean): void {
    this.meshGroup.children.forEach(child => {
      child.visible = true;
    });

    const states: Array<FighterState | 'default'> = [
      'default',
      'idle',
      'walk',
      'jump',
      'block',
      'dash',
      'hitstun',
      'blockstun',
      'attack_light',
      'attack_heavy',
      'attack_kick',
      'defeated'
    ];

    states.forEach(state => {
      const texture = this.createSpriteTexture(isVanguard, state);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.NearestFilter;
      texture.generateMipmaps = false;
      this.spriteTextures[state] = texture;
    });

    const material = new THREE.MeshBasicMaterial({
      map: this.spriteTextures.idle || this.spriteTextures.default,
      transparent: true,
      alphaTest: 0.02,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    this.spriteMesh = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 6.4), material);
    this.spriteMesh.position.set(0, 3.05, 0.45);
    this.spriteMesh.visible = false;
    this.spriteMesh.renderOrder = 20 + this.id;
    this.meshGroup.add(this.spriteMesh);
    this.currentSpriteKey = 'idle';
  }

  private updateSpriteFrame(): void {
    if (!this.spriteMesh) return;

    const spriteKey: FighterState | 'default' = this.spriteTextures[this.state] ? this.state : 'default';
    if (spriteKey === this.currentSpriteKey) return;

    const material = this.spriteMesh.material;
    material.map = this.spriteTextures[spriteKey] || this.spriteTextures.default || null;
    material.needsUpdate = true;
    this.currentSpriteKey = spriteKey;
  }

  private createSpriteTexture(isVanguard: boolean, state: FighterState | 'default'): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 96;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;

    const skin = isVanguard ? '#d89a72' : '#8e563d';
    const shade = isVanguard ? '#9e6548' : '#5c3025';
    const cloth = isVanguard ? '#1b75d0' : '#ba1f35';
    const clothDark = isVanguard ? '#0c2f62' : '#64111d';
    const clothLight = isVanguard ? '#58a8ff' : '#ef5064';
    const trim = isVanguard ? '#38f7ff' : '#ffca3a';
    const glove = '#141419';
    const hair = '#101014';
    const boot = '#111115';
    const outline = '#050509';

    const pose = this.getSpritePose(state);

    const rect = (x: number, y: number, w: number, h: number, color: string): void => {
      ctx.fillStyle = color;
      ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    };

    const poly = (points: Array<[number, number]>, color: string, stroke: string = outline): void => {
      ctx.beginPath();
      ctx.moveTo(points[0][0], points[0][1]);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i][0], points[i][1]);
      }
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = stroke;
      ctx.stroke();
    };

    const oval = (x: number, y: number, rx: number, ry: number, color: string, stroke: string = outline): void => {
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = stroke;
      ctx.stroke();
    };

    const limb = (x1: number, y1: number, x2: number, y2: number, width: number, color: string): void => {
      ctx.save();
      ctx.strokeStyle = outline;
      ctx.lineWidth = width + 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.restore();
    };

    const bodyX = 48 + pose.bodyX;
    const bodyY = 50 + pose.bodyY;
    const headX = bodyX + pose.headX;
    const headY = bodyY - 26 + pose.headY;

    if (state === 'defeated') {
      oval(48, 94, 28, 8, 'rgba(0,0,0,0.35)', 'rgba(0,0,0,0)');
      poly([[24, 82], [61, 80], [70, 91], [30, 95]], cloth);
      poly([[55, 77], [72, 77], [75, 90], [58, 91]], skin);
      poly([[64, 73], [78, 76], [75, 82], [59, 80]], hair);
      limb(28, 91, 12, 101, 8, boot);
      limb(42, 91, 66, 104, 8, boot);
      limb(32, 84, 17, 73, 7, skin);
      limb(53, 83, 78, 73, 7, skin);
      rect(29, 77, 24, 4, trim);
      return new THREE.CanvasTexture(canvas);
    }

    const leftHipX = bodyX - 11;
    const rightHipX = bodyX + 11;
    const hipY = bodyY + 24;
    const leftShoulderX = bodyX - 16;
    const rightShoulderX = bodyX + 16;
    const shoulderY = bodyY - 5;

    oval(48, 115, 28, 6, 'rgba(0,0,0,0.28)', 'rgba(0,0,0,0)');

    limb(leftHipX, hipY, bodyX - 18 + pose.legBackX, 86 + pose.legBackY, 11, clothDark);
    limb(bodyX - 18 + pose.legBackX, 86 + pose.legBackY, bodyX - 21 + pose.legBackX, 108, 10, boot);
    limb(rightHipX, hipY, bodyX + 17 + pose.legFrontX, 86 + pose.legFrontY, 12, cloth);
    limb(bodyX + 17 + pose.legFrontX, 86 + pose.legFrontY, bodyX + 24 + pose.legFrontX, 108, 10, boot);
    rect(bodyX - 28 + pose.legBackX, 107, 17, 7, boot);
    rect(bodyX + 14 + pose.legFrontX, 107, 22, 7, boot);

    poly([
      [bodyX - 21, bodyY - 7],
      [bodyX + 21, bodyY - 7],
      [bodyX + 16, bodyY + 24],
      [bodyX + 8, bodyY + 33],
      [bodyX - 8, bodyY + 33],
      [bodyX - 16, bodyY + 24]
    ], cloth);
    poly([
      [bodyX - 8, bodyY - 4],
      [bodyX + 9, bodyY - 4],
      [bodyX + 5, bodyY + 27],
      [bodyX - 4, bodyY + 28]
    ], clothDark, clothDark);
    rect(bodyX - 19, bodyY + 22, 38, 5, trim);
    rect(bodyX - 2, bodyY - 3, 4, 30, clothLight);
    oval(bodyX - 12, bodyY + 5, 7, 10, clothLight, cloth);
    oval(bodyX + 12, bodyY + 5, 7, 10, clothLight, cloth);

    oval(leftShoulderX, shoulderY, 8, 9, skin);
    limb(leftShoulderX, shoulderY, leftShoulderX - 11 + pose.armBackX, bodyY + 18 + pose.armBackY, 10, skin);
    limb(leftShoulderX - 11 + pose.armBackX, bodyY + 18 + pose.armBackY, leftShoulderX - 8 + pose.armBackX, bodyY + 39 + pose.armBackY, 9, glove);
    oval(leftShoulderX - 8 + pose.armBackX, bodyY + 41 + pose.armBackY, 7, 6, glove);

    oval(rightShoulderX, shoulderY, 8, 9, skin);
    limb(rightShoulderX, shoulderY, rightShoulderX + 12 + pose.armFrontX, bodyY + 17 + pose.armFrontY, 10, skin);
    limb(rightShoulderX + 12 + pose.armFrontX, bodyY + 17 + pose.armFrontY, rightShoulderX + 17 + pose.armFrontX, bodyY + 38 + pose.armFrontY, 9, glove);
    oval(rightShoulderX + 17 + pose.armFrontX, bodyY + 40 + pose.armFrontY, 8, 6, glove);

    oval(headX, headY + 1, 13, 16, skin);
    poly([[headX - 13, headY - 11], [headX + 10, headY - 14], [headX + 14, headY - 4], [headX + 7, headY - 7], [headX - 11, headY - 5]], hair);
    rect(headX - 15, headY - 5, 30, 4, trim);
    rect(headX - 8, headY + 1, 5, 3, '#ffffff');
    rect(headX + 4, headY + 1, 5, 3, '#ffffff');
    rect(headX - 6, headY + 10, 12, 2, shade);

    if (isVanguard) {
      rect(headX + 12, headY - 2, 15, 3, trim);
      rect(headX + 16, headY + 3, 11, 3, trim);
      poly([[bodyX - 22, bodyY + 31], [bodyX - 36, bodyY + 55], [bodyX - 29, bodyY + 56], [bodyX - 15, bodyY + 32]], trim, trim);
    } else {
      oval(bodyX - 23, bodyY - 1, 8, 7, trim);
      oval(bodyX + 23, bodyY - 1, 8, 7, trim);
      rect(bodyX - 20, bodyY + 31, 40, 5, clothDark);
    }

    if (state === 'attack_heavy') {
      limb(bodyX + 18, bodyY - 9, bodyX + 52, bodyY - 24, 5, trim);
      rect(bodyX + 50, bodyY - 28, 10, 8, '#ffffff');
    } else if (state === 'attack_light') {
      oval(bodyX + 54, bodyY + 11, 10, 8, trim);
      rect(bodyX + 41, bodyY + 8, 18, 6, '#ffffff');
    } else if (state === 'attack_kick') {
      limb(bodyX + 24, 84, bodyX + 61, 78, 9, boot);
      rect(bodyX + 57, 74, 17, 8, trim);
    } else if (state === 'block' || state === 'blockstun') {
      poly([[bodyX + 19, bodyY - 1], [bodyX + 34, bodyY + 4], [bodyX + 31, bodyY + 36], [bodyX + 17, bodyY + 31]], trim);
    } else if (state === 'hitstun') {
      poly([[bodyX - 29, bodyY + 0], [bodyX - 20, bodyY + 5], [bodyX - 29, bodyY + 10]], '#ffffff', '#ffffff');
      poly([[bodyX + 24, bodyY - 11], [bodyX + 32, bodyY - 6], [bodyX + 23, bodyY - 2]], '#ffffff', '#ffffff');
    }

    return new THREE.CanvasTexture(canvas);
  }

  private getSpritePose(state: FighterState | 'default'): {
    bodyX: number;
    bodyY: number;
    headX: number;
    headY: number;
    armFrontX: number;
    armFrontY: number;
    armBackX: number;
    armBackY: number;
    legFrontX: number;
    legFrontY: number;
    legBackX: number;
    legBackY: number;
  } {
    const pose = {
      bodyX: 0,
      bodyY: 0,
      headX: 0,
      headY: 0,
      armFrontX: 0,
      armFrontY: 0,
      armBackX: 0,
      armBackY: 0,
      legFrontX: 0,
      legFrontY: 0,
      legBackX: 0,
      legBackY: 0
    };

    if (state === 'walk' || state === 'dash') {
      pose.bodyY = state === 'dash' ? 1 : 2;
      pose.armFrontX = 7;
      pose.armFrontY = -4;
      pose.armBackX = -5;
      pose.armBackY = 2;
      pose.legFrontX = 7;
      pose.legBackX = -7;
    } else if (state === 'jump') {
      pose.bodyY = -12;
      pose.headY = -2;
      pose.armFrontX = 3;
      pose.armFrontY = -12;
      pose.armBackX = -3;
      pose.armBackY = -10;
      pose.legFrontX = 2;
      pose.legFrontY = -12;
      pose.legBackX = -8;
      pose.legBackY = -9;
    } else if (state === 'block' || state === 'blockstun') {
      pose.bodyY = 6;
      pose.headY = 4;
      pose.armFrontX = -9;
      pose.armFrontY = -16;
      pose.armBackX = 5;
      pose.armBackY = -13;
      pose.legFrontX = 2;
      pose.legBackX = -5;
    } else if (state === 'attack_light') {
      pose.bodyX = 4;
      pose.armFrontX = 23;
      pose.armFrontY = -13;
      pose.armBackX = -7;
      pose.armBackY = -5;
      pose.legFrontX = 4;
      pose.legBackX = -5;
    } else if (state === 'attack_heavy') {
      pose.bodyX = 5;
      pose.headY = 2;
      pose.armFrontX = 22;
      pose.armFrontY = -31;
      pose.armBackX = -12;
      pose.armBackY = 0;
      pose.legFrontX = 8;
      pose.legBackX = -6;
    } else if (state === 'attack_kick') {
      pose.bodyX = -2;
      pose.bodyY = 1;
      pose.armFrontX = -4;
      pose.armFrontY = -12;
      pose.armBackX = -9;
      pose.armBackY = -7;
      pose.legFrontX = 24;
      pose.legFrontY = -20;
      pose.legBackX = -5;
    } else if (state === 'hitstun') {
      pose.bodyX = -7;
      pose.headX = -5;
      pose.headY = 4;
      pose.armFrontX = -9;
      pose.armFrontY = -9;
      pose.armBackX = -13;
      pose.armBackY = -6;
      pose.legFrontX = -2;
      pose.legBackX = -6;
    }

    return pose;
  }

  // --- COMBAT STAT MODIFIERS ---
  public takeDamage(amount: number, knockback: number, hitAngleDir: number): boolean {
    // Street Fighter guard rules: hold BACK (away from the attacker) to block,
    // or hold DOWN(-back) for a crouch block. The dedicated block button still works.
    const holdBackAction = hitAngleDir > 0 ? 'right' : 'left';
    const isHoldingBack = InputManager.isActionPressed(holdBackAction, this.id);
    const canGuard = this.isGrounded && !this.isAttacking() && this.hitStunTimer <= 0 && this.state !== 'defeated';
    const isBlocking = canGuard && (this.state === 'block' || this.state === 'blockstun' || isHoldingBack);

    if (isBlocking) {
      const guardDmg = Math.max(1, Math.floor(amount * 0.15)); // Guard blocks 85% damage
      this.health = Math.max(0, this.health - guardDmg);
      
      // Slight block pushback
      this.vel.x = hitAngleDir * (knockback * 0.25);
      this.state = 'blockstun';
      this.blockStunTimer = 10;
      this.gainEnergy(2); // small meter reward for a successful guard
      
      // Dispatch block effects
      const blockEvent = new CustomEvent('combatblock', { 
        detail: { pos: this.pos.clone().add(new THREE.Vector3(this.dirSign * 0.8, 3.6, 0.5)), color: this.color } 
      });
      window.dispatchEvent(blockEvent);
      
      return false; // Not a true clean hit
    }

    // Clean hit! Deduct health
    this.health = Math.max(0, this.health - amount);
    this.isCrouching = false;
    
    // Hit Stun lock and knockback speed
    this.vel.x = hitAngleDir * knockback;
    this.vel.y = 0.22; // POP UP slightly on hits
    this.isGrounded = false; // let gravity settle the pop-up
    this.pendingProjectile = null; // getting hit cancels a starting fireball

    this.state = 'hitstun';
    this.hitStunTimer = amount >= 15 ? 24 : 15; // heavy vs light hitstun frames
    this.trembleAmount = amount >= 15 ? 0.35 : 0.18; // screen-shaking tremor severity
    
    // Accumulate EX dynamic energy on hitting
    this.opponent.gainEnergy(amount * 0.6);
    this.gainEnergy(amount * 0.35);

    // Dispatch hit spark particles event
    const hitEvent = new CustomEvent('combathit', {
      detail: { 
        pos: this.pos.clone().add(new THREE.Vector3(this.dirSign * 0.5, 3.8, 0.5)), 
        color: this.opponent.color, 
        damage: amount 
      }
    });
    window.dispatchEvent(hitEvent);
    
    if (this.health <= 0) {
      this.state = 'defeated';
    }
    
    return true; // True clean hit registered
  }

  public gainEnergy(val: number): void {
    this.energy = Math.min(this.maxEnergy, this.energy + val);
  }
}
