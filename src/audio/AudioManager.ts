// ================= NEO-FIGHT 3D PROCEDURAL AUDIO ENGINE =================
// Generates high-fidelity synthesizer sounds and dynamic cyberpunk BGM in real time.

export class AudioManagerClass {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private bgmInterval: any = null;
  private isMuted: boolean = false;
  private bgmPlaying: boolean = false;
  private currentStep: number = 0;
  
  // Synth-wave BGM variables
  private noteLength: number = 60 / 110 / 2; // Eighth notes
  
  // Cyberpunk synth arpeggio pattern (Bassline + Melody steps)
  private bassline: string[] = [
    'A1', 'A1', 'C2', 'C2', 'D2', 'D2', 'G1', 'G1',
    'A1', 'A1', 'C2', 'C2', 'E2', 'D2', 'C2', 'G1'
  ];
  
  private melody: string[] = [
    'A3', 'C4', 'E4', 'G4', 'E4', 'D4', 'C4', 'A3',
    'E3', 'G3', 'A3', 'B3', 'A3', 'G3', 'E3', 'D3'
  ];

  private notesFreq: Record<string, number> = {
    'A1': 55.00, 'G1': 49.00, 'C2': 65.41, 'D2': 73.42, 'E2': 82.41,
    'E3': 164.81, 'G3': 196.00, 'A3': 220.00, 'B3': 246.94, 'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'G4': 392.00
  };

  private masterVolumeLevel: number = 0.7; // Range: 0 to 1

  constructor() {
    // Automatically register global window event listeners for decoupled triggers
    if (typeof window !== 'undefined') {
      window.addEventListener('combathit', (e: any) => {
        const dmg = e.detail?.damage || 10;
        if (dmg >= 20) {
          this.playHeavyHit();
        } else {
          this.playPunch();
        }
      });

      window.addEventListener('combatblock', () => {
        this.playBlock();
      });

      window.addEventListener('fighterland', () => {
        this.playLanding();
      });

      window.addEventListener('fighterwallbounce', () => {
        this.playWallBounce();
      });

      window.addEventListener('playprojectile', () => {
        this.playSpecial();
      });
    }
  }

  public init(): void {
    if (this.ctx) return;
    
    // Create AudioContext
    const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
    if (!AudioContextClass) return;
    
    this.ctx = new AudioContextClass();
    this.masterGain = this.ctx.createGain();
    
    const initialVol = this.isMuted ? 0 : this.masterVolumeLevel * 0.35;
    this.masterGain.gain.setValueAtTime(initialVol, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);
  }

  public setVolume(level: number): void {
    this.init();
    this.masterVolumeLevel = Math.max(0, Math.min(1, level));
    if (this.ctx && this.masterGain && !this.isMuted) {
      this.masterGain.gain.setValueAtTime(this.masterVolumeLevel * 0.35, this.ctx.currentTime);
    }
  }

