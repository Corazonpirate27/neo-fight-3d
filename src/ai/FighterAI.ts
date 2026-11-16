import { Fighter } from '../entities/Fighter';
import { Action, InputManager, Motion } from '../input/InputManager';
import type { Difficulty } from '../core/GameState';

interface DifficultyProfile {
  decisionInterval: number;
  blockChance: number;
  attackCooldown: number;
  dashChance: number;
  projectileChance: number;
  jumpChance: number;
  retreatChance: number;
  pokeChance: number;
  closeRange: number;
  midRange: number;
}

const AI_PROFILES: Record<Difficulty, DifficultyProfile> = {
  EASY: {
    decisionInterval: 34,
    blockChance: 0.18,
    attackCooldown: 15,
    dashChance: 0.16,
    projectileChance: 0.08,
    jumpChance: 0.08,
    retreatChance: 0.22,
    pokeChance: 0.3,
    closeRange: 6.0,
    midRange: 14.0
  },
  MEDIUM: {
    decisionInterval: 13,
    blockChance: 0.55,
    attackCooldown: 5,
    dashChance: 0.42,
    projectileChance: 0.2,
    jumpChance: 0.16,
    retreatChance: 0.12,
    pokeChance: 0.52,
    closeRange: 6.4,
    midRange: 15.5
  },
  HARD: {
    decisionInterval: 6,
    blockChance: 0.86,
    attackCooldown: 3,
    dashChance: 0.58,
    projectileChance: 0.34,
    jumpChance: 0.24,
    retreatChance: 0.05,
    pokeChance: 0.72,
    closeRange: 7.0,
    midRange: 17.0
  }
};

export class FighterAI {
  private cpu: Fighter;
  private opponent: Fighter;
  
  // Reaction timers
  private updateTimer: number = 0;
  private actionCooldown: number = 0;
  
  // Custom difficulty coefficients
  public difficulty: Difficulty = 'MEDIUM';

  constructor(cpu: Fighter, opponent: Fighter) {
    this.cpu = cpu;
    this.opponent = opponent;
  }

  public update(): void {
    if (this.cpu.state === 'defeated' || this.opponent.state === 'defeated') {
      this.clearAllInputs();
      return;
    }

    this.updateTimer++;
    if (this.actionCooldown > 0) {
      this.actionCooldown--;
    }
    
    // Smart Reactive Defense: Guard immediately if player attacks near the CPU
    this.resolveReactiveDefense();

    const profile = this.getProfile();
    const decisionInterval = profile.decisionInterval;
    
    if (this.updateTimer >= decisionInterval) {
      this.updateTimer = 0;
      
      if (this.actionCooldown > 0) {
        return;
      }
      
      this.makeDecision();
    }
  }

  private resolveReactiveDefense(): void {
    const dist = Math.abs(this.cpu.pos.x - this.opponent.pos.x);
    const inRange = dist < 7.0;
    
    const isPlayerAttacking = this.opponent.isAttacking();

    if (inRange && isPlayerAttacking && this.cpu.isGrounded && this.cpu.state !== 'hitstun') {
      // High chance to react block depending on difficulty
      const blockChance = this.getProfile().blockChance;
      
      if (Math.random() < blockChance) {
        InputManager.setTouchInput('block', true, 2);
        return;
      }
    } else {
      // Clear block once player stops attacking
      if (!InputManager.isActionPressed('down', 2)) {
        InputManager.setTouchInput('block', false, 2);
      }
    }
  }

