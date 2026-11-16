export type Action = 'left' | 'right' | 'up' | 'down' | 'jump' | 'light' | 'heavy' | 'kick' | 'block' | 'special';

// Street Fighter style command motions (numpad notation, relative to facing)
export type Motion = 'qcf' | 'qcb' | 'dp';

const MOTION_PATTERNS: Record<Motion, number[][]> = {
  qcf: [[2, 3, 6], [2, 6], [3, 6]],  // ↓ ↘ →  (Hadouken; accepts rolled shortcuts)
  qcb: [[2, 1, 4], [2, 4], [1, 4]],  // ↓ ↙ ←  (Hurricane Kick)
  dp:  [[6, 2, 3], [6, 2, 6], [3, 2, 3]] // → ↓ ↘  (Shoryuken)
};

// Motion window counted in game ticks (frame-based, like real fighting games)
const MOTION_WINDOW_TICKS = 42;

export interface PlayerControls {
  left: string[];
  right: string[];
  up: string[];
  down: string[];
  jump: string[];
  light: string[];
  heavy: string[];
  kick: string[];
  block: string[];
  special: string[];
}

export class InputManager {
  private static pressedKeys: Set<string> = new Set();
  
  // Double-tap dash timers
  private static lastTapTime: Map<string, number> = new Map();
  private static doubleTapActive: Map<number, 'left' | 'right' | null> = new Map([
    [1, null],
    [2, null]
  ]);
  
  // Custom virtual touch inputs (for mobile overlay)
  private static touchInputs: Map<string, boolean> = new Map();

  // Edge-detection registers: cleared at the end of every game tick
  private static justPressedKeys: Set<string> = new Set();
  private static touchJustPressed: Set<string> = new Set();

  // Directional motion buffers for command inputs (per player)
  private static motionBuffers: Map<1 | 2, Array<{ dir: number; tick: number }>> = new Map([
    [1, []],
    [2, []]
  ]);
  private static motionTicks: Map<1 | 2, number> = new Map([
    [1, 0],
    [2, 0]
  ]);
  // Motions injected directly (used by the CPU AI which has perfect execution)
  private static injectedMotions: Map<1 | 2, Set<Motion>> = new Map([
    [1, new Set()],
    [2, new Set()]
  ]);

  // 2026 Remappable layout structure
  public static p1Bindings: PlayerControls = {
    left: ['KeyA'],
    right: ['KeyD'],
    up: ['KeyW'],
    down: ['KeyS'],
    jump: ['Space'],
    light: ['KeyF'],
    heavy: ['KeyG'],
    kick: ['KeyH'],
    block: ['KeyR'],
    special: ['KeyT']
  };

  public static p2Bindings: PlayerControls = {
    left: ['ArrowLeft'],
    right: ['ArrowRight'],
    up: ['ArrowUp'],
    down: ['ArrowDown'],
    jump: ['Numpad0', 'KeyO'], // fallback O if keyboard has no numpad
    light: ['KeyJ'],
    heavy: ['KeyK'],
    kick: ['KeyL'],
    block: ['KeyU'],
    special: ['KeyI']
  };

  public static init(): void {
    window.addEventListener('keydown', (e) => {
      if (!this.pressedKeys.has(e.code)) {
        this.justPressedKeys.add(e.code);
        this.checkDoubleTap(e.code);
      }
      this.pressedKeys.add(e.code);
    });

    window.addEventListener('keyup', (e) => {
      this.pressedKeys.delete(e.code);
    });
    
    // Clear all keys when focus lost to avoid stuck keys
    window.addEventListener('blur', () => {
      this.pressedKeys.clear();
      this.justPressedKeys.clear();
      this.touchJustPressed.clear();
      this.lastTapTime.clear();
      this.doubleTapActive.set(1, null);
      this.doubleTapActive.set(2, null);
      this.motionBuffers.set(1, []);
      this.motionBuffers.set(2, []);
    });
  }

  public static isActionPressed(action: Action, playerNum: 1 | 2): boolean {
    // 1. Mobile touch / AI inputs
    const touchKey = `p${playerNum}_${action}`;
    if (this.touchInputs.get(touchKey)) return true;

    // 2. Keyboard bindings
    const bindings = playerNum === 1 ? this.p1Bindings : this.p2Bindings;
    const keys = bindings[action];
    for (const key of keys) {
      if (this.pressedKeys.has(key)) return true;
    }
    
    return false;
  }

  // Set virtual touch status (invoked by Mobile Touch HUD elements)
  public static setTouchInput(action: Action, isPressed: boolean, playerNum: 1 | 2 = 1): void {
    const touchKey = `p${playerNum}_${action}`;
    if (isPressed && !this.touchInputs.get(touchKey)) {
      this.touchJustPressed.add(touchKey);
    }
    this.touchInputs.set(touchKey, isPressed);
    
    // Handle simulated double taps on mobile via specific parameters if needed
    if (isPressed && (action === 'left' || action === 'right')) {
      const code = `MobileTouch_${playerNum}_${action}`;
      this.checkDoubleTap(code, playerNum);
    }
  }

