// 轻量 WebAudio 音效合成器：不依赖任何音频文件，开炮/爆炸/命中全部实时合成
class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private lastPing = 0;

  /** 浏览器自动播放策略：必须在用户首次交互时调用 */
  init(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.4;
    this.master.connect(this.ctx.destination);
    const len = Math.floor(this.ctx.sampleRate * 0.8);
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  private ok(): boolean {
    return !!(this.ctx && this.master && this.noiseBuf);
  }

  private noise(type: BiquadFilterType, freq: number, gain: number, dur: number, delay = 0): void {
    if (!this.ok()) return;
    const ctx = this.ctx!;
    const t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf!;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(this.master!);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  private tone(
    type: OscillatorType,
    f0: number,
    f1: number,
    gain: number,
    dur: number,
    delay = 0,
  ): void {
    if (!this.ok()) return;
    const ctx = this.ctx!;
    const t0 = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(this.master!);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  shoot(): void {
    this.noise('bandpass', 750, 0.55, 0.16);
    this.tone('sine', 140, 42, 0.6, 0.18);
  }

  enemyShoot(): void {
    this.noise('bandpass', 520, 0.22, 0.12);
    this.tone('sine', 100, 48, 0.28, 0.13);
  }

  rifle(): void {
    this.noise('bandpass', 1400, 0.1, 0.05);
  }

  boom(big: boolean): void {
    if (big) {
      this.noise('lowpass', 420, 0.7, 0.7);
      this.tone('sine', 66, 24, 0.65, 0.55);
    } else {
      this.noise('lowpass', 560, 0.45, 0.45);
      this.tone('sine', 90, 30, 0.4, 0.35);
    }
  }

  ping(): void {
    const now = performance.now();
    if (now - this.lastPing < 70) return; // 命中音节流，避免糊成一片
    this.lastPing = now;
    this.tone('square', 960, 320, 0.09, 0.07);
    this.tone('square', 1440, 480, 0.06, 0.06);
  }

  pickup(): void {
    this.tone('sine', 620, 620, 0.2, 0.09);
    this.tone('sine', 930, 930, 0.2, 0.12, 0.09);
  }

  hurt(): void {
    this.tone('sawtooth', 190, 70, 0.24, 0.2);
  }
}

export const sfx = new Sfx();
