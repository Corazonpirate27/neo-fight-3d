// ================= NEO-FIGHT ARCADE MASTER CONTROLLER =================
import { Fighter } from './fighter.js?v=1.0.5';
import { input } from './input.js?v=1.0.5';
import { particles } from './particles.js?v=1.0.5';
import { audio } from './audio.js?v=1.0.5';
import { CPUController } from './ai.js?v=1.0.5';

class GameController {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    
    // Character selection preview canvases
    this.p1PreviewCanvas = document.getElementById('p1-preview-canvas');
    this.p2PreviewCanvas = document.getElementById('p2-preview-canvas');
    this.p1PreviewCtx = this.p1PreviewCanvas.getContext('2d');
    this.p2PreviewCtx = this.p2PreviewCanvas.getContext('2d');
    this.p1PreviewFighter = null;
    this.p2PreviewFighter = null;
    
    // Game Mode State: 'MENU', 'CHAR_SELECT', 'CONTROLS', 'CREDITS', 'FIGHTING', 'PAUSED', 'GAME_OVER'
    this.gameState = 'MENU';
    this.gameMode = 'PVC'; // 'PVC' (vs AI) or 'PVP' (local 2P)
    this.selectedDifficulty = 'medium'; // Dynamic CPU Difficulty
    
    // Players Selection Setup
    this.p1SelectedChar = 'shadow';
    this.p2SelectedChar = 'blaze';
    
    this.player1 = null;
    this.player2 = null;
    this.cpuBrain = null;
    
    // Scoreboards & Round parameters
    this.roundNumber = 1;
    this.p1RoundWins = 0;
    this.p2RoundWins = 0;
    this.roundTime = 99;
    this.roundTimerInterval = null;
    this.isRoundOver = false;
    
    // visual styling
    this.shakeAmount = 0;
    this.shakeDuration = 0;
    
    // Cinematic slowdown tracker
    this.timeDilation = 1.0; 
    
    // Background neon grid offsets
    this.gridOffset = 0;
    
    // Hit stop freeze & impact flashes
    this.hitStopTimer = 0;
    this.hitFlashTimer = 0;
    
    // Twinkling cyber stars in skyline
    this.stars = [];
    for (let i = 0; i < 24; i++) {
      this.stars.push({
        x: Math.random() * 1280,
        y: 40 + Math.random() * 200,
        size: 1 + Math.random() * 2,
        phase: Math.random() * Math.PI * 2,
        speed: 0.02 + Math.random() * 0.04
      });
    }

    // Cruising neon vehicles
    this.vehicles = [
      { x: 100, y: 150, speed: 1.5, color: '#00f3ff', width: 25 },
      { x: 800, y: 220, speed: -1.0, color: '#ff0055', width: 30 }
    ];

    // Debug toggle
    this.showHitboxes = false;
    
    // Dynamic 3D Camera System
    this.camera = {
      x: 640,
      y: 360,
      zoom: 1.0,
      targetZoom: 1.0,
      impactZoomOffset: 0,
      vibrationX: 0,
      vibrationY: 0
    };
    
