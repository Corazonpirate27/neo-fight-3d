// ================= NEO-FIGHT ARCADE CORE INPUT =================
class InputHandler {
  constructor() {
    this.keys = {};
    this.lastPressTime = {};
    this.doubleTaps = {};
    
    // Player 1 Control Key Codes
    this.p1Map = {
      'left': 'KeyA',
      'right': 'KeyD',
      'jump': 'KeyW',
      'crouch': 'KeyS',
      'punchLight': 'KeyJ',
      'punchHeavy': 'KeyK',
      'kick': 'KeyI',
      'special': 'KeyL'
    };

    // Player 2 Control Key Codes (Alternative mapping for laptops/keyboards)
    this.p2Map = {
      'left': 'ArrowLeft',
      'right': 'ArrowRight',
      'jump': 'ArrowUp',
      'crouch': 'ArrowDown',
      'punchLight': 'KeyF',
      'punchHeavy': 'KeyG',
      'kick': 'KeyR',
      'special': 'KeyH'
    };
    
    // List of keys to prevent page scrolling/default browser behavior
    this.preventKeys = [
      'KeyW', 'KeyS', 'KeyA', 'KeyD', 'KeyJ', 'KeyK', 'KeyI', 'KeyL',
      'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab',
      'w', 's', 'a', 'd', 'j', 'k', 'i', 'l', 'f', 'g', 'r', 'h',
      'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'space', 'tab'
    ];

    this.initListeners();
  }

  initListeners() {
    window.addEventListener('keydown', (e) => {
      const code = e.code;
      const keyLower = e.key ? e.key.toLowerCase() : '';
      
      // Prevent browser actions like scrolling for gaming hotkeys
      if (this.preventKeys.includes(code) || this.preventKeys.includes(keyLower)) {
        e.preventDefault();
      }
      
      if (code) {
        if (!this.keys[code]) {
          const now = Date.now();
          if (now - (this.lastPressTime[code] || 0) < 250) {
            this.doubleTaps[code] = true;
          }
          this.lastPressTime[code] = now;
        }
        this.keys[code] = true;
      }
      
      if (keyLower) {
        if (!this.keys[keyLower]) {
          const now = Date.now();
          if (now - (this.lastPressTime[keyLower] || 0) < 250) {
            this.doubleTaps[keyLower] = true;
          }
          this.lastPressTime[keyLower] = now;
        }
        this.keys[keyLower] = true;
      }
    });

    window.addEventListener('keyup', (e) => {
      const code = e.code;
      const keyLower = e.key ? e.key.toLowerCase() : '';
      
      if (this.preventKeys.includes(code) || this.preventKeys.includes(keyLower)) {
        e.preventDefault();
      }
      
      if (code) this.keys[code] = false;
      if (keyLower) this.keys[keyLower] = false;
    });
  }

  // Check if a specific key is pressed
  isPressed(code) {
    if (this.keys[code]) return true;
    
    // Custom robust fallback maps
    let fallbackChar = '';
    if (code === 'KeyA') fallbackChar = 'a';
    else if (code === 'KeyD') fallbackChar = 'd';
    else if (code === 'KeyW') fallbackChar = 'w';
    else if (code === 'KeyS') fallbackChar = 's';
    else if (code === 'KeyJ') fallbackChar = 'j';
    else if (code === 'KeyK') fallbackChar = 'k';
    else if (code === 'KeyI') fallbackChar = 'i';
    else if (code === 'KeyL') fallbackChar = 'l';
    else if (code === 'KeyF') fallbackChar = 'f';
    else if (code === 'KeyG') fallbackChar = 'g';
    else if (code === 'KeyR') fallbackChar = 'r';
    else if (code === 'KeyH') fallbackChar = 'h';
    else if (code === 'ArrowLeft') fallbackChar = 'arrowleft';
    else if (code === 'ArrowRight') fallbackChar = 'arrowright';
    else if (code === 'ArrowUp') fallbackChar = 'arrowup';
    else if (code === 'ArrowDown') fallbackChar = 'arrowdown';
    
    if (fallbackChar && this.keys[fallbackChar]) return true;
    return false;
  }

  consumeDoubleTap(code) {
    if (this.doubleTaps[code]) {
      this.doubleTaps[code] = false;
      return true;
    }
    
    // Custom robust fallback maps
    let fallbackChar = '';
    if (code === 'KeyA') fallbackChar = 'a';
    else if (code === 'KeyD') fallbackChar = 'd';
    else if (code === 'ArrowLeft') fallbackChar = 'arrowleft';
    else if (code === 'ArrowRight') fallbackChar = 'arrowright';
    
    if (fallbackChar && this.doubleTaps[fallbackChar]) {
      this.doubleTaps[fallbackChar] = false;
      return true;
    }
    return false;
  }

  // Get movement states for Player 1
  getP1Controls() {
    return {
      left: this.isPressed(this.p1Map.left),
      right: this.isPressed(this.p1Map.right),
      jump: this.isPressed(this.p1Map.jump),
      crouch: this.isPressed(this.p1Map.crouch),
      punchLight: this.isPressed(this.p1Map.punchLight),
      punchHeavy: this.isPressed(this.p1Map.punchHeavy),
      kick: this.isPressed(this.p1Map.kick),
      special: this.isPressed(this.p1Map.special),
      dashLeft: this.consumeDoubleTap(this.p1Map.left),
      dashRight: this.consumeDoubleTap(this.p1Map.right)
    };
  }

  // Get movement states for Player 2
  getP2Controls() {
    return {
      left: this.isPressed(this.p2Map.left),
      right: this.isPressed(this.p2Map.right),
      jump: this.isPressed(this.p2Map.jump),
      crouch: this.isPressed(this.p2Map.crouch),
      punchLight: this.isPressed(this.p2Map.punchLight),
      punchHeavy: this.isPressed(this.p2Map.punchHeavy),
      kick: this.isPressed(this.p2Map.kick),
      special: this.isPressed(this.p2Map.special),
      dashLeft: this.consumeDoubleTap(this.p2Map.left),
      dashRight: this.consumeDoubleTap(this.p2Map.right)
    };
  }

  // Reset keyboard map state
  clear() {
    this.keys = {};
    this.lastPressTime = {};
    this.doubleTaps = {};
  }
}

// Export a single instance to be used everywhere
export const input = new InputHandler();
