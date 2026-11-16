import { InputManager } from './InputManager';

export class GamepadManager {
  private static activeGamepads: Map<number, number> = new Map(); // playerNum -> gamepadIndex
  
  public static init(): void {
    window.addEventListener('gamepadconnected', (e) => {
      const gp = (e as GamepadEvent).gamepad;
      console.log(`[Gamepad] Gamepad connected at index ${gp.index}: ${gp.id}`);
      
      // Assign Gamepad index automatically
      if (!this.activeGamepads.has(1)) {
        this.activeGamepads.set(1, gp.index);
        console.log(`[Gamepad] Assigned Gamepad ${gp.index} to Player 1`);
      } else if (!this.activeGamepads.has(2)) {
        this.activeGamepads.set(2, gp.index);
        console.log(`[Gamepad] Assigned Gamepad ${gp.index} to Player 2`);
      }
    });

    window.addEventListener('gamepaddisconnected', (e) => {
      const gp = (e as GamepadEvent).gamepad;
      console.log(`[Gamepad] Gamepad disconnected: ${gp.id}`);
      
      if (this.activeGamepads.get(1) === gp.index) {
        this.activeGamepads.delete(1);
      } else if (this.activeGamepads.get(2) === gp.index) {
        this.activeGamepads.delete(2);
      }
    });
  }

  public static update(): void {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    
    for (const [playerNum, gpIndex] of this.activeGamepads.entries()) {
      const gp = gamepads[gpIndex];
      if (!gp) continue;
      
      this.pollGamepad(gp, playerNum as 1 | 2);
    }
  }

  private static pollGamepad(gp: Gamepad, playerNum: 1 | 2): void {
    // 1. D-Pad & Analog Sticks (X/Y movement axes)
    const axesThreshold = 0.35;
    const xAxis = gp.axes[0]; // Left analog horizontal
    const yAxis = gp.axes[1]; // Left analog vertical
    
    // Horizontal Movement
    const dpadLeft = gp.buttons[14]?.pressed || xAxis < -axesThreshold;
    const dpadRight = gp.buttons[15]?.pressed || xAxis > axesThreshold;
    InputManager.setTouchInput('left', dpadLeft, playerNum);
    InputManager.setTouchInput('right', dpadRight, playerNum);
    
    // Vertical / Crouch
    const dpadDown = gp.buttons[13]?.pressed || yAxis > axesThreshold;
    InputManager.setTouchInput('down', dpadDown, playerNum);

    // 2. Buttons Mapping (Standard Gamepad protocol)
    // A Button (Index 0) -> Jump
    const btnJump = gp.buttons[0]?.pressed;
    InputManager.setTouchInput('jump', btnJump, playerNum);

    // X Button (Index 2) -> Light Attack
    const btnLight = gp.buttons[2]?.pressed;
    InputManager.setTouchInput('light', btnLight, playerNum);

    // Y Button (Index 3) -> Heavy Attack
    const btnHeavy = gp.buttons[3]?.pressed;
    InputManager.setTouchInput('heavy', btnHeavy, playerNum);

    // B Button (Index 1) -> Kick
    const btnKick = gp.buttons[1]?.pressed;
    InputManager.setTouchInput('kick', btnKick, playerNum);

    // Right Bumper / Trigger (Index 5 / 7) -> Block
    const btnBlock = gp.buttons[5]?.pressed || gp.buttons[7]?.pressed;
    InputManager.setTouchInput('block', btnBlock, playerNum);

    // Left Bumper / Trigger (Index 4 / 6) -> Special
    const btnSpecial = gp.buttons[4]?.pressed || gp.buttons[6]?.pressed;
    InputManager.setTouchInput('special', btnSpecial, playerNum);
  }
}
