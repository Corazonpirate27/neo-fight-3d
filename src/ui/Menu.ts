import { GameState, State, FighterType } from '../core/GameState';
import type { Difficulty } from '../core/GameState';
import { InputManager } from '../input/InputManager';
import { audio } from '../audio/AudioManager';

export class Menu {
  private state: GameState;
  
  // Cache Screen overlays
  private loadingScreen: HTMLElement | null = null;
  private mainMenu: HTMLElement | null = null;
  private charSelect: HTMLElement | null = null;
  private pauseMenu: HTMLElement | null = null;
  private optionsMenu: HTMLElement | null = null;
  private controlsMenu: HTMLElement | null = null;
  private gameOverScreen: HTMLElement | null = null;
  private mobileControls: HTMLElement | null = null;
  
  // Game Over text elements
  private winnerBanner: HTMLElement | null = null;
  private koType: HTMLElement | null = null;

  // Rematch callback wired to Game
  private onRematchCallback: (() => void) | null = null;

  constructor(state: GameState) {
    this.state = state;
    this.cacheElements();
    this.bindButtons();
    this.bindSettings();
    this.bindCharacterSelect();
    this.bindDifficultySelect();
    this.setupMobileControls();
    
    // Listen for state transitions to update visibilities
    window.addEventListener('gamestatechange', (e: any) => {
      this.handleStateChange(e.detail.state);
    });

    // Check if we are on a touch device and show mobile controls if so
    this.detectTouchDevice();
  }

  private cacheElements(): void {
    this.loadingScreen = document.getElementById('loading-screen');
    this.mainMenu = document.getElementById('main-menu');
    this.charSelect = document.getElementById('char-select');
    this.pauseMenu = document.getElementById('pause-menu');
    this.optionsMenu = document.getElementById('options-menu');
    this.controlsMenu = document.getElementById('controls-menu');
    this.gameOverScreen = document.getElementById('game-over');
    this.mobileControls = document.getElementById('mobile-controls');
    
    this.winnerBanner = document.getElementById('winner-banner');
    this.koType = document.getElementById('ko-type');
  }

  private bindButtons(): void {
    // 1. MAIN MENU
    document.getElementById('btn-pvc')?.addEventListener('click', () => {
      audio.playLaser();
      this.state.gameMode = 'PVC';
      this.state.changeState(State.CHARACTER_SELECT);
    });

    document.getElementById('btn-pvp')?.addEventListener('click', () => {
      audio.playLaser();
      this.state.gameMode = 'PVP';
      this.state.changeState(State.CHARACTER_SELECT);
    });

    document.getElementById('btn-controls')?.addEventListener('click', () => {
      audio.playLaser();
      this.showOverlay(this.controlsMenu, true);
    });

    document.getElementById('btn-options')?.addEventListener('click', () => {
      audio.playLaser();
      this.showOverlay(this.optionsMenu, true);
    });

    // 2. PAUSE MENU
    document.getElementById('btn-resume')?.addEventListener('click', () => {
      audio.playLaser();
      this.state.changeState(State.FIGHT);
    });

    document.getElementById('btn-pause-options')?.addEventListener('click', () => {
      audio.playLaser();
      this.showOverlay(this.optionsMenu, true);
    });

    document.getElementById('btn-quit')?.addEventListener('click', () => {
      audio.playLaser();
      audio.stopBGM();
      this.state.resetMatch();
      this.state.changeState(State.MENU);
    });

    // 3. GAME OVER
    document.getElementById('btn-rematch')?.addEventListener('click', () => {
      audio.playLaser();
      if (this.onRematchCallback) {
        this.onRematchCallback();
      }
    });

    document.getElementById('btn-gameover-quit')?.addEventListener('click', () => {
      audio.playLaser();
      audio.stopBGM();
      this.state.resetMatch();
      this.state.changeState(State.MENU);
    });

    // 4. CLOSING OVERLAYS
    document.getElementById('btn-options-close')?.addEventListener('click', () => {
      audio.playLaser();
      this.showOverlay(this.optionsMenu, false);
      this.state.saveSettings();
    });

    document.getElementById('btn-controls-close')?.addEventListener('click', () => {
      audio.playLaser();
      this.showOverlay(this.controlsMenu, false);
    });
  }

