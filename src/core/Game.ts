import * as THREE from 'three';
import { GameState, State } from './GameState';
import { AssetLoader } from './AssetLoader';
import { Fighter } from '../entities/Fighter';
import { Arena } from '../entities/Arena';
import { CombatSystem } from '../combat/CombatSystem';
import { InputManager } from '../input/InputManager';
import { GamepadManager } from '../input/GamepadManager';
import { CameraController } from '../render/CameraController';
import { Effects } from '../render/Effects';
import { HUD } from '../ui/HUD';
import { Menu } from '../ui/Menu';
import { audio } from '../audio/AudioManager';
import { FighterAI } from '../ai/FighterAI';

export class Game {
  public state: GameState;
  private container: HTMLElement;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  
  // Entities
  private arena!: Arena;
  private p1!: Fighter;
  private p2!: Fighter;
  private ai: FighterAI | null = null;
  
  // Sub-systems
  private cameraController!: CameraController;
  private combatSystem!: CombatSystem;
  private hud!: HUD;
  private menu!: Menu;
  
  // Loops & Time
  private animationFrameId: number | null = null;
  private countdownIntervalId: any = null;

  constructor(containerId: string) {
    this.container = document.getElementById(containerId)!;
    this.state = new GameState();
    
    this.initThreeJS();
    this.initSubSystems();
    this.registerGlobalEvents();

    // Debug/testing handle
    (window as any).__NEOFIGHT__ = this;
    
    // Bind Escape key to pause
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') {
        this.togglePause();
      }
    });
  }

  private initThreeJS(): void {
    // 1. Create Scene
    this.scene = new THREE.Scene();
    
    // 2. Perspective camera for a 3D arena fighting presentation.
    this.camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    
    // 3. WebGLRenderer with shadows
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    // Clear old canvases and append
    this.container.innerHTML = '';
    this.container.appendChild(this.renderer.domElement);
    
    // Resize listeners
    window.addEventListener('resize', () => this.onResize());
  }

  private initSubSystems(): void {
    // Initialize Input Managers
    InputManager.init();
    GamepadManager.init();
    
    // Initialize Visual Particle Pool
    Effects.init(this.scene);
    
    // Create systems
    this.cameraController = new CameraController(this.camera);
    this.combatSystem = new CombatSystem(this.scene);
    this.hud = new HUD(this.state);
    this.menu = new Menu(this.state);
    
    // Wire rematch and state transitions
    this.menu.setOnRematch(() => this.rematch());
    
    // Listen for custom state change from Menu or other places
    window.addEventListener('gamestatechange', (e: any) => {
      this.onStateChange(e.detail.state);
    });
  }

  private registerGlobalEvents(): void {
    // Listen to Hit/Block events to spawn particles & visual shake effects
    window.addEventListener('combathit', (e: any) => {
      const { pos, color, damage } = e.detail;
      Effects.spawnHitSparks(pos, color);
      
      // Flash the CRT Bezel screen overlay for massive hits
      if (damage >= 20) {
        this.triggerFullscreenHitFlash();
      }
    });

    window.addEventListener('combatblock', (e: any) => {
      const { pos, color } = e.detail;
      Effects.spawnBlockSparks(pos, color);
    });

    window.addEventListener('fighterland', (e: any) => {
      const { pos } = e.detail;
      Effects.spawnLandingDust(pos);
    });

    window.addEventListener('fighterwallbounce', (e: any) => {
      const { pos, color } = e.detail;
      Effects.spawnWallBounceSparks(pos, color);
    });

    // Screen shake trigger
    window.addEventListener('camerashake', (e: any) => {
      if (this.state.settings.screenShake) {
        const { amount, duration } = e.detail;
        this.cameraController.triggerScreenShake(amount, duration);
        this.cameraController.triggerImpactZoom(amount);
      }
    });
  }

  private triggerFullscreenHitFlash(): void {
    const flashEl = document.getElementById('hit-flash');
    if (flashEl) {
      flashEl.style.opacity = '0.35';
      setTimeout(() => {
        flashEl.style.opacity = '0';
      }, 80);
    }
  }

  public async start(): Promise<void> {
    // Boot progress
    this.menu.updateLoadingProgress(0.1, 'COMPILING PROCEDURAL SHADERS...');
    
    // Load asset generators
    await AssetLoader.loadAll((progress) => {
      this.menu.updateLoadingProgress(
        0.1 + progress * 0.9,
        progress < 1.0 
          ? `3D FIGHTER ASSETS: ${Math.floor(progress * 100)}%` 
          : 'BOOTING ENGINE CHANNELS...'
      );
    });
    
    // Build Arena mesh structures
    this.arena = new Arena(this.scene);
    
    // Transition to main menu
    this.state.changeState(State.MENU);
    
    // Start requestAnimationFrame render tick
    this.tick();
  }

  private onResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  private onStateChange(newState: State): void {
    if (newState === State.FIGHT) {
      // Build characters based on active selections
      this.buildFighters();
      
      // Start music loops
      audio.startBGM();
      
      // Reset variables & initialize round intro
      this.state.resetMatch();
      this.startRound();
    } else if (newState === State.MENU) {
      this.hud.showHUD(false);
      this.cleanupFighters();
    } else if (newState === State.PAUSE) {
      this.stopCountdown();
    }
  }

  private buildFighters(): void {
    // Clean old fighters meshes
    this.cleanupFighters();
    
    const p1Char = this.state.p1SelectedChar;
    const p2Char = this.state.p2SelectedChar;
    
    // P1 Fighter Instantiation
    const p1Name = p1Char === 'vanguard' ? 'Vanguard-01' : 'Aegis-X';
    const p1Color = p1Char === 'vanguard' ? '#00f3ff' : '#ff0055';
    this.p1 = new Fighter(1, p1Name, p1Color, -8.0, this.scene);
    
    // P2 Fighter Instantiation
    const p2Name = p2Char === 'vanguard' ? 'Vanguard-01' : 'Aegis-X';
    const p2Color = p2Char === 'vanguard' ? '#00f3ff' : '#ff0055';
    this.p2 = new Fighter(2, p2Name, p2Color, 8.0, this.scene);
    
    // Wire cross reference targets
    this.p1.opponent = this.p2;
    this.p2.opponent = this.p1;
    
    // PVC AI setup
    if (this.state.gameMode === 'PVC') {
      this.ai = new FighterAI(this.p2, this.p1);
      this.ai.difficulty = this.state.difficulty;
    } else {
      this.ai = null;
    }
  }

  private cleanupFighters(): void {
    if (this.p1) this.scene.remove(this.p1.group);
    if (this.p2) this.scene.remove(this.p2.group);
    this.ai = null;
  }

  private async startRound(): Promise<void> {
    this.state.isFightActive = false;
    this.stopCountdown();
    
    // Reset fighter stats & coordinates
    this.p1.reset(-8.0);
    this.p2.reset(8.0);
    this.combatSystem.reset();
    
    // Display HUD HUD
    this.hud.showHUD(true);
    
    // Update camera bounds to look at center
    this.cameraController.update(this.p1, this.p2);
    
    // Round Intro Alerts Sequence
    await this.hud.showAlert(`ROUND ${this.state.roundNumber}`, 'info', 1200);
    audio.playAnnouncerRoundStart();
    await this.hud.showAlert('FIGHT!', 'fight', 800);
    
    // Enable active gameplay
    this.state.isFightActive = true;
    this.startCountdown();
  }

  private startCountdown(): void {
    this.stopCountdown();
    this.countdownIntervalId = setInterval(() => {
      if (this.state.currentState === State.FIGHT && this.state.isFightActive) {
        this.state.roundTimer--;
        
        if (this.state.roundTimer <= 0) {
          this.state.roundTimer = 0;
          this.resolveRoundTimeout();
        }
      }
    }, 1000);
  }

  private stopCountdown(): void {
    if (this.countdownIntervalId) {
      clearInterval(this.countdownIntervalId);
      this.countdownIntervalId = null;
    }
  }

  private resolveRoundTimeout(): void {
    this.state.isFightActive = false;
    this.stopCountdown();
    
    // Determine winner based on remaining health meters
    let roundWinner: 1 | 2 = 1;
    if (this.p2.health > this.p1.health) {
      roundWinner = 2;
    } else if (this.p1.health === this.p2.health) {
      // Draw (give round to P1 for prototype simplicity)
      roundWinner = 1;
    }
    
    this.endRound(roundWinner, true);
  }

  private async endRound(winnerNum: 1 | 2, isTimeout: boolean = false): Promise<void> {
    this.state.isFightActive = false;
    this.stopCountdown();
    
    // Trigger Announcer sounds
    audio.playAnnouncerKO();
    
    if (isTimeout) {
      await this.hud.showAlert('TIME UP', 'ko', 2000);
    } else {
      await this.hud.showAlert('K.O.', 'ko', 2500);
      // Street Fighter "PERFECT" callout for a flawless round
      const winner = winnerNum === 1 ? this.p1 : this.p2;
      if (winner.health >= winner.maxHealth) {
        await this.hud.showAlert('PERFECT!', 'fight', 1200);
      }
    }
    
    // Accumulate rounds won
    if (winnerNum === 1) {
      this.state.p1Wins++;
    } else {
      this.state.p2Wins++;
    }
    
    // Check match win condition (Best of 3 rounds)
    if (this.state.p1Wins >= 2 || this.state.p2Wins >= 2) {
      audio.stopBGM();
      audio.playVictoryChime();
      
      // Delay slightly before showing Game Over screens
      setTimeout(() => {
        this.state.changeState(State.GAME_OVER);
      }, 1000);
    } else {
      // Re-trigger next round
      this.state.roundNumber++;
      this.state.resetRound();
      this.startRound();
    }
  }

  private rematch(): void {
    this.state.resetMatch();
    this.state.changeState(State.FIGHT);
  }

  private togglePause(): void {
    if (this.state.currentState === State.FIGHT) {
      this.state.changeState(State.PAUSE);
    } else if (this.state.currentState === State.PAUSE) {
      this.state.changeState(State.FIGHT);
      this.startCountdown(); // Resume timers
    }
  }

  // Street Fighter command interpreter: motion inputs first, then normals
  private handleCombatInputsFor(f: Fighter): void {
    // Not actionable while committed to an attack, in stun, or KO'd
    if (f.attackTimer > 0 || f.hitStunTimer > 0 || f.blockStunTimer > 0 || f.state === 'defeated') {
      return;
    }

    const id = f.id;
    const lightPressed = InputManager.consumeActionPress('light', id);
    const heavyPressed = InputManager.consumeActionPress('heavy', id);
    const kickPressed = InputManager.consumeActionPress('kick', id);
    const specialPressed = InputManager.consumeActionPress('special', id);
    const anyPunch = lightPressed || heavyPressed;

    // 1. SHORYUKEN — → ↓ ↘ + Punch (invincible rising uppercut)
    if (anyPunch && f.isGrounded && InputManager.consumeMotion(id, 'dp')) {
      f.state = 'attack_shoryuken';
      f.attackTimer = 34;
      f.vel.y = 0.82;
      f.vel.x = f.dirSign * 0.32;
      f.isGrounded = false;
      f.invincibilityTimer = 10;
      f.gainEnergy(6);
      return;
    }

    // 2. HADOUKEN — ↓ ↘ → + Punch (free command fireball)
    if (anyPunch && f.isGrounded && InputManager.consumeMotion(id, 'qcf')) {
      f.state = 'attack_special';
      f.attackTimer = 24;
      f.pendingProjectile = 'hadouken';
      f.projectileDelay = 10;
      f.gainEnergy(5);
      return;
    }

    // 3. HURRICANE KICK — ↓ ↙ ← + Kick (traveling spin kick)
    if (kickPressed && f.isGrounded && InputManager.consumeMotion(id, 'qcb')) {
      f.state = 'attack_hurricane';
      f.attackTimer = 36;
      f.vel.y = 0.18;
      f.isGrounded = false;
      f.gainEnergy(6);
      return;
    }

    // 4. SPECIAL BUTTON — full meter = SUPER COMBO, else EX projectile
    if (specialPressed && f.isGrounded) {
      if (f.energy >= f.maxEnergy) {
        f.energy = 0;
        f.state = 'attack_super';
        f.attackTimer = 30;
        f.pendingProjectile = 'super';
        f.projectileDelay = 12;
        this.hud.showAlert('SUPER COMBO!', 'fight', 900);
        window.dispatchEvent(new CustomEvent('camerashake', { detail: { amount: 14, duration: 18 } }));
        return;
      }
      if (f.energy >= 30) {
        f.state = 'attack_special';
        f.attackTimer = 18;
        f.pendingProjectile = 'ex';
        f.projectileDelay = 8;
        return;
      }
    }

    // 5. Normals (work grounded and as jump-in attacks)
    if (lightPressed) {
      f.state = 'attack_light';
      f.attackTimer = 12; // 12 frames lock
      f.gainEnergy(2);
    } else if (heavyPressed) {
      f.state = 'attack_heavy';
      f.attackTimer = 22; // 22 frames lock
      f.gainEnergy(3);
    } else if (kickPressed) {
      if (f.isCrouching && f.isGrounded) {
        // Crouching sweep: slower but knocks down
        f.isSweeping = true;
        f.state = 'attack_kick';
        f.attackTimer = 18;
      } else {
        f.state = 'attack_kick';
        f.attackTimer = 16;
      }
      f.gainEnergy(2);
    }
  }

  // Fireballs come out after their startup frames elapse
  private tickPendingProjectile(f: Fighter): void {
    if (!f.pendingProjectile) return;

    f.projectileDelay--;
    if (f.projectileDelay > 0) return;

    const kind = f.pendingProjectile;
    f.pendingProjectile = null;

    if (kind === 'hadouken') {
      this.combatSystem.spawnHadouken(f);
    } else if (kind === 'super') {
      this.combatSystem.spawnSuperFireball(f);
    } else {
      this.combatSystem.spawnSpecialProjectile(f);
    }
  }

  // --- CORE GAME LOOP ENGINE ---
  private tick(): void {
    this.animationFrameId = requestAnimationFrame(() => this.tick());
    
    const time = performance.now();
    
    // Feed hardware analog gamepads into virtual registers
    GamepadManager.update();

    if (this.state.currentState === State.FIGHT && this.state.isFightActive) {
      // 1. Tick CPU AI first so its virtual inputs are available this frame.
      if (this.state.gameMode === 'PVC' && this.ai) {
        this.ai.update();
      }

      // 2. Sample directional history for Street Fighter command motions
      InputManager.updateMotionBuffer(1, this.p1.dirSign);
      InputManager.updateMotionBuffer(2, this.p2.dirSign);

      // 3. Process active combat actions inputs
      this.handleCombatInputsFor(this.p1);
      this.handleCombatInputsFor(this.p2);

      // 4. Tick characters moves & kinetics
      this.p1.update(time);
      this.p2.update(time);

      // 5. Release fireballs whose startup frames completed
      this.tickPendingProjectile(this.p1);
      this.tickPendingProjectile(this.p2);

      // 6. Update kinematic collisions & active bounds
      this.combatSystem.update(this.p1, this.p2);

      // Check round win outcomes
      if (this.p1.health <= 0) {
        this.endRound(2);
      } else if (this.p2.health <= 0) {
        this.endRound(1);
      }
    }
    
    // Always update these rendering/effects systems during FIGHT or GAME_OVER or MENU backgrounds
    if (this.state.currentState === State.FIGHT || this.state.currentState === State.PAUSE || this.state.currentState === State.GAME_OVER) {
      Effects.update();
      this.cameraController.update(this.p1, this.p2);
      this.hud.update(this.p1, this.p2);
      this.arena.update(time);
    }
    
    // Clear one-frame input edges (button presses, injected motions)
    InputManager.endFrame();

    // Render Frame
    this.renderer.render(this.scene, this.camera);
  }

  public destroy(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.stopCountdown();
    this.cleanupFighters();
    audio.stopBGM();
  }
}