  // Returns true exactly once per physical button press (SF-style trigger inputs)
  public static consumeActionPress(action: Action, playerNum: 1 | 2): boolean {
    const touchKey = `p${playerNum}_${action}`;
    if (this.touchJustPressed.has(touchKey)) {
      this.touchJustPressed.delete(touchKey);
      return true;
    }

    const bindings = playerNum === 1 ? this.p1Bindings : this.p2Bindings;
    for (const key of bindings[action]) {
      if (this.justPressedKeys.has(key)) {
        this.justPressedKeys.delete(key);
        return true;
      }
    }
    return false;
  }

  // Sample the current stick direction into the motion buffer.
  // Called once per game tick per fighter, with the fighter's facing sign
  // so motions are read relative to "toward opponent" like Street Fighter.
  public static updateMotionBuffer(playerNum: 1 | 2, facingSign: number): void {
    const left = this.isActionPressed('left', playerNum);
    const right = this.isActionPressed('right', playerNum);
    const down = this.isActionPressed('down', playerNum);

    const horiz = (right ? 1 : 0) - (left ? 1 : 0);
    const toward = horiz * (facingSign >= 0 ? 1 : -1);

    let digit = 5;
    if (down) {
      digit = toward > 0 ? 3 : toward < 0 ? 1 : 2;
    } else {
      digit = toward > 0 ? 6 : toward < 0 ? 4 : 5;
    }

    const tick = this.motionTicks.get(playerNum)! + 1;
    this.motionTicks.set(playerNum, tick);

    const buf = this.motionBuffers.get(playerNum)!;
    if (buf.length === 0 || buf[buf.length - 1].dir !== digit) {
      buf.push({ dir: digit, tick });
    }

    // Trim stale entries
    while (buf.length > 0 && tick - buf[0].tick > MOTION_WINDOW_TICKS + 20) buf.shift();
    while (buf.length > 14) buf.shift();
  }

  // Check (and consume) a completed command motion for this player
  public static consumeMotion(playerNum: 1 | 2, motion: Motion): boolean {
    const injected = this.injectedMotions.get(playerNum)!;
    if (injected.has(motion)) {
      injected.delete(motion);
      return true;
    }

    const tick = this.motionTicks.get(playerNum)!;
    const buf = this.motionBuffers.get(playerNum)!;
    const recent = buf.filter(e => tick - e.tick <= MOTION_WINDOW_TICKS).map(e => e.dir);

    for (const pattern of MOTION_PATTERNS[motion]) {
      let idx = 0;
      for (const dir of recent) {
        if (dir === pattern[idx]) idx++;
        if (idx === pattern.length) break;
      }
      if (idx === pattern.length) {
        this.motionBuffers.set(playerNum, []); // consume: prevent double triggers
        return true;
      }
    }
    return false;
  }

  // AI helper: grants a perfectly executed motion for its next button press
  public static injectMotion(playerNum: 1 | 2, motion: Motion): void {
    this.injectedMotions.get(playerNum)!.add(motion);
  }

  // Clear one-frame edge registers; called at the end of every game tick
  public static endFrame(): void {
    this.justPressedKeys.clear();
    this.touchJustPressed.clear();
    this.injectedMotions.get(1)!.clear();
    this.injectedMotions.get(2)!.clear();
  }

  // Dash detection
  public static consumeDash(playerNum: 1 | 2): 'left' | 'right' | null {
    const dash = this.doubleTapActive.get(playerNum) || null;
    if (dash) {
      this.doubleTapActive.set(playerNum, null); // Consume immediately
    }
    return dash;
  }

  private static checkDoubleTap(code: string, forcePlayer?: 1 | 2): void {
    const now = performance.now();
    const threshold = 250; // ms interval for double tap
    
    const lastTap = this.lastTapTime.get(code) || 0;
    const timeDiff = now - lastTap;
    
    if (timeDiff > 40 && timeDiff < threshold) {
      // Registered double tap!
      let player: 1 | 2 = 1;
      let direction: 'left' | 'right' | null = null;
      
      if (forcePlayer) {
        player = forcePlayer;
        direction = code.endsWith('left') ? 'left' : 'right';
      } else {
        // Detect player from keyboard code
        if (this.p1Bindings.left.includes(code)) { player = 1; direction = 'left'; }
        else if (this.p1Bindings.right.includes(code)) { player = 1; direction = 'right'; }
        else if (this.p2Bindings.left.includes(code)) { player = 2; direction = 'left'; }
        else if (this.p2Bindings.right.includes(code)) { player = 2; direction = 'right'; }
      }
      
      if (direction) {
        this.doubleTapActive.set(player, direction);
      }
    }
    
    this.lastTapTime.set(code, now);
  }
}
