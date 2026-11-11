// Realistic Acoustic Wood/Marble & Medieval Arcane Web Audio Engine
class SoundEngine {
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  public enabled: boolean = true;
  public ambientEnabled: boolean = false;
  private ambientNodes: { stop: () => void } | null = null;

  private initContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (this.ctx && !this.noiseBuffer) {
      // Pre-generate 0.5s of acoustic impulse noise for realistic wood/stone transient impacts
      const sampleRate = this.ctx.sampleRate;
      const length = Math.floor(sampleRate * 0.5);
      const buffer = this.ctx.createBuffer(1, length, sampleRate);
      const data = buffer.getChannelData(0);
      let b0 = 0,
        b1 = 0,
        b2 = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99765 * b0 + white * 0.099046;
        b1 = 0.963 * b1 + white * 0.2965164;
        b2 = 0.57 * b2 + white * 1.0526913;
        data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.12;
      }
      this.noiseBuffer = buffer;
    }
  }

  public toggleAmbient(forceState?: boolean): boolean {
    this.ambientEnabled = forceState !== undefined ? forceState : !this.ambientEnabled;
    if (this.ambientEnabled && this.enabled) {
      this.startAmbientDrone();
    } else {
      this.stopAmbientDrone();
    }
    return this.ambientEnabled;
  }

  private startAmbientDrone() {
    this.stopAmbientDrone();
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const masterGain = this.ctx.createGain();
    masterGain.gain.setValueAtTime(0.001, now);
    masterGain.gain.linearRampToValueAtTime(0.04, now + 1.8);
    masterGain.connect(this.ctx.destination);

    // Warm medieval Dorian fifth chord pad (D2, A2, D3, F#3/A3 subtle harmonic)
    const freqs = [73.42, 110.0, 146.83, 220.0];
    const oscs = freqs.map((f, idx) => {
      const osc = this.ctx!.createOscillator();
      const filter = this.ctx!.createBiquadFilter();
      osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(f, now);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(240 + idx * 40, now);

      osc.connect(filter);
      filter.connect(masterGain);
      osc.start(now);
      return osc;
    });

    this.ambientNodes = {
      stop: () => {
        try {
          if (this.ctx) {
            masterGain.gain.linearRampToValueAtTime(0.0001, this.ctx.currentTime + 0.4);
          }
          setTimeout(() => {
            oscs.forEach((o) => {
              try {
                o.stop();
                o.disconnect();
              } catch {}
            });
          }, 450);
        } catch {}
      },
    };
  }

  public stopAmbientDrone() {
    if (this.ambientNodes) {
      this.ambientNodes.stop();
      this.ambientNodes = null;
    }
  }

  /**
   * Subtle acoustic felt lift sound when picking up or selecting a chess piece
   */
  public playSelect() {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(520, now + 0.065);

    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.075);
  }

  /**
   * Crisp tactical chalk/parchment swish when drawing a 3D tactical arrow
   */
  public playArrow() {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.noiseBuffer) return;

    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(900, now);
    filter.frequency.exponentialRampToValueAtTime(1600, now + 0.09);
    filter.Q.setValueAtTime(2.5, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    src.start(now);
    src.stop(now + 0.1);
  }

  /**
   * Authentic Weighted Wooden/Marble Chess Piece Placement on Hardwood Board
   */
  public playMove(isCastle = false) {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx) return;

    const hits = isCastle ? [0, 0.13] : [0];
    hits.forEach((offset) => {
      if (!this.ctx) return;
      const now = this.ctx.currentTime + offset;

      // 1. Deep Hardwood Cabinet Knock Resonance
      const bodyOsc = this.ctx.createOscillator();
      const bodyGain = this.ctx.createGain();
      bodyOsc.type = 'triangle';
      bodyOsc.frequency.setValueAtTime(155, now);
      bodyOsc.frequency.exponentialRampToValueAtTime(42, now + 0.11);
      bodyGain.gain.setValueAtTime(0.34, now);
      bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      bodyOsc.connect(bodyGain);
      bodyGain.connect(this.ctx.destination);
      bodyOsc.start(now);
      bodyOsc.stop(now + 0.125);

      // 2. Crisp Weighted Base Contact Transient (Filtered Pink Noise)
      if (this.noiseBuffer) {
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.noiseBuffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(680, now);
        filter.Q.setValueAtTime(1.8, now);

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.45, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(this.ctx.destination);
        noise.start(now);
        noise.stop(now + 0.05);
      }
    });
  }

  /**
   * Heavy Impact + Stone/Marble Shatter Harmonics on Capture
   */
  public playCapture() {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;

    // 1. Sub-bass table impact thud
    const bass = this.ctx.createOscillator();
    const bassGain = this.ctx.createGain();
    bass.type = 'sine';
    bass.frequency.setValueAtTime(145, now);
    bass.frequency.exponentialRampToValueAtTime(28, now + 0.36);
    bassGain.gain.setValueAtTime(0.48, now);
    bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    bass.connect(bassGain);
    bassGain.connect(this.ctx.destination);
    bass.start(now);
    bass.stop(now + 0.39);

    // 2. Crisp Stone Shatter Clatter (Multi-tap noise bursts)
    if (this.noiseBuffer) {
      [0, 0.04, 0.09, 0.15].forEach((delay, idx) => {
        if (!this.ctx || !this.noiseBuffer) return;
        const t = now + delay;
        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1100 + idx * 380, t);
        filter.Q.setValueAtTime(2.2, t);

        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.32 / (idx + 1), t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);

        src.connect(filter);
        filter.connect(g);
        g.connect(this.ctx.destination);
        src.start(t);
        src.stop(t + 0.075);
      });
    }
  }

  public playBattleStart() {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const drumOsc = this.ctx.createOscillator();
    const drumGain = this.ctx.createGain();
    drumOsc.type = 'sine';
    drumOsc.frequency.setValueAtTime(125, now);
    drumOsc.frequency.exponentialRampToValueAtTime(34, now + 0.45);
    drumGain.gain.setValueAtTime(0.38, now);
    drumGain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);
    drumOsc.connect(drumGain);
    drumGain.connect(this.ctx.destination);
    drumOsc.start(now);
    drumOsc.stop(now + 0.5);

    const notes = [293.66, 440.0];
    notes.forEach((freq, i) => {
      if (!this.ctx) return;
      const start = now + i * 0.14;
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1200, start);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.11, start + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.5);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(start);
      osc.stop(start + 0.52);
    });
  }

  public playCheck() {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const notes = [440, 523.25, 440]; // A4 -> C5 -> A4 alert chime
    notes.forEach((freq, i) => {
      if (!this.ctx) return;
      const start = now + i * 0.11;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.14, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.36);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(start);
      osc.stop(start + 0.38);
    });
  }

  public playVictory() {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const chord = [293.66, 369.99, 440.0, 587.33, 739.99, 880.0]; // D Major Royal Fanfare
    chord.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = idx % 2 === 0 ? 'triangle' : 'sine';
      const start = now + idx * 0.09;
      osc.frequency.setValueAtTime(freq, start);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2000, start);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.14, start + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.95);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(start);
      osc.stop(start + 0.98);
    });
  }
}

export const soundEngine = new SoundEngine();
