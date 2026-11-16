# NEO-FIGHT: Street Fighter Edition

NEO-FIGHT is a modern, high-performance **1v1 Fighting Game** built in the classic **Street Fighter** style: 2D-plane footsies, motion-input special moves, hold-back blocking, sweeps, super meter, and best-of-3 rounds on a 99-second timer. It is custom-built with **Three.js**, **TypeScript**, and **Vite**.

The fighter features procedural low-poly 3D models rendered with an SF2-style tracking camera, frame-based command-input parsing, spatial hitbox/hurtbox collisions, reactive tactical CPU AI that throws fireballs and anti-air uppercuts, and zero-latency audio procedurally synthesized in real time.

---

## 🕹️ Control Protocols

### Player 1 (Left Side)
* **Walk Left / Right**: <kbd>A</kbd> / <kbd>D</kbd> *(walking back pre-guards, Street Fighter style)*
* **Jump**: <kbd>W</kbd> *(or <kbd>Space</kbd>)* — attack in the air for jump-ins
* **Crouch**: Hold <kbd>S</kbd>
* **Block**: Hold **BACK** (away from opponent) when an attack connects *(or hold <kbd>R</kbd>)*
* **Dash**: Double-Tap <kbd>A</kbd> / <kbd>D</kbd> *(Costs 20% meter)*
* **Light Punch**: <kbd>F</kbd> — **Heavy Punch**: <kbd>G</kbd> — **Kick**: <kbd>H</kbd>
* **Crouching Sweep (Knockdown)**: Hold <kbd>S</kbd> + <kbd>H</kbd>
* **EX / SUPER button**: <kbd>T</kbd>

### Player 2 / CPU Opponent (Right Side)
* **Walk**: <kbd>◄</kbd> / <kbd>►</kbd> — **Jump**: <kbd>▲</kbd> — **Crouch**: <kbd>▼</kbd>
* **Block**: Hold **BACK** *(or <kbd>U</kbd>)*
* **Dash**: Double-Tap <kbd>◄</kbd> / <kbd>►</kbd>
* **Light Punch**: <kbd>J</kbd> — **Heavy Punch**: <kbd>K</kbd> — **Kick**: <kbd>L</kbd>
* **EX / SUPER button**: <kbd>I</kbd>

### 🔥 Command Moves (both players — motions read relative to facing)
* **HADOUKEN (Fireball)**: ↓ ↘ → + Punch — free projectile, great for zoning
* **SHORYUKEN (Rising Dragon Punch)**: → ↓ ↘ + Punch — invincible startup, launches on hit; the definitive anti-air
* **HURRICANE KICK**: ↓ ↙ ← + Kick — floaty forward-traveling spin kick
* **SUPER COMBO**: <kbd>T</kbd> / <kbd>I</kbd> with a **FULL meter** — massive golden fireball (55 damage)
* **EX Projectile**: <kbd>T</kbd> / <kbd>I</kbd> with ≥30% meter — the classic heavy EX blast

Meter builds by attacking (even whiffs), landing hits, taking damage, and blocking. Win a round without taking damage for the **PERFECT!** callout.

---

## 📱 Mobile & Gamepad Support

### 1. Gamepad Compatibility
The game natively integrates HTML5 Gamepad tracking. Plug in standard Xbox or PlayStation controllers:
- **Left Analog Stick**: Linear 3D Movement / Sidestepping / Crouching
- **Button South (A / Cross)**: Jump
- **Button West (X / Square)**: Light Attack
- **Button North (Y / Triangle)**: Heavy Attack
- **Button East (B / Circle)**: Kick Sweep
- **Left/Right Shoulder Bumpers**: Guarding
- **Right Trigger (RT / R2)**: Special EX attack

