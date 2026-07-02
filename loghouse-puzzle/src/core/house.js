import { CLEAR_RATE } from './config.js';

// ログハウス。回収された列を下から順に「段」として建てていく。
// 段の必要パーツ(窓・ドア・屋根)がその列に含まれていれば一致。
export class House {
  constructor(blueprint) {
    this.layers = blueprint.map((l) => ({ type: l.type, label: l.label, built: false, matched: null }));
    this.next = 0; // 次に建てる段の index
  }

  get isComplete() { return this.next >= this.layers.length; }

  nextLayer() { return this.isComplete ? null : this.layers[this.next]; }

  // 回収された列(cells)で1段建てる。完成済みなら null
  build(cells) {
    if (this.isComplete) return null;
    const layer = this.layers[this.next];
    const matched = layer.type === 'wood' ? true : cells.some((c) => c && c.type === layer.type);
    layer.built = true;
    layer.matched = matched;
    const index = this.next;
    this.next++;
    return { index, layer, matched };
  }

  // 未建築の直近n段のうち、特殊パーツが必要なものの型リスト
  upcomingNeeds(n) {
    const out = [];
    for (let i = this.next; i < Math.min(this.layers.length, this.next + n); i++) {
      if (this.layers[i].type !== 'wood') out.push(this.layers[i].type);
    }
    return out;
  }

  score() {
    const total = this.layers.length;
    const correct = this.layers.filter((l) => l.built && l.matched).length;
    const rate = correct / total;
    return { total, correct, rate, cleared: rate >= CLEAR_RATE };
  }

  snapshot() { return { next: this.next, layers: this.layers.map((l) => ({ ...l })) }; }
  restore(s) { this.next = s.next; this.layers = s.layers.map((l) => ({ ...l })); }
}