  private bindSettings(): void {
    // Checkboxes
    const reducedMotionCheck = document.getElementById('opt-reduced-motion') as HTMLInputElement;
    const screenShakeCheck = document.getElementById('opt-screen-shake') as HTMLInputElement;
    const shadersCheck = document.getElementById('opt-shaders') as HTMLInputElement;
    const volumeSlider = document.getElementById('opt-volume') as HTMLInputElement;

    // Set initial values
    if (reducedMotionCheck) reducedMotionCheck.checked = this.state.settings.reducedMotion;
    if (screenShakeCheck) screenShakeCheck.checked = this.state.settings.screenShake;
    if (shadersCheck) shadersCheck.checked = this.state.settings.postProcessing;
    if (volumeSlider) volumeSlider.value = (this.state.settings.volume * 100).toString();

    // Event listeners
    reducedMotionCheck?.addEventListener('change', (e: any) => {
      this.state.settings.reducedMotion = e.target.checked;
    });

    screenShakeCheck?.addEventListener('change', (e: any) => {
      this.state.settings.screenShake = e.target.checked;
    });

    shadersCheck?.addEventListener('change', (e: any) => {
      this.state.settings.postProcessing = e.target.checked;
    });

    volumeSlider?.addEventListener('input', (e: any) => {
      const vol = parseFloat(e.target.value) / 100;
      this.state.settings.volume = vol;
      audio.setVolume(vol);
    });
  }

  private bindCharacterSelect(): void {
    const cards = document.querySelectorAll('.char-card');
    cards.forEach(card => {
      card.addEventListener('click', () => {
        audio.playLaser();
        // Remove active from all cards
        cards.forEach(c => c.classList.remove('active'));
        
        // Add to clicked
        card.classList.add('active');
        
        const selected = card.getAttribute('data-char') as FighterType;
        this.state.p1SelectedChar = selected;
        
        // PVC automatic setup of AI opponent
        if (this.state.gameMode === 'PVC') {
          this.state.p2SelectedChar = selected === 'vanguard' ? 'aegis' : 'vanguard';
        }
      });
    });

    document.getElementById('btn-select-back')?.addEventListener('click', () => {
      audio.playLaser();
      this.state.changeState(State.MENU);
    });

    document.getElementById('btn-select-confirm')?.addEventListener('click', () => {
      audio.playLaser();
      audio.init(); // Initialize audio context on first interactive click
      this.state.changeState(State.FIGHT);
    });
  }

  private bindDifficultySelect(): void {
    const buttons = document.querySelectorAll('.difficulty-btn');

    const syncButtons = (): void => {
      buttons.forEach(button => {
        const difficulty = button.getAttribute('data-difficulty');
        button.classList.toggle('active', difficulty === this.state.difficulty);
      });
    };

    buttons.forEach(button => {
      button.addEventListener('click', () => {
        const difficulty = button.getAttribute('data-difficulty') as Difficulty | null;
        if (!difficulty) return;

        audio.playLaser();
        this.state.difficulty = difficulty;
        syncButtons();
      });
    });

    syncButtons();
  }

  private handleStateChange(newState: State): void {
    // Hide all overlay screens
    this.showOverlay(this.loadingScreen, false);
    this.showOverlay(this.mainMenu, false);
    this.showOverlay(this.charSelect, false);
    this.showOverlay(this.pauseMenu, false);
    this.showOverlay(this.gameOverScreen, false);

    switch (newState) {
      case State.LOADING:
        this.showOverlay(this.loadingScreen, true);
        break;
      case State.MENU:
        this.showOverlay(this.mainMenu, true);
        break;
      case State.CHARACTER_SELECT:
        this.showOverlay(this.charSelect, true);
        this.updateDifficultyVisibility();
        break;
      case State.PAUSE:
        this.showOverlay(this.pauseMenu, true);
        break;
      case State.GAME_OVER:
        this.showOverlay(this.gameOverScreen, true);
        this.updateGameOverScreen();
        break;
      case State.FIGHT:
        // No overlays in fight state, except mobile touch HUD if active
        break;
    }
  }

  private updateDifficultyVisibility(): void {
    const difficultyPanel = document.getElementById('difficulty-select');
    if (!difficultyPanel) return;

    difficultyPanel.style.display = this.state.gameMode === 'PVC' ? 'block' : 'none';
  }

  private showOverlay(element: HTMLElement | null, show: boolean): void {
    if (!element) return;
    if (show) {
      element.classList.add('active');
    } else {
      element.classList.remove('active');
    }
  }

