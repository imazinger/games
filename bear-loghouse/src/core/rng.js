// 状態を snapshot/restore できる決定論的乱数 (mulberry32)
export class RNG {
  constructor(seed = Date.now()) {
    this.a = seed >>> 0;
  }
  next() {
    this.a = (this.a + 0x6D2B79F5) | 0;
    let t = Math.imul(this.a ^ (this.a >>> 15), 1 | this.a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  chance(p) { return this.next() < p; }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  get state() { return this.a; }
  set state(v) { this.a = v >>> 0; }
}
