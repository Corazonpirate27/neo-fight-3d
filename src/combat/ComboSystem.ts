import { Action } from '../input/InputManager';

export interface ComboString {
  sequence: Action[];
  damageMultiplier: number;
  bonusEnergy: number;
}

export class ComboSystem {
  private static p1History: { action: Action; time: number }[] = [];
  private static p2History: { action: Action; time: number }[] = [];
  private static comboWindow: number = 750; // Max time difference in ms between combo hits

  private static originalCombos: ComboString[] = [
    {
      sequence: ['light', 'light', 'heavy'], // Light -> Light -> Heavy Overhead
      damageMultiplier: 1.25,
      bonusEnergy: 10
    },
    {
      sequence: ['light', 'kick', 'special'], // Jab -> Sweep -> Shuriken/Fireball
      damageMultiplier: 1.4,
      bonusEnergy: 15
    }
  ];

  public static registerInput(action: Action, playerNum: 1 | 2): ComboString | null {
    const history = playerNum === 1 ? this.p1History : this.p2History;
    const now = performance.now();
    
    // Clear elements older than active comboWindow limits
    while (history.length > 0 && now - history[0].time > this.comboWindow) {
      history.shift();
    }
    
    // Append new attack
    history.push({ action, time: now });
    
    // Check if history matches any defined combos
    return this.checkComboMatch(history);
  }

  public static clearHistory(playerNum: 1 | 2): void {
    if (playerNum === 1) this.p1History = [];
    else this.p2History = [];
  }

  private static checkComboMatch(history: { action: Action; time: number }[]): ComboString | null {
    if (history.length < 2) return null;
    
    // Check sequences matching backward from current end
    const lastActions = history.map(h => h.action);
    
    for (const combo of this.originalCombos) {
      const seqLen = combo.sequence.length;
      if (lastActions.length < seqLen) continue;
      
      const slice = lastActions.slice(-seqLen);
      let match = true;
      for (let i = 0; i < seqLen; i++) {
        if (slice[i] !== combo.sequence[i]) {
          match = false;
          break;
        }
      }
      
      if (match) {
        console.log(`[ComboSystem] Dynamic String Matched! Multiplier: ${combo.damageMultiplier}x`);
        // Empty history to prevent duplicate triggers
        history.length = 0;
        return combo;
      }
    }
    
    return null;
  }
}