  public toggleMute(): boolean {
    this.init();
    if (!this.ctx || !this.masterGain) return false;
    
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
    } else {
      this.masterGain.gain.setValueAtTime(this.masterVolumeLevel * 0.35, this.ctx.currentTime);
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    }
    return this.isMuted;
  }

  public isSoundMuted(): boolean {
    return this.isMuted;
  }

  // --- SOUND EFFECTS SYNTHESIZERS ---

  public playLaser(): void {
    this.init();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.15);
    
    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start();
    osc.stop(this.ctx.currentTime + 0.15);
  }

  public playPunch(): void {
    this.init();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    // 1. High-frequency crisp white noise snap for impact crack
    const snapSize = this.ctx.sampleRate * 0.04;
    const snapBuffer = this.ctx.createBuffer(1, snapSize, this.ctx.sampleRate);
    const snapData = snapBuffer.getChannelData(0);
    for (let i = 0; i < snapSize; i++) {
      snapData[i] = Math.random() * 2 - 1;
    }
    const snapNode = this.ctx.createBufferSource();
    snapNode.buffer = snapBuffer;

    const snapFilter = this.ctx.createBiquadFilter();
    snapFilter.type = 'highpass';
    snapFilter.frequency.setValueAtTime(1200, this.ctx.currentTime);

    const snapGain = this.ctx.createGain();
    snapGain.gain.setValueAtTime(0.6, this.ctx.currentTime);
    snapGain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.04);

    snapNode.connect(snapFilter);
    snapFilter.connect(snapGain);
    snapGain.connect(this.masterGain);

    // 2. Mid-frequency crunch buffer
    const bufferSize = this.ctx.sampleRate * 0.08;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noiseNode = this.ctx.createBufferSource();
    noiseNode.buffer = buffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(250, this.ctx.currentTime);
    noiseFilter.Q.setValueAtTime(2.0, this.ctx.currentTime);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.5, this.ctx.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);

    noiseNode.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain);

    // 3. Sub-bass thump drop (55Hz -> 20Hz)
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'triangle';
    subOsc.frequency.setValueAtTime(55, this.ctx.currentTime);
    subOsc.frequency.exponentialRampToValueAtTime(20, this.ctx.currentTime + 0.12);
    
    subGain.gain.setValueAtTime(0.7, this.ctx.currentTime);
    subGain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.12);

    subOsc.connect(subGain);
    subGain.connect(this.masterGain);

    // Start
    snapNode.start();
    noiseNode.start();
    subOsc.start();

    // Stop
    snapNode.stop(this.ctx.currentTime + 0.04);
    noiseNode.stop(this.ctx.currentTime + 0.08);
    subOsc.stop(this.ctx.currentTime + 0.12);
  }

  public playHeavyHit(): void {
    this.init();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    // 1. High-frequency crack snap
    const snapSize = this.ctx.sampleRate * 0.06;
    const snapBuffer = this.ctx.createBuffer(1, snapSize, this.ctx.sampleRate);
    const snapData = snapBuffer.getChannelData(0);
    for (let i = 0; i < snapSize; i++) {
      snapData[i] = Math.random() * 2 - 1;
    }
    const snapNode = this.ctx.createBufferSource();
    snapNode.buffer = snapBuffer;

    const snapFilter = this.ctx.createBiquadFilter();
    snapFilter.type = 'highpass';
    snapFilter.frequency.setValueAtTime(900, this.ctx.currentTime);

    const snapGain = this.ctx.createGain();
    snapGain.gain.setValueAtTime(0.8, this.ctx.currentTime);
    snapGain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.06);

    snapNode.connect(snapFilter);
    snapFilter.connect(snapGain);
    snapGain.connect(this.masterGain);

    // 2. Heavy crash noise buffer
    const bufferSize = this.ctx.sampleRate * 0.15;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noiseNode = this.ctx.createBufferSource();
    noiseNode.buffer = buffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(150, this.ctx.currentTime);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.8, this.ctx.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);

    noiseNode.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain);

    // 3. Earth shaking sub-bass drop (50Hz -> 18Hz)
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'triangle';
    subOsc.frequency.setValueAtTime(50, this.ctx.currentTime);
    subOsc.frequency.exponentialRampToValueAtTime(18, this.ctx.currentTime + 0.2);
    
    subGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
    subGain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);

    subOsc.connect(subGain);
    subGain.connect(this.masterGain);

    snapNode.start();
    noiseNode.start();
    subOsc.start();

    snapNode.stop(this.ctx.currentTime + 0.06);
    noiseNode.stop(this.ctx.currentTime + 0.15);
    subOsc.stop(this.ctx.currentTime + 0.2);
  }

  public playBlock(): void {
    this.init();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    // Metallic shield impact sound
    const osc = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(600, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(450, this.ctx.currentTime + 0.08);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1200, this.ctx.currentTime);
    osc2.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.08);
    
    gain.gain.setValueAtTime(0.35, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);
    
    osc.connect(gain);
    osc2.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start();
    osc2.start();
    osc.stop(this.ctx.currentTime + 0.08);
    osc2.stop(this.ctx.currentTime + 0.08);
  }

  public playSpecial(): void {
    this.init();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    // Laser rising beam charging sound
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1600, this.ctx.currentTime + 0.45);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(100, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(4000, this.ctx.currentTime + 0.4);
    
    gain.gain.setValueAtTime(0.04, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.2, this.ctx.currentTime + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.45);
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start();
    osc.stop(this.ctx.currentTime + 0.45);
  }

  public playLanding(): void {
    this.init();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    
    // Thump sound when fighter hits the floor
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(90, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(25, this.ctx.currentTime + 0.1);
    
    gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  public playWallBounce(): void {
    this.init();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    
    // Clang/shatter sound on wall contact
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(350, this.ctx.currentTime);
    osc1.frequency.linearRampToValueAtTime(120, this.ctx.currentTime + 0.18);

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(650, this.ctx.currentTime);
    osc2.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.18);
    
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.18);
    
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.masterGain);
    
    osc1.start();
    osc2.start();
    osc1.stop(this.ctx.currentTime + 0.18);
    osc2.stop(this.ctx.currentTime + 0.18);
  }

  // --- ANNOUNCER SPEECH & DINGS ---

  public playAnnouncerRoundStart(): void {
    this.init();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    // Triumphant coin-like ding sequence
    const playDing = (freq: number, delay: number, dur: number) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime + delay);
      
      gain.gain.setValueAtTime(0.12, this.ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + delay + dur);
      
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(this.ctx.currentTime + delay);
      osc.stop(this.ctx.currentTime + delay + dur);
    };

    playDing(587.33, 0, 0.1);    // D5
    playDing(880.00, 0.08, 0.1);  // A5
    playDing(1174.66, 0.16, 0.3); // D6
  }

  public playAnnouncerKO(): void {
    this.init();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    // Deep heavy structural down-pitch boom for K.O.
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(20, this.ctx.currentTime + 0.8);
    
    gain.gain.setValueAtTime(0.35, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.8);
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start();
    osc.stop(this.ctx.currentTime + 0.8);
  }

  public playVictoryChime(): void {
    this.init();
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const notes = [220.00, 277.18, 329.63, 440.00, 554.37, 659.25, 880.00]; // Major scale arpeggio
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime + idx * 0.08);
      
      gain.gain.setValueAtTime(0.15, this.ctx.currentTime + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + idx * 0.08 + 0.4);
      
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(this.ctx.currentTime + idx * 0.08);
      osc.stop(this.ctx.currentTime + idx * 0.08 + 0.4);
    });
  }

  // --- SYNTH-WAVE BACKGROUND MUSIC ---

  public startBGM(): void {
    this.init();
    if (!this.ctx || this.bgmPlaying) return;
    this.bgmPlaying = true;
    
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    
    this.currentStep = 0;
    
    const playStep = () => {
      if (!this.ctx || !this.masterGain || this.isMuted || !this.bgmPlaying) return;
      
      const currentTime = this.ctx.currentTime;
      const stepIdx = this.currentStep % 16;
      
      // BASSLINE
      const bassNote = this.bassline[stepIdx];
      const bassFreq = this.notesFreq[bassNote];
      if (bassFreq) {
        const bassOsc = this.ctx.createOscillator();
        const bassGain = this.ctx.createGain();
        bassOsc.type = 'triangle';
        bassOsc.frequency.setValueAtTime(bassFreq, currentTime);
        
        bassGain.gain.setValueAtTime(0.08, currentTime);
        bassGain.gain.exponentialRampToValueAtTime(0.005, currentTime + this.noteLength * 0.95);
        
        bassOsc.connect(bassGain);
        bassGain.connect(this.masterGain);
        bassOsc.start(currentTime);
        bassOsc.stop(currentTime + this.noteLength * 0.95);
      }
      
      // MELODY (on alternating beats to prevent cluttering)
      if (stepIdx % 2 === 0) {
        const melNote = this.melody[(this.currentStep / 2) % 16];
        const melFreq = this.notesFreq[melNote];
        if (melFreq) {
          const melOsc = this.ctx.createOscillator();
          const melGain = this.ctx.createGain();
          
          melOsc.type = 'sawtooth';
          melOsc.frequency.setValueAtTime(melFreq, currentTime);
          
          // Simple delay effect connection
          const delay = this.ctx.createDelay();
          delay.delayTime.setValueAtTime(0.15, currentTime);
          
          const delayGain = this.ctx.createGain();
          delayGain.gain.setValueAtTime(0.03, currentTime);
          
          melGain.gain.setValueAtTime(0.02, currentTime);
          melGain.gain.exponentialRampToValueAtTime(0.001, currentTime + this.noteLength * 1.8);
          
          melOsc.connect(melGain);
          melGain.connect(this.masterGain);
          
          melGain.connect(delay);
          delay.connect(delayGain);
          delayGain.connect(this.masterGain);
          
          melOsc.start(currentTime);
          melOsc.stop(currentTime + this.noteLength * 1.8);
        }
      }
      
      // RETRO HI-HAT (Short noise puff on step 2, 6, 10, 14)
      if (stepIdx % 4 === 2) {
        const noiseSize = this.ctx.sampleRate * 0.03;
        const noiseBuffer = this.ctx.createBuffer(1, noiseSize, this.ctx.sampleRate);
        const bufferData = noiseBuffer.getChannelData(0);
        for (let i = 0; i < noiseSize; i++) {
          bufferData[i] = Math.random() * 2 - 1;
        }
        
        const noiseSrc = this.ctx.createBufferSource();
        noiseSrc.buffer = noiseBuffer;
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(7000, currentTime);
        
        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.015, currentTime);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, currentTime + 0.03);
        
        noiseSrc.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(this.masterGain);
        
        noiseSrc.start(currentTime);
        noiseSrc.stop(currentTime + 0.03);
      }
      
      this.currentStep++;
    };

    // Queue steps
    this.bgmInterval = setInterval(playStep, this.noteLength * 1000);
  }

  public stopBGM(): void {
    this.bgmPlaying = false;
    if (this.bgmInterval) {
      clearInterval(this.bgmInterval);
      this.bgmInterval = null;
    }
  }
}

export const audio = new AudioManagerClass();
