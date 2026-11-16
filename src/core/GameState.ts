export enum State {
  LOADING,
  MENU,
  CHARACTER_SELECT,
  FIGHT,
  PAUSE,
  GAME_OVER
}

export type FighterType = 'vanguard' | 'aegis';
export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';

export interface GameSettings {
  reducedMotion: boolean;
  screenShake: boolean;
  postProcessing: boolean;
  volume: number;
}

export class GameState {
  public currentState: State = State.LOADING;
  public gameMode: 'PVC' | 'PVP' = 'PVC'; // PVC = vs CPU, PVP = 1v1 Local
  public difficulty: Difficulty = 'MEDIUM';
  public p1SelectedChar: FighterType = 'vanguard';
  public p2SelectedChar: FighterType = 'aegis';
  
  // Fight dynamic states
  public roundNumber: number = 1;
  public maxRounds: number = 3;
  public p1Wins: number = 0;
  public p2Wins: number = 0;
  public roundTimer: number = 99;
  public isFightActive: boolean = false;
  
  // Settings/Accessibility
  public settings: GameSettings = {
    reducedMotion: false,
    screenShake: true,
    postProcessing: true,
    volume: 0.7
  };

  constructor() {
    this.loadSettings();
  }

  public changeState(newState: State): void {
    this.currentState = newState;
    console.log(`[GameState] Transitioned to state: ${State[newState]}`);
    
    // Dispatch custom event for UI updates
    const event = new CustomEvent('gamestatechange', { detail: { state: newState } });
    window.dispatchEvent(event);
  }

  public resetMatch(): void {
    this.roundNumber = 1;
    this.p1Wins = 0;
    this.p2Wins = 0;
    this.roundTimer = 99;
    this.isFightActive = false;
  }

  public resetRound(): void {
    this.roundTimer = 99;
    this.isFightActive = false;
  }

  public saveSettings(): void {
    localStorage.setItem('neofight3d_settings', JSON.stringify(this.settings));
  }

  private loadSettings(): void {
    const saved = localStorage.getItem('neofight3d_settings');
    if (saved) {
      try {
        this.settings = { ...this.settings, ...JSON.parse(saved) };
      } catch (e) {
        console.error('Failed to parse settings', e);
      }
    }
  }
}
