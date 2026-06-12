"use client";

class SoundEngine {
  private ctx: AudioContext | null = null;
  public isMuted: boolean = false;

  private getContext() {
    if (this.isMuted) return null;
    if (!this.ctx) {
      // Need user interaction to initialize AudioContext, 
      // but usually the first click in a game is enough.
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
    
    // Envelope
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

    // Filter to make it sound like an explosion or hit
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

  toggleMute() {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }
}

export const sounds = new SoundEngine();
