// WebAudio の簡易シンセ効果音。iOS ではユーザー操作後に init() が必要。
export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  init() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  tone(freq, dur, { type = 'sine', gain = 0.12, delay = 0, slide = 0 } = {}) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g).connect(this.ctx.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  noise(dur = 0.08, { gain = 0.2, delay = 0 } = {}) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(g).connect(this.ctx.destination);
    src.start(t0);
  }

  play(name) {
    switch (name) {
      case 'grab': this.tone(700, 0.05, { type: 'triangle', gain: 0.07 }); break;
      case 'tick': this.tone(1150, 0.03, { type: 'square', gain: 0.025 }); break;
      case 'drop':
        this.noise(0.07, { gain: 0.22 });
        this.tone(130, 0.1, { gain: 0.22, slide: -60 });
        break;
      case 'reject': this.tone(220, 0.12, { type: 'square', gain: 0.07, slide: -80 }); break;
      case 'clear':
        [523, 659, 784].forEach((f, i) => this.tone(f, 0.12, { type: 'triangle', delay: i * 0.06 }));
        break;
      case 'token':
        [880, 1318].forEach((f, i) => this.tone(f, 0.15, { delay: i * 0.08 }));
        break;
      case 'build':
        this.tone(190, 0.06, { type: 'square', gain: 0.1 });
        this.tone(160, 0.06, { type: 'square', gain: 0.08, delay: 0.09 });
        break;
      case 'miss':
        this.tone(240, 0.14, { type: 'square', gain: 0.07, slide: -60 });
        this.tone(180, 0.18, { type: 'square', gain: 0.06, slide: -50, delay: 0.14 });
        break;
      case 'rewind': this.tone(900, 0.35, { type: 'sawtooth', gain: 0.07, slide: -650 }); break;
      case 'complete':
        [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.2, { type: 'triangle', delay: i * 0.12 }));
        break;
      case 'fail':
        this.tone(300, 0.25, { type: 'sawtooth', gain: 0.07, slide: -120 });
        this.tone(200, 0.3, { type: 'sawtooth', gain: 0.07, slide: -80, delay: 0.2 });
        break;
      default: break;
    }
  }
}