  public updateLoadingProgress(progress: number, message: string): void {
    const bar = document.getElementById('progress-bar');
    const status = document.getElementById('loading-status');
    if (bar) bar.style.width = `${progress * 100}%`;
    if (status) status.innerText = message.toUpperCase();
  }

  public setOnRematch(callback: () => void): void {
    this.onRematchCallback = callback;
  }

  private updateGameOverScreen(): void {
    if (!this.winnerBanner || !this.koType) return;

    let winnerName = 'VANGUARD-01';
    let subBanner = 'DECISIVE VICTORY';

    const p1CharName = this.state.p1SelectedChar === 'vanguard' ? 'VANGUARD-01' : 'AEGIS-X';
    const p2CharName = this.state.p2SelectedChar === 'vanguard' ? 'VANGUARD-01' : 'AEGIS-X';

    if (this.state.p1Wins >= 2) {
      winnerName = `${p1CharName} WINS!`;
      this.winnerBanner.className = 'logo glow-cyan animate-pulse';
    } else {
      winnerName = `${p2CharName} WINS!`;
      this.winnerBanner.className = 'logo glow-red animate-pulse';
    }

    if (this.state.roundTimer <= 0) {
      subBanner = 'TIMEOUT VICTORY';
    } else {
      subBanner = 'DECISIVE KNOCKOUT';
    }

    this.winnerBanner.innerText = winnerName;
    this.koType.innerText = subBanner;
  }

  private detectTouchDevice(): void {
    const isTouch = ('ontouchstart' in window || navigator.maxTouchPoints > 0);
    if (isTouch && this.mobileControls) {
      this.mobileControls.style.display = 'flex';
    }
  }

  // --- MOBILE TOUCH JOYSTICK & BUTTON BINDINGS ---
  private setupMobileControls(): void {
    // 1. Action Buttons
    const buttons = [
      { id: 'mb-btn-block', action: 'block' },
      { id: 'mb-btn-jump', action: 'jump' },
      { id: 'mb-btn-light', action: 'light' },
      { id: 'mb-btn-heavy', action: 'heavy' },
      { id: 'mb-btn-kick', action: 'kick' },
      { id: 'mb-btn-spec', action: 'special' }
    ];

    buttons.forEach(btnInfo => {
      const btn = document.getElementById(btnInfo.id);
      if (btn) {
        btn.addEventListener('touchstart', (e) => {
          e.preventDefault();
          InputManager.setTouchInput(btnInfo.action as any, true, 1);
        }, { passive: false });

        btn.addEventListener('touchend', (e) => {
          e.preventDefault();
          InputManager.setTouchInput(btnInfo.action as any, false, 1);
        }, { passive: false });
      }
    });

    // 2. Virtual Joystick
    const joystick = document.getElementById('mobile-joystick');
    const handle = document.getElementById('mobile-joystick-handle');
    if (!joystick || !handle) return;

    let joystickActive = false;
    let startX = 0;
    const maxRadius = 40; // max handle stretch boundary in pixels

    joystick.addEventListener('touchstart', (e: TouchEvent) => {
      e.preventDefault();
      joystickActive = true;
      startX = e.touches[0].clientX;
    }, { passive: false });

    joystick.addEventListener('touchmove', (e: TouchEvent) => {
      if (!joystickActive) return;
      e.preventDefault();

      const clientX = e.touches[0].clientX;
      let deltaX = clientX - startX;

      // Bound handle movement
      deltaX = Math.max(-maxRadius, Math.min(maxRadius, deltaX));
      handle.style.transform = `translate(${deltaX}px, 0px)`;

      // Set input states based on threshold
      const threshold = 15;
      if (deltaX > threshold) {
        InputManager.setTouchInput('right', true, 1);
        InputManager.setTouchInput('left', false, 1);
      } else if (deltaX < -threshold) {
        InputManager.setTouchInput('left', true, 1);
        InputManager.setTouchInput('right', false, 1);
      } else {
        InputManager.setTouchInput('left', false, 1);
        InputManager.setTouchInput('right', false, 1);
      }
    }, { passive: false });

    joystick.addEventListener('touchend', (e: TouchEvent) => {
      joystickActive = false;
      e.preventDefault();
      handle.style.transform = `translate(0px, 0px)`;
      
      InputManager.setTouchInput('left', false, 1);
      InputManager.setTouchInput('right', false, 1);
    }, { passive: false });
  }
}
