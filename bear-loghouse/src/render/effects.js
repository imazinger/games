// 演出の状態管理(パーティクル・クマの運搬・画面揺れ・巻き戻しフラッシュなど)。
// ゲームロジックには一切影響しない。
const BEAR_WALK_SEC = 1.05;

export class Effects {
  constructor() {
    this.onBuildArrive = null; // クマが家に到着した時のコールバック
    this.hardReset();
  }

  hardReset() {
    this.particles = [];
    this.floats = [];
    this.flashes = [];
    this.bears = [];
    this.shake = 0;
    this.rewindT = 0;
    this.housePopT = 0;
    this.landSquash = null;
  }

  update(dt) {
    this.shake = Math.max(0, this.shake - dt * 26);
    this.rewindT = Math.max(0, this.rewindT - dt * 2.2);
    this.housePopT = Math.max(0, this.housePopT - dt * 4);

    for (const p of this.particles) {
      p.t += dt;
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.particles = this.particles.filter((p) => p.t < p.life);

    for (const f of this.floats) f.t += dt;
    this.floats = this.floats.filter((f) => f.t < f.life);

    for (const f of this.flashes) f.t += dt;
    this.flashes = this.flashes.filter((f) => f.t < f.life);

    for (const b of this.bears) {
      b.elapsed += dt;
      const prog = (b.elapsed - b.delay) / BEAR_WALK_SEC;
      b.progress = Math.max(0, Math.min(1, prog));
      if (b.progress >= 1 && !b.done) {
        b.done = true;
        this.onBuildArrive?.(b);
      }
    }
    this.bears = this.bears.filter((b) => b.elapsed - b.delay < BEAR_WALK_SEC + 0.25);

    if (this.landSquash) {
      this.landSquash.t += dt;
      if (this.landSquash.t > 0.13) this.landSquash = null;
    }
  }

  addShake(v) { this.shake = Math.max(this.shake, v); }

  addDust(x, y, color, n = 8) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 30 + Math.random() * 90;
      this.particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 40,
        g: 260,
        r: 1.5 + Math.random() * 2.5,
        color,
        t: 0,
        life: 0.4 + Math.random() * 0.35,
      });
    }
  }

  addFloat(x, y, text, color = '#fff') {
    this.floats.push({ x, y, text, color, t: 0, life: 1.1 });
  }

  addFlash(rect) {
    this.flashes.push({ ...rect, t: 0, life: 0.28 });
  }

  addBear({ delay = 0, layerIndex, matched, type }) {
    this.bears.push({ delay, layerIndex, matched, type, elapsed: 0, progress: 0, done: false });
  }

  squash(info) { this.landSquash = { ...info, t: 0 }; }

  startRewind() { this.rewindT = 1; }
  housePop() { this.housePopT = 1; }

  // まだ家に到着していない建築数(家の見た目の段数を遅延させるため)
  pendingBuilds() { return this.bears.filter((b) => !b.done).length; }

  celebrate(x, y) {
    const colors = ['#ffd54d', '#ff8a65', '#81c784', '#64b5f6', '#f06292'];
    for (let i = 0; i < 26; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
      const sp = 90 + Math.random() * 180;
      this.particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        g: 300,
        r: 2 + Math.random() * 3,
        color: colors[i % colors.length],
        t: 0,
        life: 0.8 + Math.random() * 0.6,
      });
    }
  }
}