  private makeDecision(): void {
    const dist = Math.abs(this.cpu.pos.x - this.opponent.pos.x);
    const profile = this.getProfile();

    // Clear walk inputs by default
    InputManager.setTouchInput('left', false, 2);
    InputManager.setTouchInput('right', false, 2);
    InputManager.setTouchInput('up', false, 2);
    InputManager.setTouchInput('down', false, 2);

    const directionToOpponent = this.opponent.pos.x > this.cpu.pos.x ? 'right' : 'left';
    const directionAway = directionToOpponent === 'right' ? 'left' : 'right';

    // Super Combo the moment the meter is full (aggressiveness scales with difficulty)
    if (this.cpu.energy >= this.cpu.maxEnergy && Math.random() < profile.projectileChance * 2) {
      this.triggerAction('special');
      return;
    }

    // Anti-air Shoryuken when the player jumps in
    if (!this.opponent.isGrounded && dist < 9.0 && this.cpu.isGrounded && Math.random() < profile.blockChance * 0.6) {
      this.triggerSpecialMove('dp', 'heavy');
      return;
    }

    // 1. Far range behavior
    if (dist > profile.midRange) {
      const roll = Math.random();
      if (roll < profile.projectileChance) {
        // Hadouken zoning from full screen!
        this.triggerSpecialMove('qcf', 'heavy');
      } else if (roll < profile.projectileChance + profile.dashChance) {
        // Dash closer!
        this.cpu.state = 'dash';
        this.cpu.dashTimer = 14;
        this.cpu.vel.x = (directionToOpponent === 'right' ? 1 : -1) * 1.55;
      } else {
        // Walk closer
        InputManager.setTouchInput(directionToOpponent as Action, true, 2);
      }
    }
    // 2. Mid range behavior
    else if (dist > profile.closeRange && dist <= profile.midRange) {
      const roll = Math.random();
      if (roll < profile.pokeChance) {
        // Throw long-range pokes so the CPU fights before it is nose-to-nose.
        this.triggerAction(Math.random() < 0.55 ? 'heavy' : 'kick');
      } else if (roll < profile.pokeChance + 0.28) {
        // Walk closer
        InputManager.setTouchInput(directionToOpponent as Action, true, 2);
      } else if (roll < profile.pokeChance + 0.28 + profile.jumpChance && this.cpu.isGrounded) {
        // Jump attack attempt
        InputManager.setTouchInput('jump', true, 2);
        setTimeout(() => InputManager.setTouchInput('jump', false, 2), 50);
        
        // Attack mid air
        setTimeout(() => this.triggerAction(Math.random() < 0.6 ? 'heavy' : 'kick'), 200);
      } else if (roll < profile.pokeChance + 0.28 + profile.jumpChance + profile.retreatChance) {
        // Backup walk
        InputManager.setTouchInput(directionAway as Action, true, 2);
      } else if (Math.random() < profile.projectileChance) {
        // Mid-range Hadouken or Hurricane Kick mixup
        if (Math.random() < 0.6) {
          this.triggerSpecialMove('qcf', 'heavy');
        } else {
          this.triggerSpecialMove('qcb', 'kick');
        }
      } else {
        InputManager.setTouchInput(directionToOpponent as Action, true, 2);
      }
    }
    // 3. Close range combat behavior
    else {
      const roll = Math.random();
      if (roll < (this.difficulty === 'HARD' ? 0.44 : 0.34)) {
        // Fast jab Light attack
        this.triggerAction('light');
      } else if (roll < (this.difficulty === 'EASY' ? 0.5 : 0.62)) {
        // Sweep Kick
        this.triggerAction('kick');
      } else if (roll < (this.difficulty === 'HARD' ? 0.9 : 0.8)) {
        // Heavy Strike
        this.triggerAction('heavy');
      } else {
        // Backstep instead of sidestepping; the game is locked to a 2D plane.
        if (Math.random() < profile.retreatChance) {
          InputManager.setTouchInput(directionAway as Action, true, 2);
          this.actionCooldown = 2;
        } else {
          this.triggerAction(Math.random() < 0.5 ? 'light' : 'kick');
        }
      }
    }
  }

  // Executes a Street Fighter command move with perfect motion input
  private triggerSpecialMove(motion: Motion, button: Action): void {
    InputManager.injectMotion(2, motion);
    this.triggerAction(button);
  }

  private triggerAction(action: Action): void {
    InputManager.setTouchInput('left', false, 2);
    InputManager.setTouchInput('right', false, 2);
    InputManager.setTouchInput('block', false, 2);
    InputManager.setTouchInput(action, true, 2);
    
    // Hold short frame to ensure registry, then clear key down state
    setTimeout(() => {
      InputManager.setTouchInput(action, false, 2);
    }, 40);
    
    this.actionCooldown = this.getProfile().attackCooldown;
  }

  private getProfile(): DifficultyProfile {
    return AI_PROFILES[this.difficulty];
  }

  private clearAllInputs(): void {
    InputManager.setTouchInput('left', false, 2);
    InputManager.setTouchInput('right', false, 2);
    InputManager.setTouchInput('up', false, 2);
    InputManager.setTouchInput('down', false, 2);
    InputManager.setTouchInput('light', false, 2);
    InputManager.setTouchInput('heavy', false, 2);
    InputManager.setTouchInput('kick', false, 2);
    InputManager.setTouchInput('block', false, 2);
    InputManager.setTouchInput('special', false, 2);
    InputManager.setTouchInput('jump', false, 2);
  }
}
