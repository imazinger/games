import { PIECE_DEFS, BERRY_CHANCE, BERRY_PITY, PREVIEW_COUNT } from './config.js';

let nextId = 1;
export function makePiece(type, w, berry) {
  return { id: nextId++, type, w, berry };
}

// 木材の幅の出現比率 (1:2:3 ≒ 1:3:3)
const WOOD_WIDTH_TABLE = [1, 2, 2, 2, 3, 3, 3];

// ピース供給。設計図の「これから必要な特殊パーツ」を見て
// 不足していれば優先的に混ぜる(詰み防止の自己補正)
export class PieceQueue {
  constructor(rng, needsProvider) {
    this.rng = rng;
    this.needsProvider = needsProvider; // () => ['door', 'window', ...]
    this.items = [];
    this.sinceBerry = 0;
    this.refill();
  }

  refill() {
    while (this.items.length < PREVIEW_COUNT + 1) this.items.push(this.generate());
  }

  generate() {
    const needs = this.needsProvider();
    const demand = {};
    for (const t of needs) demand[t] = (demand[t] || 0) + 1;
    for (const p of this.items) if (demand[p.type]) demand[p.type]--;
    const deficient = Object.keys(demand).filter((t) => demand[t] > 0);

    let type = 'wood';
    if (deficient.length && this.rng.chance(0.55)) type = deficient[0];

    const w = type === 'wood' ? this.rng.pick(WOOD_WIDTH_TABLE) : PIECE_DEFS[type].w;

    let berry = this.rng.chance(BERRY_CHANCE);
    this.sinceBerry++;
    if (this.sinceBerry >= BERRY_PITY) berry = true;
    if (berry) this.sinceBerry = 0;

    return makePiece(type, w, berry);
  }

  next() {
    const p = this.items.shift();
    this.refill();
    return p;
  }

  preview() { return this.items.slice(0, PREVIEW_COUNT); }

  snapshot() {
    return {
      items: this.items.map((p) => ({ ...p })),
      sinceBerry: this.sinceBerry,
      rng: this.rng.state,
    };
  }

  restore(s) {
    this.items = s.items.map((p) => ({ ...p }));
    this.sinceBerry = s.sinceBerry;
    this.rng.state = s.rng;
  }
}