### 2. Mobile Touch Overlay
On mobile screen devices, a glassmorphic tactile layout overlays the screen:
- **Virtual Touch Joystick (Left Side)**: Control 3D spatial alignment, crouch, and walk.
- **Dedicated Tactile Buttons (Right Side)**: `LIGHT`, `HEAVY`, `KICK`, `BLOCK`, `JUMP`, and `SPEC` (EX Special).

---

## 🛠️ System Architecture

NEO-FIGHT 3D is designed under a decoupled, modular system hierarchy:

```
├── package.json                   # Project setup & dev tools
├── tsconfig.json                  # Strict TypeScript compiler options
├── vite.config.ts                 # High-speed Vite bundler settings
├── index.html                     # HTML structure & Overlay layouts
├── src/
│   ├── main.ts                    # Application bootstrapper
│   ├── core/
│   │   ├── Game.ts                # Main Three.js loop, render tick, scene nodes
│   │   ├── GameState.ts           # State machine (Menu, Select, Fight, Pause, KO)
│   │   └── AssetLoader.ts         # Procedural shader materials & mesh generators
│   ├── input/
│   │   ├── InputManager.ts        # Keyboard registers, double-taps, touch joystick
│   │   └── GamepadManager.ts      # HTML5 analog controller mapping
│   ├── entities/
│   │   ├── Fighter.ts             # 3D Skeletal assembly, movements, animations
│   │   └── Arena.ts               # Urban metal dome arena, spotlights
│   ├── combat/
│   │   ├── Hitbox.ts              # Hurtboxes, Hitboxes, and Pushbox spheres
│   │   ├── CombatSystem.ts        # Dynamic intersections, projectiles, damage
│   │   └── ComboSystem.ts         # Combo strings tracking & metrics
│   ├── ai/
│   │   └── FighterAI.ts           # Decision tree AI (Dashes, spacing, reactive guards)
│   ├── render/
│   │   ├── CameraController.ts    # LERP midpoint focal zoom tracking, screen shake
│   │   └── Effects.ts             # Ground-bouncing gravity spark pools, dust
│   ├── ui/
│   │   ├── HUD.ts                 # Cyberpunk HUD lifebars, EX meters, round dings
│   │   └── Menu.ts                # Glassmorphic UI menus, selection grid, bindings
│   ├── audio/
│   │   └── AudioManager.ts        # Real-time Web Audio synths, sequencer
│   └── styles.css                 # Retro CRT scanlines, phosphorus glowing visual tags
```

---

## ⚡ Key Engineering Features

1. **Custom 3D Kinematics**: Implements custom coordinate-based kinematics rather than bulky rigid-body simulation engines. This prevents clipping, ensures perfect 60 FPS combat precision, and handles frame-perfect blockstun and juggling.
2. **Dynamic 3D Camera Controller**: Synthesizes a focal perspective camera that automatically positions itself at the midpoint between the two combatants, zooming in during close-quarters exchanges and snapping outwards when a player is wall-bounced.
3. **Procedural Web Audio Engine**: Synthesizes sub-bass sweeps ($55\text{Hz} \to 20\text{Hz}$), white-noise impact clicks, and arpeggiated cyberpunk background music entirely on the fly via the Web Audio API (saving megabytes of asset sizes and delivering zero latency).
4. **Retro CRT Visual Shader Overlay**: Embeds Phosphor scanlines and CRT bezel reflections directly inside the browser viewport, maintaining a cohesive futuristic cyber brawler aesthetic.
5. **Smart AI Decider**: Fighter AI monitors opponents' distance, dynamically closing gaps with dashes, executing spaced kicks, and reactively raising guards if an attack is launched within high-danger zones.

---

## 🚀 Execution & Verification

### 1. Installation
Install project dependencies:
```bash
npm install
```

### 2. Development Dev Server
Launch Vite's hot-reloading dev environment locally:
```bash
npm run dev
```

### 3. Production Build Compilation
Compile strict TypeScript files and build highly optimized static production chunks:
```bash
npm run build
```

Verify build output by previewing local server:
```bash
npm run preview
```
