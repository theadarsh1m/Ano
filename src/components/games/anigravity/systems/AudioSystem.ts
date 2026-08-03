export class AudioSystem {
  private ctx: AudioContext | null = null;
  private masterVolume: number = 0.5;

  public init() {
    if (typeof window === 'undefined' || this.ctx) return;
    
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
    } catch (e) {
      console.warn('Web Audio API not supported in this browser:', e);
    }
  }

  private resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setVolume(volume: number) {
    this.masterVolume = Math.max(0, Math.min(1, volume));
  }

  /**
   * Heavy thud sound for blocks landing.
   */
  public playLand() {
    this.init();
    this.resume();
    if (!this.ctx) return;

    const time = this.ctx.currentTime;
    
    // Low frequency oscillator for impact thump
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(120, time);
    osc.frequency.exponentialRampToValueAtTime(30, time + 0.2);
    
    gain.gain.setValueAtTime(this.masterVolume * 0.8, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.3);
    
    osc.start(time);
    osc.stop(time + 0.3);

    // Subtle noise burst for impact grit
    this.playNoise(time, 0.1, 0.3);
  }

  /**
   * Bouncy sound.
   */
  public playBounce() {
    this.init();
    this.resume();
    if (!this.ctx) return;

    const time = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, time);
    osc.frequency.exponentialRampToValueAtTime(260, time + 0.15); // pitch goes up slightly

    gain.gain.setValueAtTime(this.masterVolume * 0.4, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.15);

    osc.start(time);
    osc.stop(time + 0.15);
  }

  /**
   * Whoosh sound when character is dropped.
   */
  public playDrop() {
    this.init();
    this.resume();
    if (!this.ctx) return;

    const time = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(350, time);
    osc.frequency.exponentialRampToValueAtTime(100, time + 0.45); // Pitch sweep down

    gain.gain.setValueAtTime(0.01, time);
    gain.gain.linearRampToValueAtTime(this.masterVolume * 0.3, time + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.45);

    osc.start(time);
    osc.stop(time + 0.45);
  }

  /**
   * Descending dramatic tone for player elimination.
   */
  public playElimination() {
    this.init();
    this.resume();
    if (!this.ctx) return;

    const time = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, time);
    osc.frequency.linearRampToValueAtTime(80, time + 0.8);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(225, time); // detuned for dissonance
    osc2.frequency.linearRampToValueAtTime(85, time + 0.8);

    gain.gain.setValueAtTime(this.masterVolume * 0.6, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.8);

    osc.start(time);
    osc2.start(time);
    osc.stop(time + 0.8);
    osc2.stop(time + 0.8);
  }

  /**
   * Ascending cheerful melody for win.
   */
  public playVictory() {
    this.init();
    this.resume();
    if (!this.ctx) return;

    const time = this.ctx.currentTime;
    const notes = [261.63, 329.63, 392.00, 523.25]; // C E G C arpeggio
    
    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, time + idx * 0.15);

      gain.gain.setValueAtTime(0, time + idx * 0.15);
      gain.gain.linearRampToValueAtTime(this.masterVolume * 0.5, time + idx * 0.15 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, time + idx * 0.15 + 0.4);

      osc.start(time + idx * 0.15);
      osc.stop(time + idx * 0.15 + 0.4);
    });
  }

  /**
   * Sound on hover / UI interactions.
   */
  public playClick() {
    this.init();
    this.resume();
    if (!this.ctx) return;

    const time = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, time);
    osc.frequency.exponentialRampToValueAtTime(450, time + 0.08);

    gain.gain.setValueAtTime(this.masterVolume * 0.25, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.08);

    osc.start(time);
    osc.stop(time + 0.08);
  }

  /**
   * Synthesize noise.
   */
  private playNoise(time: number, duration: number, gainFactor: number) {
    if (!this.ctx) return;

    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = buffer;

    // Apply high pass filter for sandiness
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 500;

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(this.masterVolume * gainFactor, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, time + duration);

    whiteNoise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);

    whiteNoise.start(time);
    whiteNoise.stop(time + duration);
  }
}
