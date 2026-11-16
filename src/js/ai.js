// ================= NEO-FIGHT ARCADE AI OPPONENT BRAIN =================

export class CPUController {
  constructor(fighter, opponent) {
    this.fighter = fighter; // The AI-controlled Fighter instance (Player 2)
    this.opponent = opponent; // The human Player 1 Fighter instance
    
    // Difficulty Settings: 'easy', 'medium', 'hard'
    this.difficulty = 'medium';
    
    // Action decision timers
    this.decisionTimer = 0;
    this.decisionDelay = 15; // recalculate action every N frames
    
    // Keep track of active inputs to feed into the game loop
    this.controls = {
      left: false,
      right: false,
      jump: false,
      crouch: false,
      punchLight: false,
      punchHeavy: false,
      kick: false,
      special: false,
      dashLeft: false,
      dashRight: false
    };

    // State parameters
    this.attackFrequency = 0.6; // Chance to attack when in range
    this.blockChance = 0.55;    // Chance to guard when P1 attacks
    
    this.applyDifficultySettings();
  }

  setDifficulty(level) {
    this.difficulty = level;
    this.applyDifficultySettings();
  }

  applyDifficultySettings() {
    switch (this.difficulty) {
      case 'easy':
        this.decisionDelay = 22;     // Slow reaction time
        this.attackFrequency = 0.4;  // Less aggressive
        this.blockChance = 0.3;      // Rarely blocks
        break;
      case 'medium':
        this.decisionDelay = 14;     // Medium reaction
        this.attackFrequency = 0.65; // Balanced aggressiveness
        this.blockChance = 0.6;      // Blocks frequently
        break;
      case 'hard':
        this.decisionDelay = 7;      // Frame-perfect reaction
        this.attackFrequency = 0.85; // Highly aggressive combo strings
        this.blockChance = 0.82;     // Blocks almost everything, counters
        break;
    }
  }

  // Called in the game loop to update control outputs
  update() {
    // Stop thinking if anyone is dead
    if (this.fighter.state === 'DEFEATED' || this.opponent.state === 'DEFEATED') {
      this.resetControls();
      return this.controls;
    }

    // Tick decision frame rate
    this.decisionTimer++;
    if (this.decisionTimer >= this.decisionDelay) {
      this.decisionTimer = 0;
      this.makeDecision();
    }

    return this.controls;
  }

  makeDecision() {
    this.resetControls();
    
    const dx = this.opponent.pos.x - this.fighter.pos.x;
    const distance = Math.abs(dx);
    const inRange = distance < 145;
    
    // 1. REACTIVE DEFENSE SYSTEM (Blocking incoming attacks)
    if (this.opponent.isAttacking && Math.random() < this.blockChance && distance < 200) {
      // Hold backward relative to facing direction
      if (dx > 0) {
        this.controls.left = true;
      } else {
        this.controls.right = true;
      }
      
      // Crouch block vs low kick attacks
      if (this.opponent.attackType === 'kick' && Math.random() < 0.8) {
        this.controls.crouch = true;
      }
      return;
    }

    // 2. CLOSE RANGE STRATEGY
    if (inRange) {
      if (Math.random() < this.attackFrequency) {
        // High chance of launching attack strings
        const rand = Math.random();
        
        if (rand < 0.45) {
          this.controls.punchLight = true; // fast jab
        } else if (rand < 0.75) {
          this.controls.kick = true; // poke kick
        } else {
          this.controls.punchHeavy = true; // heavy strike
        }
      } else {
        // Backup / Retreat slightly or Crouch Guard
        if (Math.random() < 0.5) {
          this.controls.crouch = true;
        } else {
          // retreat
          const dashChance = Math.random() < 0.22;
          if (dx > 0) {
            if (dashChance) this.controls.dashLeft = true;
            else this.controls.left = true;
          } else {
            if (dashChance) this.controls.dashRight = true;
            else this.controls.right = true;
          }
        }
      }
    } 
    // 3. MID & FAR RANGE STRATEGIES
    else {
      const isFar = distance > 380;
      
      // Shoot Fireball if energy available
      if (this.fighter.energy >= 30 && Math.random() < 0.4) {
        this.controls.special = true;
        return;
      }

      // Move toward the opponent
      const dashChance = Math.random() < 0.16;
      if (dx > 0) {
        if (dashChance) this.controls.dashRight = true;
        else this.controls.right = true;
      } else {
        if (dashChance) this.controls.dashLeft = true;
        else this.controls.left = true;
      }
      
      // Dynamic jump closures
      if (isFar && Math.random() < 0.15 && this.fighter.state !== 'JUMP') {
        this.controls.jump = true;
      }
    }
  }

  resetControls() {
    this.controls.left = false;
    this.controls.right = false;
    this.controls.jump = false;
    this.controls.crouch = false;
    this.controls.punchLight = false;
    this.controls.punchHeavy = false;
    this.controls.kick = false;
    this.controls.special = false;
    this.controls.dashLeft = false;
    this.controls.dashRight = false;
  }
}
