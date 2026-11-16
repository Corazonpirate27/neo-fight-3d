import { GameState } from '../core/GameState';
import { Fighter } from '../entities/Fighter';

export class HUD {
  private state: GameState;
  
  // Cache DOM elements
  private p1LifeBar: HTMLElement | null = null;
  private p1LifeRed: HTMLElement | null = null;
  private p1EnergyBar: HTMLElement | null = null;
  private p1Name: HTMLElement | null = null;
  
  private p2LifeBar: HTMLElement | null = null;
  private p2LifeRed: HTMLElement | null = null;
  private p2EnergyBar: HTMLElement | null = null;
  private p2Name: HTMLElement | null = null;
  
  private timerText: HTMLElement | null = null;
  private roundText: HTMLElement | null = null;
  
  private p1ComboContainer: HTMLElement | null = null;
  private p1ComboCount: HTMLElement | null = null;
  private p1ComboDmg: HTMLElement | null = null;
  
  private p2ComboContainer: HTMLElement | null = null;
  private p2ComboCount: HTMLElement | null = null;
  private p2ComboDmg: HTMLElement | null = null;
  
  private arenaAlert: HTMLElement | null = null;
  private arenaAlertText: HTMLElement | null = null;
  
  private p1WinDots: NodeListOf<Element> | null = null;
  private p2WinDots: NodeListOf<Element> | null = null;

  constructor(state: GameState) {
    this.state = state;
    this.cacheElements();
    this.registerEventListeners();
  }

  private cacheElements(): void {
    this.p1LifeBar = document.getElementById('p1-life');
    this.p1LifeRed = document.getElementById('p1-life-red');
    this.p1EnergyBar = document.getElementById('p1-energy');
    this.p1Name = document.getElementById('p1-hud-name');

    this.p2LifeBar = document.getElementById('p2-life');
    this.p2LifeRed = document.getElementById('p2-life-red');
    this.p2EnergyBar = document.getElementById('p2-energy');
    this.p2Name = document.getElementById('p2-hud-name');

    this.timerText = document.getElementById('fight-timer');
    this.roundText = document.getElementById('round-number');

    this.p1ComboContainer = document.getElementById('p1-combo');
    this.p1ComboCount = document.getElementById('p1-combo-count');
    this.p1ComboDmg = document.getElementById('p1-combo-dmg');

    this.p2ComboContainer = document.getElementById('p2-combo');
    this.p2ComboCount = document.getElementById('p2-combo-count');
    this.p2ComboDmg = document.getElementById('p2-combo-dmg');

    this.arenaAlert = document.getElementById('arena-alert');
    this.arenaAlertText = document.getElementById('arena-alert-text');

    this.p1WinDots = document.querySelectorAll('.p1-wins .dot');
    this.p2WinDots = document.querySelectorAll('.p2-wins .dot');
  }

  private registerEventListeners(): void {
    // Listen for combo updates
    window.addEventListener('comboupdate', (e: any) => {
      const { playerNum, hits, dmg } = e.detail;
      this.updateCombo(playerNum, hits, dmg);
    });
  }

  public showHUD(active: boolean): void {
    const hudContainer = document.getElementById('hud');
    if (hudContainer) {
      if (active) {
        hudContainer.classList.add('active');
      } else {
        hudContainer.classList.remove('active');
      }
    }
  }

  public update(p1: Fighter, p2: Fighter): void {
    // 1. Update Names
    if (this.p1Name) this.p1Name.innerText = p1.name.toUpperCase();
    if (this.p2Name) this.p2Name.innerText = p2.name.toUpperCase();

    // 2. Health bars calculations
    const p1LifePct = Math.max(0, (p1.health / p1.maxHealth) * 100);
    const p2LifePct = Math.max(0, (p2.health / p2.maxHealth) * 100);

    if (this.p1LifeBar) this.p1LifeBar.style.width = `${p1LifePct}%`;
    if (this.p1LifeRed) this.p1LifeRed.style.width = `${p1LifePct}%`;

    if (this.p2LifeBar) this.p2LifeBar.style.width = `${p2LifePct}%`;
    if (this.p2LifeRed) this.p2LifeRed.style.width = `${p2LifePct}%`;

    // 3. Energy bars
    const p1EnergyPct = Math.max(0, (p1.energy / p1.maxEnergy) * 100);
    const p2EnergyPct = Math.max(0, (p2.energy / p2.maxEnergy) * 100);

    if (this.p1EnergyBar) this.p1EnergyBar.style.width = `${p1EnergyPct}%`;
    if (this.p2EnergyBar) this.p2EnergyBar.style.width = `${p2EnergyPct}%`;

    // 4. Timer & Round text updates
    if (this.timerText) {
      this.timerText.innerText = Math.ceil(this.state.roundTimer).toString();
    }
    if (this.roundText) {
      this.roundText.innerText = `ROUND ${this.state.roundNumber}`;
    }

    // 5. Round indicator wins dots
    if (this.p1WinDots) {
      this.p1WinDots.forEach((dot, idx) => {
        if (idx < this.state.p1Wins) {
          dot.classList.add('active');
        } else {
          dot.classList.remove('active');
        }
      });
    }

    if (this.p2WinDots) {
      this.p2WinDots.forEach((dot, idx) => {
        if (idx < this.state.p2Wins) {
          dot.classList.add('active');
        } else {
          dot.classList.remove('active');
        }
      });
    }
  }

  private updateCombo(playerNum: 1 | 2, hits: number, dmg: number): void {
    const container = playerNum === 1 ? this.p1ComboContainer : this.p2ComboContainer;
    const countEl = playerNum === 1 ? this.p1ComboCount : this.p2ComboCount;
    const dmgEl = playerNum === 1 ? this.p1ComboDmg : this.p2ComboDmg;

    if (!container || !countEl || !dmgEl) return;

    if (hits > 1) {
      container.style.display = 'flex';
      countEl.innerText = hits.toString();
      dmgEl.innerText = dmg.toString();
    } else {
      container.style.display = 'none';
    }
  }

  // Visual alert notices like ROUND 1, FIGHT!, K.O.
  public showAlert(text: string, type: 'info' | 'fight' | 'ko' = 'info', durationMs: number = 1500): Promise<void> {
    return new Promise((resolve) => {
      if (!this.arenaAlert || !this.arenaAlertText) {
        resolve();
        return;
      }

      this.arenaAlertText.innerText = text;
      this.arenaAlert.className = `alert-overlay alert-${type}`;
      this.arenaAlert.style.display = 'flex';

      setTimeout(() => {
        if (this.arenaAlert) {
          this.arenaAlert.style.display = 'none';
        }
        resolve();
      }, durationMs);
    });
  }
}