    this.initDOM();
    this.initPreviewFighters();
  }

  initPreviewFighters() {
    const p1Color = this.p1SelectedChar === 'shadow' ? '#00f3ff' : '#ff0055';
    const p2Color = this.p2SelectedChar === 'shadow' ? '#00f3ff' : '#ff0055';

    this.p1PreviewFighter = new Fighter({
      x: 75,
      y: 170,
      color: p1Color,
      name: this.p1SelectedChar.toUpperCase(),
      characterType: this.p1SelectedChar,
      isPlayer2: false,
      groundY: 170
    });

    this.p2PreviewFighter = new Fighter({
      x: 75,
      y: 170,
      color: p2Color,
      name: this.p2SelectedChar.toUpperCase(),
      characterType: this.p2SelectedChar,
      isPlayer2: true,
      groundY: 170
    });
  }

  // --- DOM BINDINGS & SCREEN UI ROUTING ---

  initDOM() {
    // Menu Buttons
    document.getElementById('btn-pvc').addEventListener('click', () => this.switchMode('PVC'));
    document.getElementById('btn-pvp').addEventListener('click', () => this.switchMode('PVP'));
    
    document.getElementById('btn-controls').addEventListener('click', () => {
      audio.playLaser();
      this.switchScreen('controls-screen');
    });
    
    document.getElementById('btn-credits').addEventListener('click', () => {
      audio.playLaser();
      this.switchScreen('credits-screen');
    });

    document.getElementById('btn-controls-back').addEventListener('click', () => this.backToMenu());
    document.getElementById('btn-credits-back').addEventListener('click', () => this.backToMenu());
    
    // Audio Toggle
    const muteToggle = document.getElementById('mute-toggle');
    muteToggle.addEventListener('click', () => {
      const isMuted = audio.toggleMute();
      muteToggle.classList.toggle('muted', isMuted);
    });

    // Character Card selections
    const shadowCard = document.getElementById('char-card-shadow');
    const blazeCard = document.getElementById('char-card-blaze');
    
    shadowCard.addEventListener('click', () => this.selectChar('shadow'));
    blazeCard.addEventListener('click', () => this.selectChar('blaze'));

    // Mouse Action Buttons
    document.getElementById('btn-char-confirm').addEventListener('click', () => this.confirmCharSelection());
    document.getElementById('btn-char-back').addEventListener('click', () => this.backToMenu());

    // Difficulty selection pills
    const pills = document.querySelectorAll('.diff-pill');
    pills.forEach(pill => {
      pill.addEventListener('click', (e) => {
        const diff = e.currentTarget.getAttribute('data-difficulty');
        this.selectedDifficulty = diff;
        pills.forEach(p => p.classList.remove('active'));
        e.currentTarget.classList.add('active');
        audio.playLaser();
        if (this.cpuBrain) {
          this.cpuBrain.setDifficulty(diff);
        }
      });
    });

    // Menu button focus helpers (for keyboard menu browsing)
    window.addEventListener('keydown', (e) => {
      const code = e.code;
      const key = e.key ? e.key.toLowerCase() : '';
      
      if (this.gameState === 'MENU') {
        const btns = Array.from(document.querySelectorAll('#menu-screen .menu-btn'));
        let activeIdx = btns.findIndex(b => b.classList.contains('active'));
        
        if (code === 'ArrowDown' || code === 'KeyS' || key === 'arrowdown' || key === 's') {
          btns[activeIdx].classList.remove('active');
          activeIdx = (activeIdx + 1) % btns.length;
          btns[activeIdx].classList.add('active');
          audio.playLaser();
        } else if (code === 'ArrowUp' || code === 'KeyW' || key === 'arrowup' || key === 'w') {
          btns[activeIdx].classList.remove('active');
          activeIdx = (activeIdx - 1 + btns.length) % btns.length;
          btns[activeIdx].classList.add('active');
          audio.playLaser();
        } else if (code === 'Enter' || key === 'enter') {
          btns[activeIdx].click();
        }
      } 
      else if (this.gameState === 'CHAR_SELECT') {
        if (code === 'ArrowLeft' || code === 'KeyA' || key === 'arrowleft' || key === 'a') {
          this.selectChar('shadow');
        } else if (code === 'ArrowRight' || code === 'KeyD' || key === 'arrowright' || key === 'd') {
          this.selectChar('blaze');
        } else if (code === 'Enter' || key === 'enter') {
          this.confirmCharSelection();
        } else if (code === 'Escape' || key === 'escape') {
          this.backToMenu();
        }
      } 
      else if (this.gameState === 'FIGHTING') {
        if (code === 'Escape' || code === 'KeyP' || key === 'escape' || key === 'p') {
          this.togglePause();
        }
        if (code === 'Tab' || key === 'tab') {
          // Toggle debug hitboxes overlay
          this.showHitboxes = !this.showHitboxes;
        }
      }
      else if (this.gameState === 'GAME_OVER') {
        const btns = Array.from(document.querySelectorAll('#game-over-screen .menu-btn'));
        let activeIdx = btns.findIndex(b => b.classList.contains('active'));
        if (code === 'ArrowDown' || code === 'KeyS' || code === 'ArrowUp' || code === 'KeyW' || key === 'arrowdown' || key === 'arrowup' || key === 's' || key === 'w') {
          btns[activeIdx].classList.remove('active');
          activeIdx = 1 - activeIdx; // toggle between 0 and 1
          btns[activeIdx].classList.add('active');
          audio.playLaser();
        } else if (code === 'Enter' || key === 'enter') {
          btns[activeIdx].click();
        }
      }
    });

    // Pause Screen Buttons
    document.getElementById('btn-resume').addEventListener('click', () => this.togglePause());
    document.getElementById('btn-quit').addEventListener('click', () => this.quitToMenu());
    
    // Post Game Buttons
    document.getElementById('btn-rematch').addEventListener('click', () => this.rematchGame());
    document.getElementById('btn-game-over-quit').addEventListener('click', () => this.quitToMenu());

    // Kickstart Core Engine Loop
    this.startLoop();
  }

  switchScreen(screenId) {
    document.querySelectorAll('.game-screen').forEach(scr => scr.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
    
    if (screenId === 'menu-screen') this.gameState = 'MENU';
    if (screenId === 'char-select-screen') this.gameState = 'CHAR_SELECT';
    if (screenId === 'game-screen') this.gameState = 'FIGHTING';
    if (screenId === 'game-over-screen') this.gameState = 'GAME_OVER';

    // Defocus any active buttons to prevent keyboard focus traps across all screens
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur();
    }
    window.focus();
  }

  backToMenu() {
    audio.playLaser();
    this.switchScreen('menu-screen');
  }

  switchMode(mode) {
    audio.playLaser();
    audio.init();
    this.gameMode = mode;
    
    // Configure visual indicators on character selection panel
    const p2Role = document.getElementById('p2-role-indicator');
    const diffBox = document.getElementById('difficulty-selector-box');
    if (mode === 'PVC') {
      p2Role.innerText = 'CPU OPPONENT';
      p2Role.classList.remove('p2-indicator');
      p2Role.style.color = 'var(--color-p2)';
      p2Role.style.borderColor = 'var(--color-p2)';
      diffBox.style.display = 'flex';
    } else {
      p2Role.innerText = 'PLAYER 2';
      p2Role.classList.add('p2-indicator');
      diffBox.style.display = 'none';
    }
    
    this.initPreviewFighters();
    this.switchScreen('char-select-screen');
  }

  selectChar(char) {
    audio.playLaser();
    
    const shadowCard = document.getElementById('char-card-shadow');
    const blazeCard = document.getElementById('char-card-blaze');
    
    if (char === 'shadow') {
      this.p1SelectedChar = 'shadow';
      this.p2SelectedChar = 'blaze';
      shadowCard.classList.add('active');
      blazeCard.classList.remove('active');
      
      // Update preview card styles
      this.updatePreviewCards('shadow', 'blaze');
    } else {
      this.p1SelectedChar = 'blaze';
      this.p2SelectedChar = 'shadow';
      blazeCard.classList.add('active');
      shadowCard.classList.remove('active');
      
      this.updatePreviewCards('blaze', 'shadow');
    }
    
    this.initPreviewFighters();
  }

  updatePreviewCards(p1Char, p2Char) {
    const p1Preview = document.getElementById('p1-preview');
    const p2Preview = document.getElementById('p2-preview');
    
    document.getElementById('p1-name-preview').innerText = p1Char.toUpperCase();
    document.getElementById('p2-name-preview').innerText = p2Char.toUpperCase();
    
    // Speed, Power, Range stats toggling visualizer
    const p1Stats = p1Char === 'shadow' ? [85, 60, 75] : [50, 90, 65];
    const p2Stats = p2Char === 'shadow' ? [85, 60, 75] : [50, 90, 65];
    
    const p1Bars = p1Preview.querySelectorAll('.stat-fill');
    const p2Bars = p2Preview.querySelectorAll('.stat-fill');
    
    p1Bars[0].style.width = `${p1Stats[0]}%`;
    p1Bars[1].style.width = `${p1Stats[1]}%`;
    p1Bars[2].style.width = `${p1Stats[2]}%`;
    
    p2Bars[0].style.width = `${p2Stats[0]}%`;
    p2Bars[1].style.width = `${p2Stats[1]}%`;
    p2Bars[2].style.width = `${p2Stats[2]}%`;
  }

  confirmCharSelection() {
    audio.playVictoryChime();
    
    // Initialise Fighters
    const p1Color = this.p1SelectedChar === 'shadow' ? '#00f3ff' : '#ff0055';
    const p2Color = this.p2SelectedChar === 'shadow' ? '#00f3ff' : '#ff0055';
    
    this.player1 = new Fighter({
      x: 350,
      y: 560,
      color: p1Color,
      name: this.p1SelectedChar.toUpperCase(),
      characterType: this.p1SelectedChar,
      isPlayer2: false
    });
    
    this.player2 = new Fighter({
      x: 930,
      y: 560,
      color: p2Color,
      name: this.p2SelectedChar.toUpperCase(),
      characterType: this.p2SelectedChar,
      isPlayer2: true
    });
    
    // Link opponents
    this.player1.opponent = this.player2;
    this.player2.opponent = this.player1;
    
    if (this.gameMode === 'PVC') {
      this.cpuBrain = new CPUController(this.player2, this.player1);
      this.cpuBrain.setDifficulty(this.selectedDifficulty);
    } else {
      this.cpuBrain = null;
    }
    
    // Set dynamic HUD names
    document.getElementById('hud-p1-name').innerText = this.player1.name;
    document.getElementById('hud-p2-name').innerText = this.player2.name;
    
    // Reset scores & state
    this.p1RoundWins = 0;
    this.p2RoundWins = 0;
    this.roundNumber = 1;
    
    this.resetRoundIndicators();
    this.switchScreen('game-screen');
    
    // De-focus previously active buttons so they do not trap or swallow gameplay keyboard inputs
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur();
    }
    window.focus();
    
    // Start fighting music
    audio.startBGM();
    
    // Start first fighting round
    this.startRound();
  }

  triggerHitFlash() {
    this.hitFlashTimer = 5; // Flash contrast frames
    this.camera.impactZoomOffset = 0.35; // Snap zoom inward on impact!
  }

  // --- FIGHT ENGINE ROUND MANAGEMENT ---

  startRound() {
    this.isRoundOver = false;
    this.roundTime = 99;
    this.timeDilation = 1.0;
    this.gridOffset = 0;
    
    // Reset fighters configurations
    this.player1.reset(350, 560);
    this.player2.reset(930, 560);
    
    particles.clear();
    input.clear();
    
    // Animate announcement text
    const alertOverlay = document.getElementById('arena-alert');
    const alertText = document.getElementById('arena-alert-text');
    
    alertOverlay.style.display = 'flex';
    alertText.innerText = `ROUND ${this.roundNumber}`;
    alertText.className = 'alert-title round-intro animate-alert';
    
    audio.playAnnouncerRoundStart();
    
    // After 1.2s, trigger "FIGHT!"
    setTimeout(() => {
      if (this.gameState === 'MENU' || this.gameState === 'CHAR_SELECT' || this.gameState === 'GAME_OVER') return;
      alertText.innerText = 'FIGHT!';
      alertText.className = 'alert-title fight-intro animate-alert';
      
      // Enable clock countdown
      this.startCountdown();
      
      // After 1.0s, hide the announcement overlay so players can move!
      setTimeout(() => {
        if (this.gameState === 'MENU' || this.gameState === 'CHAR_SELECT' || this.gameState === 'GAME_OVER') return;
        alertOverlay.style.display = 'none';
      }, 1000);
    }, 1250);
  }

  startCountdown() {
    if (this.roundTimerInterval) clearInterval(this.roundTimerInterval);
    
    this.roundTimerInterval = setInterval(() => {
      if (this.gameState === 'PAUSED' || this.isRoundOver) return;
      
      this.roundTime--;
      document.getElementById('hud-timer').innerText = this.roundTime;
      
      if (this.roundTime <= 0) {
        clearInterval(this.roundTimerInterval);
        this.timeOverDraw();
      }
    }, 1000);
  }

  timeOverDraw() {
    this.isRoundOver = true;
    
    // Determine winner based on remaining health
    let winner = null;
    if (this.player1.health > this.player2.health) {
      winner = this.player1;
      this.p1RoundWins++;
    } else if (this.player2.health > this.player1.health) {
      winner = this.player2;
      this.p2RoundWins++;
    }
    
    this.showRoundVictoryText(winner, 'TIME OVER');
  }

  // Handle a combat death
  handlePlayerKilled(killedPlayer) {
    if (this.isRoundOver) return;
    this.isRoundOver = true;
    
    if (this.roundTimerInterval) clearInterval(this.roundTimerInterval);
    
    const winner = (killedPlayer === this.player1) ? this.player2 : this.player1;
    
    if (winner === this.player1) this.p1RoundWins++;
    else this.p2RoundWins++;
    
    // Add cool dramatic cinematic slowdown frame dilation
    this.timeDilation = 0.15; // Slow time to 15% speed!
    this.triggerScreenShake(20, 24);
    
    audio.playAnnouncerKO();
    
    // Show visual Alert K.O.
    const alertOverlay = document.getElementById('arena-alert');
    const alertText = document.getElementById('arena-alert-text');
    
    alertOverlay.style.display = 'flex';
    alertText.innerText = 'K.O.';
    alertText.className = 'alert-title ko-alert animate-alert';
    
    // After 2.5 seconds of slowed down motion, restore time speed and resolve round
    setTimeout(() => {
      this.timeDilation = 1.0;
      this.showRoundVictoryText(winner, 'K.O.');
    }, 2000);
  }

  showRoundVictoryText(winner, prefix = 'K.O.') {
    this.updateRoundIndicators();
    
    const alertOverlay = document.getElementById('arena-alert');
    const alertText = document.getElementById('arena-alert-text');
    
    alertOverlay.style.display = 'flex';
    if (winner) {
      alertText.innerText = `${winner.name} WINS!`;
      alertText.className = 'alert-title round-intro animate-alert';
      audio.playVictoryChime();
    } else {
      alertText.innerText = 'DRAW';
      alertText.className = 'alert-title ko-alert animate-alert';
    }
    
    // Check if tournament match is settled (Best of 3)
    setTimeout(() => {
      if (this.gameState !== 'FIGHTING') return;
      alertOverlay.style.display = 'none';
      
      if (this.p1RoundWins >= 2 || this.p2RoundWins >= 2) {
        // Tournament completed! Show game over
        this.endMatch(winner);
      } else {
        // Proceed to next round
        this.roundNumber++;
        this.startRound();
      }
    }, 2800);
  }

  endMatch(winner) {
    audio.stopBGM();
    
    this.gameState = 'GAME_OVER';
    
    const header = document.getElementById('victory-header-text');
    const sub = document.getElementById('victory-sub-text');
    
    if (winner) {
      header.innerText = `${winner.name} WINS!`;
      
      if (this.p1RoundWins === 2 && this.p2RoundWins === 0 || this.p2RoundWins === 2 && this.p1RoundWins === 0) {
        sub.innerText = 'SUPREME VICTORY';
        header.style.color = 'var(--color-energy)';
        header.style.textShadow = '0 0 15px var(--color-energy-glow)';
      } else {
        sub.innerText = 'EXCELLENT MATCH';
        header.style.color = winner.color;
        header.style.textShadow = `0 0 15px ${winner.glowColor}`;
      }
    } else {
      header.innerText = 'DOUBLE DRAW';
      sub.innerText = 'NO CONTEST';
    }
    
    this.switchScreen('game-over-screen');
  }

  // --- GAMEPLAY INTERACTIVE LOOPS ---

  startLoop() {
    const loop = () => {
      this.update();
      this.draw();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  update() {
    if (this.gameState === 'CHAR_SELECT') {
      if (this.p1PreviewFighter) this.p1PreviewFighter.update(this.p1PreviewCanvas.width);
      if (this.p2PreviewFighter) this.p2PreviewFighter.update(this.p2PreviewCanvas.width);
      return;
    }
    if (this.gameState !== 'FIGHTING') return;
    
    // Dynamic 3D Camera update calculations
    if (this.player1 && this.player2) {
      const midX = (this.player1.pos.x + this.player2.pos.x) / 2;
      const midY = (this.player1.pos.y + this.player2.pos.y) / 2 - 60;
      
      const distance = Math.abs(this.player1.pos.x - this.player2.pos.x);
      
      // Calculate target zoom based on distance
      let targetZoom = 1.3 - (distance / 850);
      targetZoom = Math.max(0.75, Math.min(1.4, targetZoom));
      
      // Smooth lerp camera
      this.camera.x += (midX - this.camera.x) * 0.08;
      const targetY = Math.min(360, midY * 0.4 + 200);
      this.camera.y += (targetY - this.camera.y) * 0.08;
      this.camera.targetZoom = targetZoom;
    }
    
    // Zoom lerp with impact snap decay
    let activeZoom = this.camera.targetZoom + this.camera.impactZoomOffset;
    this.camera.zoom += (activeZoom - this.camera.zoom) * 0.08;
    
    if (this.camera.impactZoomOffset > 0) {
      this.camera.impactZoomOffset *= 0.88;
      if (this.camera.impactZoomOffset < 0.005) this.camera.impactZoomOffset = 0;
    }

    // Apply camera shakes
    if (this.shakeDuration > 0) {
      this.shakeDuration--;
      if (this.shakeDuration === 0) this.shakeAmount = 0;
    }

    // Decrement hit flash
    if (this.hitFlashTimer > 0) this.hitFlashTimer--;

    // Cruising vehicles update even during hit freeze stop
    if (this.vehicles) {
      this.vehicles.forEach(v => {
        v.x += v.speed;
        if (v.speed > 0 && v.x > this.canvas.width + 50) v.x = -50;
        if (v.speed < 0 && v.x < -50) v.x = this.canvas.width + 50;
      });
    }

    // Hit stop freeze: skip fighter movement and coordinate updates
    if (this.hitStopTimer > 0) {
      this.hitStopTimer--;
      // Let particles run for organic fluidity
      particles.update();
      this.gridOffset = (this.gridOffset + 1.2) % 40;
      this.updateHUDValues();
      return;
    }

    // Capture control states
    let p1Controls = {};
    let p2Controls = {};
    
    // Lock all actions/inputs during the round announcer countdown intro sequence
    const isIntroActive = document.getElementById('arena-alert').style.display === 'flex' && 
                          document.getElementById('arena-alert-text').innerText.startsWith('ROUND');

    if (!isIntroActive) {
      p1Controls = input.getP1Controls();
      if (this.gameMode === 'PVC' && this.cpuBrain) {
        p2Controls = this.cpuBrain.update();
      } else {
        p2Controls = input.getP2Controls();
      }
    }

    // Update floating input HUD displays
    this.updateInputDisplay(p1Controls, p2Controls);

    // Apply time dilation on updates for K.O. slow motion effect
    const loops = Math.round(1 / this.timeDilation);
    
    for (let l = 0; l < (this.isRoundOver ? 1 : loops); l++) {
      // 1. UPDATE PLAYER 1 Movement & Dashes
      if (p1Controls.dashLeft) this.player1.dash(-1);
      else if (p1Controls.dashRight) this.player1.dash(1);
      else if (p1Controls.left) this.player1.move(-1);
      else if (p1Controls.right) this.player1.move(1);
      else this.player1.stopMoving();

      if (p1Controls.jump) this.player1.jump();
      this.player1.crouch(p1Controls.crouch);

      if (p1Controls.punchLight) this.player1.attack('light');
      else if (p1Controls.punchHeavy) this.player1.attack('heavy');
      else if (p1Controls.kick) this.player1.attack('kick');
      else if (p1Controls.special) this.player1.attack('special');

      // 2. UPDATE PLAYER 2 Movement & Dashes
      if (p2Controls.dashLeft) this.player2.dash(-1);
      else if (p2Controls.dashRight) this.player2.dash(1);
      else if (p2Controls.left) this.player2.move(-1);
      else if (p2Controls.right) this.player2.move(1);
      else this.player2.stopMoving();

      if (p2Controls.jump) this.player2.jump();
      this.player2.crouch(p2Controls.crouch);

      if (p2Controls.punchLight) this.player2.attack('light');
      else if (p2Controls.punchHeavy) this.player2.attack('heavy');
      else if (p2Controls.kick) this.player2.attack('kick');
      else if (p2Controls.special) this.player2.attack('special');

      // 3. PHYS UPDATES
      // If round is not fully running yet (pre-start alert showing), lock positions
      if (isIntroActive) {
        this.player1.vel.x = 0;
        this.player2.vel.x = 0;
      }

      this.player1.update(this.canvas.width);
      this.player2.update(this.canvas.width);
      
      // Update interactive sparks
      particles.update();
      
      // 4. VERIFY DEATH
      if (!this.isRoundOver) {
        if (this.player1.health <= 0) {
          this.handlePlayerKilled(this.player1);
        } else if (this.player2.health <= 0) {
          this.handlePlayerKilled(this.player2);
        }
      }
    }

    // Background speed lines movement
    this.gridOffset = (this.gridOffset + 1.2) % 40;

    // Update UI HUD Components
    this.updateHUDValues();
  }

  updateInputDisplay(p1Controls, p2Controls) {
    const keys = ['left', 'right', 'jump', 'crouch', 'punchLight', 'punchHeavy', 'kick', 'special'];
    keys.forEach(k => {
      const p1El = document.getElementById(`key-p1-${k}`);
      const p2El = document.getElementById(`key-p2-${k}`);
      if (p1El) {
        if (p1Controls[k]) p1El.classList.add('active');
        else p1El.classList.remove('active');
      }
      if (p2El) {
        if (p2Controls[k]) p2El.classList.add('active');
        else p2El.classList.remove('active');
      }
    });
  }

  // --- DYNAMIC RENDERING ---

  draw() {
    if (this.gameState === 'CHAR_SELECT') {
      const w1 = this.p1PreviewCanvas.width;
      const h1 = this.p1PreviewCanvas.height;
      const w2 = this.p2PreviewCanvas.width;
      const h2 = this.p2PreviewCanvas.height;

      // 1. Render P1 Glassmorphic Neon Card
      this.p1PreviewCtx.clearRect(0, 0, w1, h1);
      
      // Draw smooth dark neon radial gradient background
      const grad1 = this.p1PreviewCtx.createRadialGradient(w1/2, h1/2, 10, w1/2, h1/2, w1);
      grad1.addColorStop(0, 'rgba(15, 8, 38, 0.85)');
      grad1.addColorStop(1, 'rgba(6, 2, 17, 0.95)');
      this.p1PreviewCtx.fillStyle = grad1;
      this.p1PreviewCtx.fillRect(0, 0, w1, h1);
      
      // Draw neon border with glow
      this.p1PreviewCtx.save();
      this.p1PreviewCtx.strokeStyle = this.p1SelectedChar === 'shadow' ? '#00f3ff' : '#ff0055';
      this.p1PreviewCtx.shadowColor = this.p1PreviewCtx.strokeStyle;
      this.p1PreviewCtx.shadowBlur = 12;
      this.p1PreviewCtx.lineWidth = 2.5;
      this.p1PreviewCtx.strokeRect(4, 4, w1 - 8, h1 - 8);
      this.p1PreviewCtx.restore();

      // Render P1 Fighter
      if (this.p1PreviewFighter) {
        this.p1PreviewFighter.draw(this.p1PreviewCtx, false);
      }

      // 2. Render P2 Glassmorphic Neon Card
      this.p2PreviewCtx.clearRect(0, 0, w2, h2);
      
      // Draw smooth dark neon radial gradient background
      const grad2 = this.p2PreviewCtx.createRadialGradient(w2/2, h2/2, 10, w2/2, h2/2, w2);
      grad2.addColorStop(0, 'rgba(15, 8, 38, 0.85)');
      grad2.addColorStop(1, 'rgba(6, 2, 17, 0.95)');
      this.p2PreviewCtx.fillStyle = grad2;
      this.p2PreviewCtx.fillRect(0, 0, w2, h2);
      
      // Draw neon border with glow
      this.p2PreviewCtx.save();
      this.p2PreviewCtx.strokeStyle = this.p2SelectedChar === 'shadow' ? '#00f3ff' : '#ff0055';
      this.p2PreviewCtx.shadowColor = this.p2PreviewCtx.strokeStyle;
      this.p2PreviewCtx.shadowBlur = 12;
      this.p2PreviewCtx.lineWidth = 2.5;
      this.p2PreviewCtx.strokeRect(4, 4, w2 - 8, h2 - 8);
      this.p2PreviewCtx.restore();

      // Render P2 Fighter
      if (this.p2PreviewFighter) {
        this.p2PreviewFighter.draw(this.p2PreviewCtx, false);
      }
      return;
    }

    // Clear canvas frame
    this.ctx.fillStyle = '#060211';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // 1. Draw Parallax Skyline background in screen space (automatically shifts with camera inside)
    this.drawArcadeStage('sky');
    
    // 2. Transform context for all camera-space rendering (grid, fighters, particles)
    this.ctx.save();
    
    // Generate screen shake offsets
    let shakeX = 0;
    let shakeY = 0;
    if (this.shakeAmount > 0) {
      shakeX = (Math.random() - 0.5) * this.shakeAmount;
      shakeY = (Math.random() - 0.5) * this.shakeAmount;
    }
    
    // Apply camera midpoint pan, dynamic zoom, and vibration translations
    const w = this.canvas.width;
    const h = this.canvas.height;
    this.ctx.translate(w / 2 + shakeX, h / 2 + shakeY);
    this.ctx.scale(this.camera.zoom, this.camera.zoom);
    this.ctx.translate(-this.camera.x, -this.camera.y);
    
    // 3. Draw Perspective Floor grid in camera space
    this.drawArcadeStage('ground');
    
    // 4. Draw Particles in camera space
    particles.draw(this.ctx);
    
    // 5. Draw drop shadows first so fighters stand on top of them
    if (this.player1) this.player1.drawFloorShadow(this.ctx);
    if (this.player2) this.player2.drawFloorShadow(this.ctx);

    // 6. Draw Volumetric Fighters
    if (this.player1) this.player1.draw(this.ctx, this.showHitboxes);
    if (this.player2) this.player2.draw(this.ctx, this.showHitboxes);
    
    // Restore main context scale
    this.ctx.restore();
    
    // 7. Full screen impact contrast flash overlay (in screen space)
    if (this.hitFlashTimer > 0) {
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
      this.ctx.fillRect(0, 0, w, h);
    }
  }

  // Render a futuristic glowing grid and synth-wave skyline stage
  drawArcadeStage(layer = 'all') {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const groundY = 560;
    
    if (layer === 'all' || layer === 'sky') {
      // Apply parallax translation for distant elements
      this.ctx.save();
      
      const parallaxX = (this.camera.x - 640) * -0.15;
      const parallaxY = (this.camera.y - 360) * -0.05;
      const skyZoom = 1.0 + (this.camera.zoom - 1.0) * 0.25;
      
      this.ctx.translate(w / 2, h / 2);
      this.ctx.scale(skyZoom, skyZoom);
      this.ctx.translate(-w / 2 + parallaxX, -h / 2 + parallaxY);
      
      // Draw Twinkling Stars in dark sky
      if (this.stars) {
        this.stars.forEach(s => {
          s.phase += s.speed;
          const alpha = 0.25 + Math.abs(Math.sin(s.phase)) * 0.7;
          this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
          this.ctx.beginPath();
          this.ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
          this.ctx.fill();
        });
      }

      // 1. Synth-wave Giant Neon Horizon Sun
      const sunX = w / 2;
      const sunY = 320;
      const sunRadius = 90;
      
      const grad = this.ctx.createLinearGradient(sunX, sunY - sunRadius, sunX, sunY + sunRadius);
      grad.addColorStop(0, '#ff0077');
      grad.addColorStop(0.5, '#ff5500');
      grad.addColorStop(1, '#ffd700');
      
      this.ctx.save();
      this.ctx.shadowBlur = 40;
      this.ctx.shadowColor = '#ff0077';
      this.ctx.fillStyle = grad;
      this.ctx.beginPath();
      this.ctx.arc(sunX, sunY, sunRadius, 0, Math.PI, true); // half circle above ground
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.restore();
      
      // Horizontal sun lines grid cutouts
      this.ctx.fillStyle = '#060211';
      for (let sy = sunY - sunRadius + 25; sy < sunY; sy += 14) {
        const lineH = Math.max(1, (sy - (sunY - sunRadius)) * 0.06);
        this.ctx.fillRect(sunX - sunRadius - 10, sy, sunRadius * 2 + 20, lineH);
      }

      // 2. Parallax Cyberpunk Outlines (Distant Mountains/Neon Skyscrapers)
      this.ctx.strokeStyle = 'rgba(147, 51, 234, 0.25)';
      this.ctx.lineWidth = 2;
      this.ctx.shadowBlur = 5;
      this.ctx.shadowColor = '#9333ea';
      
      // Draw neon wireframe mountains
      this.ctx.beginPath();
      this.ctx.moveTo(0, groundY);
      this.ctx.lineTo(150, groundY - 140);
      this.ctx.lineTo(280, groundY - 70);
      this.ctx.lineTo(440, groundY - 180);
      this.ctx.lineTo(550, groundY - 100);
      this.ctx.lineTo(w / 2 - 140, groundY - 90);
      this.ctx.lineTo(w / 2, groundY - 20); // dips at sun
      this.ctx.lineTo(w / 2 + 140, groundY - 90);
      this.ctx.lineTo(w - 440, groundY - 180);
      this.ctx.lineTo(w - 280, groundY - 70);
      this.ctx.lineTo(w - 150, groundY - 140);
      this.ctx.lineTo(w, groundY);
      this.ctx.stroke();

      // Distant Neon Wireframe Skyscrapers
      this.ctx.save();
      this.ctx.strokeStyle = 'rgba(236, 72, 153, 0.22)';
      this.ctx.lineWidth = 1.5;
      this.ctx.shadowBlur = 6;
      this.ctx.shadowColor = '#ec4899';
      
      const buildings = [
        { x: 50, w: 60, h: 220 },
        { x: 180, w: 45, h: 280 },
        { x: 260, w: 80, h: 180 },
        { x: 380, w: 50, h: 250 },
        { x: w - 110, w: 60, h: 220 },
        { x: w - 225, w: 45, h: 280 },
        { x: w - 340, w: 80, h: 180 },
        { x: w - 430, w: 50, h: 250 }
      ];
      
      const pulseScale = 1 + Math.sin(Date.now() / 400) * 0.04;
      
      buildings.forEach(b => {
        // Draw skyscraper wireframe
        this.ctx.beginPath();
        this.ctx.rect(b.x, groundY - b.h * pulseScale, b.w, b.h * pulseScale);
        this.ctx.stroke();
        
        // Draw cute neon grid window lines
        this.ctx.strokeStyle = 'rgba(0, 243, 255, 0.15)';
        this.ctx.save();
        this.ctx.shadowColor = '#00f3ff';
        this.ctx.shadowBlur = 4;
        for (let wy = groundY - b.h * pulseScale + 20; wy < groundY - 20; wy += 25) {
          for (let wx = b.x + 8; wx < b.x + b.w - 5; wx += 15) {
            // Draw small glowing square windows
            this.ctx.strokeRect(wx, wy, 4, 4);
          }
        }
        this.ctx.restore();
        this.ctx.strokeStyle = 'rgba(236, 72, 153, 0.22)';
      });
      this.ctx.restore();

      // Draw Flying Neon Cruisers in Skyline
      if (this.vehicles) {
        this.vehicles.forEach(v => {
          this.ctx.save();
          this.ctx.shadowBlur = 10;
          this.ctx.shadowColor = v.color;
          this.ctx.fillStyle = v.color;
          this.ctx.fillRect(v.x, v.y, v.width, 5);
          
          // Headlights & taillights
          this.ctx.fillStyle = '#ffffff';
          if (v.speed > 0) {
            this.ctx.fillRect(v.x + v.width - 2, v.y + 1, 3, 3);
            this.ctx.fillStyle = '#ff0055';
            this.ctx.fillRect(v.x - 1, v.y + 1, 2, 3);
          } else {
            this.ctx.fillRect(v.x - 1, v.y + 1, 3, 3);
            this.ctx.fillStyle = '#ff0055';
            this.ctx.fillRect(v.x + v.width - 2, v.y + 1, 2, 3);
          }
          this.ctx.restore();
        });
      }
      this.ctx.restore();
    }
    
    if (layer === 'all' || layer === 'ground') {
      // 3. Arena floor ground fill
      this.ctx.fillStyle = '#0d0724';
      this.ctx.fillRect(-w * 2, groundY, w * 5, 1200);
      
      // Horizon glowing boundary line
      this.ctx.save();
      this.ctx.shadowBlur = 15;
      this.ctx.shadowColor = '#9333ea';
      this.ctx.strokeStyle = '#9333ea';
      this.ctx.lineWidth = 4;
      this.ctx.beginPath();
      this.ctx.moveTo(-w * 2, groundY);
      this.ctx.lineTo(w * 3, groundY);
      this.ctx.stroke();
      this.ctx.restore();

      // 4. Moving Synth-Wave 3D Perspective Grid
      this.ctx.save();
      this.ctx.strokeStyle = 'rgba(147, 51, 234, 0.4)';
      this.ctx.lineWidth = 1.5;
      this.ctx.shadowColor = '#9333ea';
      this.ctx.shadowBlur = 2;
      
      // Horizontal perspective lines (compressing toward horizon)
      const perspectiveCount = 14;
      const startDrawX = -w * 2;
      const endDrawX = w * 3;
      for (let i = 0; i <= perspectiveCount; i++) {
        const progress = i / perspectiveCount;
        const py = groundY + Math.pow(progress, 2.2) * 540;
        
        this.ctx.beginPath();
        this.ctx.moveTo(startDrawX, py);
        this.ctx.lineTo(endDrawX, py);
        this.ctx.stroke();
      }
      
      // Vertical perspective lines radiating from center horizon
      const verticalLines = 48;
      for (let i = 0; i <= verticalLines; i++) {
        const angleProgress = i / verticalLines;
        const startX = w / 2 + (angleProgress - 0.5) * 150; // convergence focus point width
        const endX = w / 2 + (angleProgress - 0.5) * w * 6.5; // wider at bottom
        
        this.ctx.beginPath();
        this.ctx.moveTo(startX, groundY);
        this.ctx.lineTo(endX, groundY + 800);
        this.ctx.stroke();
      }
      
      this.ctx.restore();
    }
  }

  // Trigger camera vibration
  triggerScreenShake(amt, dur) {
    this.shakeAmount = amt;
    this.shakeDuration = dur;
  }

  // --- INTERACTIVE HUD SYNCS ---

  updateHUDValues() {
    if (!this.player1 || !this.player2) return;
    
    // 1. Health Fill Updates
    const p1HpFill = document.getElementById('p1-health-bar');
    const p2HpFill = document.getElementById('p2-health-bar');
    const p1HpPercent = (this.player1.health / this.player1.maxHealth) * 100;
    const p2HpPercent = (this.player2.health / this.player2.maxHealth) * 100;
    
    p1HpFill.style.width = `${p1HpPercent}%`;
    p2HpFill.style.width = `${p2HpPercent}%`;
    
    // Slow lagging red/white bars depletion for impact visuals
    const p1Lag = document.getElementById('p1-health-lag');
    const p2Lag = document.getElementById('p2-health-lag');
    
    p1Lag.style.width = `${p1HpPercent}%`;
    p2Lag.style.width = `${p2HpPercent}%`;

    // 2. EX Energy Bar Updates
    const p1EnFill = document.getElementById('p1-energy-bar');
    const p2EnFill = document.getElementById('p2-energy-bar');
    
    p1EnFill.style.width = `${(this.player1.energy / this.player1.maxEnergy) * 100}%`;
    p2EnFill.style.width = `${(this.player2.energy / this.player2.maxEnergy) * 100}%`;

    // 3. Combos Overlay Updates
    const p1ComboUI = document.getElementById('p1-combo-ui');
    const p1ComboCount = document.getElementById('p1-combo-count');
    if (this.player1.comboCounter >= 2) {
      p1ComboUI.style.display = 'flex';
      p1ComboCount.innerText = this.player1.comboCounter;
    } else {
      p1ComboUI.style.display = 'none';
    }

    const p2ComboUI = document.getElementById('p2-combo-ui');
    const p2ComboCount = document.getElementById('p2-combo-count');
    if (this.player2.comboCounter >= 2) {
      p2ComboUI.style.display = 'flex';
      p2ComboCount.innerText = this.player2.comboCounter;
    } else {
      p2ComboUI.style.display = 'none';
    }
  }

  updateRoundIndicators() {
    // Player 1 wins lights
    document.getElementById('p1-win-1').classList.toggle('active', this.p1RoundWins >= 1);
    document.getElementById('p1-win-2').classList.toggle('active', this.p1RoundWins >= 2);
    
    // Player 2 wins lights
    document.getElementById('p2-win-1').classList.toggle('active', this.p2RoundWins >= 1);
    document.getElementById('p2-win-2').classList.toggle('active', this.p2RoundWins >= 2);
  }

  resetRoundIndicators() {
    document.getElementById('p1-win-1').classList.remove('active');
    document.getElementById('p1-win-2').classList.remove('active');
    document.getElementById('p2-win-1').classList.remove('active');
    document.getElementById('p2-win-2').classList.remove('active');
    document.getElementById('hud-timer').innerText = 99;
  }

  // --- PAUSE & REMATCH ROUTINES ---

  togglePause() {
    if (this.gameState !== 'FIGHTING' && this.gameState !== 'PAUSED') return;
    
    if (this.gameState === 'FIGHTING') {
      this.gameState = 'PAUSED';
      document.getElementById('pause-overlay').style.display = 'flex';
    } else {
      this.gameState = 'FIGHTING';
      document.getElementById('pause-overlay').style.display = 'none';
    }
    audio.playLaser();
  }

  quitToMenu() {
    audio.playLaser();
    audio.stopBGM();
    
    if (this.roundTimerInterval) clearInterval(this.roundTimerInterval);
    
    this.gameState = 'MENU';
    document.getElementById('pause-overlay').style.display = 'none';
    document.getElementById('arena-alert').style.display = 'none';
    
    this.switchScreen('menu-screen');
  }

  rematchGame() {
    audio.playVictoryChime();
    
    // Start background arpeggios BGM
    audio.startBGM();
    
    this.p1RoundWins = 0;
    this.p2RoundWins = 0;
    this.roundNumber = 1;
    
    this.resetRoundIndicators();
    this.switchScreen('game-screen');
    
    this.gameState = 'FIGHTING';
    this.startRound();
  }
}

// Initialise the Master Game Instance when document has loaded fully
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', () => {
    window.game = new GameController();
  });
} else {
  window.game = new GameController();
}
