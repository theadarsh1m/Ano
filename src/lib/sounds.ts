"use client";

class SoundEngine {
  private ctx: AudioContext | null = null;
  public isMuted: boolean = true;

  private getContext() {
    if (this.isMuted) return null;
    // Silence background tabs to prevent phantom audio during multiplayer testing
    if (typeof document !== 'undefined' && document.hidden) return null;
    
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  playTone(frequency: number, type: OscillatorType, duration: number, vol: number = 0.1) {
    const ctx = this.getContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  playNoise(duration: number, vol: number = 0.5) {
    const ctx = this.getContext();
    if (!ctx) return;

    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1000;

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(vol, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

    noise.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);

    noise.start();
  }

  // Common Sound Presets
  playEat() {
    this.playTone(600, 'sine', 0.1, 0.2);
    setTimeout(() => this.playTone(800, 'sine', 0.15, 0.2), 50);
  }

  playCrash() {
    this.playTone(150, 'sawtooth', 0.3, 0.3);
    this.playNoise(0.4, 0.4);
  }

  playSlide() {
    this.playTone(300, 'triangle', 0.1, 0.05);
  }

  playMerge() {
    this.playTone(400, 'sine', 0.1, 0.1);
    setTimeout(() => this.playTone(600, 'sine', 0.15, 0.1), 50);
  }

  playReveal() {
    this.playTone(800, 'sine', 0.05, 0.05);
  }

  playFlag() {
    this.playTone(500, 'square', 0.1, 0.05);
  }

  playWin() {
    this.playTone(400, 'sine', 0.2, 0.1);
    setTimeout(() => this.playTone(500, 'sine', 0.2, 0.1), 150);
    setTimeout(() => this.playTone(600, 'sine', 0.4, 0.1), 300);
  }

  playExplosion() {
    this.playNoise(0.8, 0.8);
    this.playTone(100, 'sawtooth', 0.8, 0.5);
  }

  // ================================================
  // Chamber Clash Dedicated Sounds
  // ================================================

  /** Metallic click for a shell being loaded into the chamber */
  playShellLoad() {
    this.playTone(2200, 'square', 0.04, 0.12);
    setTimeout(() => this.playTone(1800, 'square', 0.05, 0.1), 60);
  }

  /** Pump-action rack sound */
  playPump() {
    // Click 1 (rack back)
    this.playNoise(0.08, 0.25);
    this.playTone(600, 'sawtooth', 0.08, 0.15);
    // Click 2 (rack forward)
    setTimeout(() => {
      this.playNoise(0.08, 0.22);
      this.playTone(500, 'sawtooth', 0.08, 0.12);
    }, 120);
  }

  /** Gun cock (lighter) */
  playGunCock() {
    this.playTone(800, 'square', 0.1, 0.1);
    setTimeout(() => this.playTone(900, 'square', 0.1, 0.1), 50);
  }

  /** Live shotgun blast */
  playGunShootLive() {
    // A thick noise burst for the explosion
    this.playNoise(0.7, 0.95);
    // A very deep bass rumble
    this.playTone(50, 'sawtooth', 0.6, 0.95);
    this.playTone(90, 'sawtooth', 0.4, 0.7);
    this.playTone(180, 'square', 0.2, 0.4);
  }

  /** Blank: click + small puff */
  playGunShootBlank() {
    // A crisp metallic click (hammer strike)
    this.playTone(1500, 'triangle', 0.03, 0.2);
    this.playTone(800, 'square', 0.05, 0.15);
    // A very tiny puff of air
    this.playNoise(0.04, 0.05);
  }

  /** Bottle open + gulp */
  playDrink() {
    // Pop
    this.playTone(1500, 'sine', 0.03, 0.15);
    // Gulp
    setTimeout(() => {
      this.playTone(300, 'sine', 0.08, 0.12);
      this.playTone(350, 'sine', 0.06, 0.08);
    }, 120);
    // Bottle set down
    setTimeout(() => {
      this.playTone(200, 'triangle', 0.06, 0.08);
    }, 300);
  }

  /** Winding dial sound for the inverter */
  playInverter() {
    const ctx = this.getContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(900, ctx.currentTime + 0.15);
    osc.frequency.linearRampToValueAtTime(150, ctx.currentTime + 0.35);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  }

  /** Retro electronic ring for the burner phone */
  playBurnerPhone() {
    this.playTone(850, 'square', 0.08, 0.1);
    setTimeout(() => this.playTone(850, 'square', 0.08, 0.1), 120);
    setTimeout(() => {
      this.playTone(850, 'square', 0.08, 0.1);
      setTimeout(() => this.playTone(850, 'square', 0.08, 0.1), 120);
    }, 350);
  }
  /** Adrenaline hiss and pulse sound */
  playAdrenaline() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const bufferSize = ctx.sampleRate * 0.3;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(3000, ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.3);
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.08, ctx.currentTime);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      noise.start();
      noise.stop(ctx.currentTime + 0.3);
    } catch (e) {
      this.playTone(180, 'sine', 0.1, 0.3);
    }
    setTimeout(() => {
      this.playTone(65, 'sine', 0.25, 0.15);
      setTimeout(() => {
        this.playTone(55, 'sine', 0.25, 0.2);
      }, 140);
    }, 120);
  }
  /** Metallic clank for handcuffs locking */
  playHandcuffsLock() {
    this.playTone(800, 'square', 0.06, 0.2);
    setTimeout(() => this.playTone(600, 'square', 0.08, 0.18), 80);
    setTimeout(() => this.playTone(400, 'triangle', 0.1, 0.1), 180);
  }

  /** Grinding saw sound */
  playHandsaw() {
    this.playNoise(0.3, 0.15);
    this.playTone(900, 'sawtooth', 0.25, 0.12);
    setTimeout(() => this.playTone(1100, 'sawtooth', 0.2, 0.1), 150);
  }

  /** Shell casing bouncing on table */
  playShellEject() {
    this.playTone(3000, 'sine', 0.03, 0.1);
    setTimeout(() => this.playTone(2500, 'sine', 0.03, 0.07), 80);
    setTimeout(() => this.playTone(2000, 'sine', 0.03, 0.04), 150);
  }

  /** Subtle chime for turn start */
  playTurnChime() {
    this.playTone(880, 'sine', 0.12, 0.06);
    setTimeout(() => this.playTone(1100, 'sine', 0.15, 0.05), 100);
  }

  /** Drum roll for round start */
  playRoundDrum() {
    for (let i = 0; i < 6; i++) {
      setTimeout(() => {
        this.playNoise(0.06, 0.12 + i * 0.02);
        this.playTone(100, 'triangle', 0.08, 0.08 + i * 0.01);
      }, i * 80);
    }
  }

  /** Low-frequency double heartbeat */
  playHeartbeat() {
    this.playTone(60, 'sawtooth', 0.12, 0.25);
    setTimeout(() => this.playTone(55, 'sawtooth', 0.12, 0.25), 180);
  }

  /** Dark descending tone for player elimination */
  playElimination() {
    const ctx = this.getContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.8);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.9);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.9);
  }

  /** Generic item use sound */
  playItemUse() {
    this.playTone(600, 'sine', 0.1, 0.2);
    setTimeout(() => this.playTone(800, 'sine', 0.2, 0.2), 100);
  }

  /** Magnifier inspection sound */
  playInspect() {
    this.playTone(1000, 'sine', 0.08, 0.08);
    setTimeout(() => this.playTone(1200, 'sine', 0.1, 0.06), 100);
    setTimeout(() => this.playTone(1400, 'sine', 0.12, 0.04), 220);
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }
}

export const sounds = new SoundEngine();
