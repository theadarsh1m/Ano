export class SlitherAudioEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private volume: number = 0.5;
  private boostOscillator: OscillatorNode | null = null;
  private boostGain: GainNode | null = null;
  private recentFoodCount: number = 0;
  private lastFoodTime: number = 0;

  constructor() {
    // Lazy init audio context on first user interaction
  }

  private init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted && this.boostGain) {
      this.boostGain.gain.setTargetAtTime(0, this.ctx?.currentTime || 0, 0.05);
    }
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
  }

  public playFoodSound(value: number = 1) {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    const now = Date.now();
    if (now - this.lastFoodTime < 1500) {
      this.recentFoodCount = Math.min(20, this.recentFoodCount + 1);
    } else {
      this.recentFoodCount = 0;
    }
    this.lastFoodTime = now;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      // Pitch increases as you eat consecutive food items quickly
      const baseFreq = 440 + this.recentFoodCount * 25 + (value > 2 ? 100 : 0);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.3, this.ctx.currentTime + 0.08);

      const vol = Math.min(0.3, (0.08 + value * 0.02) * this.volume);
      gain.gain.setValueAtTime(vol, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.09);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.1);
    } catch (err) {
      // Ignore audio context errors
    }
  }

  public startBoostSound() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    if (this.boostOscillator) return; // already playing

    try {
      this.boostOscillator = this.ctx.createOscillator();
      this.boostGain = this.ctx.createGain();

      this.boostOscillator.type = 'triangle';
      this.boostOscillator.frequency.setValueAtTime(110, this.ctx.currentTime);

      const targetVol = 0.12 * this.volume;
      this.boostGain.gain.setValueAtTime(0, this.ctx.currentTime);
      this.boostGain.gain.linearRampToValueAtTime(targetVol, this.ctx.currentTime + 0.1);

      this.boostOscillator.connect(this.boostGain);
      this.boostGain.connect(this.ctx.destination);

      this.boostOscillator.start();
    } catch (err) {
      this.boostOscillator = null;
      this.boostGain = null;
    }
  }

  public stopBoostSound() {
    if (this.boostGain && this.ctx) {
      try {
        this.boostGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.1);
        setTimeout(() => {
          if (this.boostOscillator) {
            try { this.boostOscillator.stop(); } catch (e) {}
            this.boostOscillator.disconnect();
            this.boostOscillator = null;
          }
          if (this.boostGain) {
            this.boostGain.disconnect();
            this.boostGain = null;
          }
        }, 120);
      } catch (e) {
        this.boostOscillator = null;
        this.boostGain = null;
      }
    }
  }

  public playDeathSound() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.35);

      const vol = 0.35 * this.volume;
      gain.gain.setValueAtTime(vol, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.36);
    } catch (e) {}
  }
}

export const slitherAudio = new SlitherAudioEngine();
