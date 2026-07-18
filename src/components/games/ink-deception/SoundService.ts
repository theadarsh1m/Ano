class SoundService {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private loFiInterval: any = null; // eslint-disable-line @typescript-eslint/no-explicit-any
  private currentLoFiNodes: AudioNode[] = [];
  private suspenseOsc: OscillatorNode | null = null;
  private suspenseGain: GainNode | null = null;

  private init() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
    } catch (e) {
      console.error('Web Audio API not supported', e);
    }
  }

  private resume() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(e => console.warn('Could not resume audio context:', e));
    }
  }

  public handleUserInteraction() {
    this.resume();
  }

  public toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.stopBackgroundMusic();
    } else {
      this.resume();
      this.startBackgroundMusic();
    }
    return this.isMuted;
  }

  public getMutedState() {
    return this.isMuted;
  }

  private createAdsr(gainNode: GainNode, start: number, attack: number, decay: number, sustain: number, release: number, peakVol = 0.3, sustainVol = 0.1) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(peakVol, now + attack);
    gainNode.gain.exponentialRampToValueAtTime(sustainVol, now + attack + decay);
    gainNode.gain.setValueAtTime(sustainVol, now + attack + decay + sustain);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + attack + decay + sustain + release);
  }

  // Soft wooden click
  public playClick() {
    if (this.isMuted) return;
    this.resume();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(120, this.ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  // Soft button hover
  public playHover() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(480, this.ctx.currentTime + 0.05);

    gain.gain.setValueAtTime(0.015, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.0001, this.ctx.currentTime + 0.05);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.06);
  }

  // Synthetic ink brush drawing stroke sound (filtered noise)
  public playStroke(velocity: number) {
    if (this.isMuted) return;
    this.resume();
    if (!this.ctx) return;

    // Normalize velocity to range 0.0 - 1.0
    const normSpeed = Math.min(Math.max(velocity / 30, 0.1), 1.0);
    
    const bufferSize = this.ctx.sampleRate * 0.15; // 150ms buffer
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    
    // Fill buffer with white noise
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noiseNode = this.ctx.createBufferSource();
    noiseNode.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    // Frequency shifts up with speed
    filter.frequency.setValueAtTime(300 + normSpeed * 800, this.ctx.currentTime);
    filter.Q.setValueAtTime(4.0, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(normSpeed * 0.05, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);

    noiseNode.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noiseNode.start();
    noiseNode.stop(this.ctx.currentTime + 0.15);
  }

  // Swooshing noise sweep for card flips
  public playCardFlip() {
    if (this.isMuted) return;
    this.resume();
    if (!this.ctx) return;

    const bufferSize = this.ctx.sampleRate * 0.35;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1000, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(150, this.ctx.currentTime + 0.3);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    source.start();
    source.stop(this.ctx.currentTime + 0.35);
  }

  // Deep Zen Gong for role reveal
  public playReveal() {
    if (this.isMuted) return;
    this.resume();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    
    // Fundamental deep tone
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(110, now); // A2 note
    // FM detune to create a rich beating gong resonance
    const fm = this.ctx.createOscillator();
    const fmGain = this.ctx.createGain();
    fm.frequency.value = 1.5; // slow beating
    fmGain.gain.value = 3;
    fm.connect(fmGain);
    fmGain.connect(osc1.frequency);
    
    this.createAdsr(gain1, now, 0.05, 0.8, 1.2, 1.5, 0.3, 0.08);

    // High harmonic ring
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(330, now); // E4 note
    this.createAdsr(gain2, now, 0.02, 0.3, 0.4, 0.8, 0.15, 0.015);

    osc1.connect(gain1);
    gain1.connect(this.ctx.destination);
    
    osc2.connect(gain2);
    gain2.connect(this.ctx.destination);

    fm.start(now);
    osc1.start(now);
    osc2.start(now);

    const stopTime = now + 3.0;
    fm.stop(stopTime);
    osc1.stop(stopTime);
    osc2.stop(stopTime);
  }

  // Plucked Shamisen string sound for voting
  public playVoteCast() {
    if (this.isMuted) return;
    this.resume();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    // Pentatonic note (D4)
    osc.frequency.setValueAtTime(293.66, now);

    // Filter sweep simulates a plucked instrument string pluck
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2500, now);
    filter.frequency.exponentialRampToValueAtTime(300, now + 0.25);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.4);
  }

  // Pentatonic success chimes
  public playCorrect() {
    if (this.isMuted) return;
    this.resume();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    // C5, D5, G5, A5, C6 (Japanese Insen Pentatonic vibe)
    const notes = [523.25, 587.33, 783.99, 880.00, 1046.50];

    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.1);

      gain.gain.setValueAtTime(0, now + idx * 0.1);
      gain.gain.linearRampToValueAtTime(0.12, now + idx * 0.1 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(now + idx * 0.1);
      osc.stop(now + idx * 0.1 + 0.4);
    });
  }

  // Low failure drone
  public playWrong() {
    if (this.isMuted) return;
    this.resume();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const subOsc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(146.83, now); // D3
    osc.frequency.linearRampToValueAtTime(110.00, now + 0.5); // slide down to A2

    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(73.41, now); // D2
    subOsc.frequency.linearRampToValueAtTime(55.00, now + 0.5);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, now);
    filter.frequency.exponentialRampToValueAtTime(80, now + 0.5);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

    osc.connect(filter);
    subOsc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    subOsc.start(now);
    osc.stop(now + 0.7);
    subOsc.stop(now + 0.7);
  }

  // Winner fanfare
  public playVictory() {
    if (this.isMuted) return;
    this.resume();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    // Ascending arpeggio
    const arpeggio = [220.00, 277.18, 329.63, 440.00, 554.37, 659.25, 880.00];

    arpeggio.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = idx === arpeggio.length - 1 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.12);

      gain.gain.setValueAtTime(0, now + idx * 0.12);
      gain.gain.linearRampToValueAtTime(0.15, now + idx * 0.12 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.6);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(now + idx * 0.12);
      osc.stop(now + idx * 0.12 + 0.7);
    });
  }

  // Generative lo-fi background loop
  public startBackgroundMusic() {
    if (this.isMuted) return;
    this.resume();
    if (!this.ctx) return;
    if (this.loFiInterval) return;

    console.log('[Ink & Deception] Starting lo-fi soundscape...');

    // Ambient loop plays soft, breathing minor-ninth chords and occasional pentatonic note plucks
    // Am9 -> Dm9 -> G9 -> Cmaj9
    const chordPacks = [
      [110.0, 220.0, 261.63, 329.63, 392.00, 493.88], // Am9 (A2, A3, C4, E4, G4, B4)
      [146.83, 293.66, 349.23, 440.00, 523.25, 659.25], // Dm9
      [98.00, 196.00, 246.94, 311.13, 392.00, 493.88], // G9
      [130.81, 261.63, 329.63, 392.00, 523.25, 587.33]  // Cmaj9
    ];

    let chordIdx = 0;

    const playChord = () => {
      if (this.isMuted || !this.ctx) return;
      const now = this.ctx.currentTime;
      const chord = chordPacks[chordIdx];
      chordIdx = (chordIdx + 1) % chordPacks.length;

      // Clean up previous nodes
      this.currentLoFiNodes = this.currentLoFiNodes.filter(node => {
        try {
          (node as any).disconnect();
        } catch (_) {}
        return false;
      });

      // Play soft triangle chord voices
      chord.forEach((freq, voiceIdx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);

        // Very slow attack, long sustain, slow release for a Ghibli pad vibe
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.015, now + 1.5); // soft volume
        gain.gain.setValueAtTime(0.015, now + 5.0);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 7.5);

        // Lowpass filter to keep it warm and muddy
        const filter = this.ctx!.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(700, now);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx!.destination);

        osc.start(now);
        osc.stop(now + 7.8);
        this.currentLoFiNodes.push(osc);
      });

      // Add a random koto pluck on top during the chord
      setTimeout(() => {
        if (this.isMuted || !this.ctx) return;
        const nowPluck = this.ctx.currentTime;
        const scale = [392.00, 440.00, 523.25, 587.33, 659.25, 783.99, 880.00];
        const randomNote = scale[Math.floor(Math.random() * scale.length)];

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(randomNote, nowPluck);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1500, nowPluck);
        filter.frequency.exponentialRampToValueAtTime(250, nowPluck + 0.4);

        gain.gain.setValueAtTime(0.02, nowPluck);
        gain.gain.exponentialRampToValueAtTime(0.0001, nowPluck + 0.5);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(nowPluck);
        osc.stop(nowPluck + 0.6);
      }, 2000 + Math.random() * 2000);
    };

    playChord();
    this.loFiInterval = setInterval(playChord, 8000);
  }

  public stopBackgroundMusic() {
    if (this.loFiInterval) {
      clearInterval(this.loFiInterval);
      this.loFiInterval = null;
    }
    this.currentLoFiNodes.forEach(node => {
      try {
        (node as any).stop();
        node.disconnect();
      } catch (_) {}
    });
    this.currentLoFiNodes = [];
  }

  public startVotingSuspense() {
    if (this.isMuted) return;
    this.resume();
    if (!this.ctx) return;
    if (this.suspenseOsc) return;

    const now = this.ctx.currentTime;
    this.suspenseOsc = this.ctx.createOscillator();
    this.suspenseGain = this.ctx.createGain();

    this.suspenseOsc.type = 'sine';
    this.suspenseOsc.frequency.setValueAtTime(220, now);
    this.suspenseOsc.frequency.linearRampToValueAtTime(380, now + 30); // slowly rise over 30s

    this.suspenseGain.gain.setValueAtTime(0, now);
    this.suspenseGain.gain.linearRampToValueAtTime(0.04, now + 1.0); // soft fade-in

    this.suspenseOsc.connect(this.suspenseGain);
    this.suspenseGain.connect(this.ctx.destination);

    this.suspenseOsc.start(now);
  }

  public stopVotingSuspense() {
    if (this.suspenseOsc && this.ctx) {
      const now = this.ctx.currentTime;
      try {
        this.suspenseGain?.gain.setValueAtTime(this.suspenseGain.gain.value, now);
        this.suspenseGain?.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
        this.suspenseOsc.stop(now + 0.6);
      } catch (_) {}
      this.suspenseOsc = null;
      this.suspenseGain = null;
    }
  }
}

export const soundService = new SoundService();
