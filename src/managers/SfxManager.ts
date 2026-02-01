/**
 * Synthesized sound effects using Web Audio API.
 * No external audio assets required — all sounds are generated from
 * oscillators and noise buffers at runtime.
 */
export class SfxManager {
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private ensureContext(): AudioContext | null {
    try {
      if (!this.ctx) {
        this.ctx = new (window.AudioContext ||
          (window as any).webkitAudioContext)();
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  private getNoiseBuffer(): AudioBuffer | null {
    const ctx = this.ensureContext();
    if (!ctx) return null;
    if (!this.noiseBuffer) {
      const sr = ctx.sampleRate;
      const len = sr; // 1 second of white noise
      this.noiseBuffer = ctx.createBuffer(1, len, sr);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) {
        data[i] = Math.random() * 2 - 1;
      }
    }
    return this.noiseBuffer;
  }

  /** Play a simple tone with attack/decay envelope. */
  private tone(
    freq: number,
    dur: number,
    vol: number,
    type: OscillatorType = 'sine',
    attack = 0.01,
    delay = 0
  ): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const t = ctx.currentTime + delay;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + attack);
    gain.gain.linearRampToValueAtTime(0, t + dur);
    osc.start(t);
    osc.stop(t + dur);
  }

  /** Play a filtered noise burst. */
  private noise(
    dur: number,
    vol: number,
    filterFreq = 4000,
    delay = 0
  ): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const buf = this.getNoiseBuffer();
    if (!buf) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    const t = ctx.currentTime + delay;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.linearRampToValueAtTime(0, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(t);
    src.stop(t + dur);
  }

  /** Soft click on each keystroke. */
  typeLetter(): void {
    this.tone(600 + Math.random() * 300, 0.06, 0.08, 'sine', 0.005);
  }

  /** Rising whoosh when word launches. */
  launch(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.connect(gain);
    gain.connect(ctx.destination);
    const t = ctx.currentTime;
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.exponentialRampToValueAtTime(800, t + 0.25);
    gain.gain.setValueAtTime(0.1, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.3);
    osc.start(t);
    osc.stop(t + 0.3);
    this.noise(0.25, 0.05, 2000);
  }

  /** Low thud on normal impact. */
  impactSmall(): void {
    this.tone(80, 0.15, 0.15, 'sine', 0.005);
    this.noise(0.1, 0.06, 500);
  }

  /** Heavy boom on fire/super impact. */
  impactBig(): void {
    this.tone(50, 0.3, 0.2, 'sine', 0.005);
    this.tone(35, 0.4, 0.08, 'triangle', 0.01);
    this.noise(0.2, 0.1, 800);
  }

  /** Gentle descending two-note for wrong answer. */
  error(): void {
    this.tone(400, 0.12, 0.08, 'sine', 0.01);
    this.tone(300, 0.15, 0.06, 'sine', 0.01, 0.12);
  }

  /** Ascending C-E-G-C arpeggio for level/game complete. */
  victory(): void {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => {
      this.tone(f, 0.2, 0.12, 'sine', 0.01, i * 0.12);
    });
  }

  /** Quick ascending pings when building crosses threshold. */
  thresholdCross(): void {
    this.tone(600, 0.1, 0.1, 'sine', 0.005);
    this.tone(800, 0.1, 0.1, 'sine', 0.005, 0.08);
    this.tone(1000, 0.1, 0.1, 'sine', 0.005, 0.16);
  }

  destroy(): void {
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
    this.noiseBuffer = null;
  }
}
