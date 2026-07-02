// ゲーム全体の定数・チューニング値
export const COLS = 7;
export const ROWS = 11;

// widths は幅の抽選テーブル(重複で出現比率を表す)
export const PIECE_DEFS = {
  wood:   { widths: [1, 2, 2, 2, 3, 3, 3] }, // 1:2:3 ≒ 1:3:3
  window: { widths: [2] },
  door:   { widths: [2] },
  roof:   { widths: [2, 3] }, // 7マス盤面で 3+2+2 などの組み合わせを作れるように
};

// 設計図: 下から順に建てていく(index 0 が最下段)
export const BLUEPRINT = [
  { type: 'wood',   label: '土台' },
  { type: 'wood',   label: '壁' },
  { type: 'door',   label: 'ドア' },
  { type: 'wood',   label: '壁' },
  { type: 'window', label: '窓' },
  { type: 'wood',   label: '壁' },
  { type: 'window', label: '窓' },
  { type: 'wood',   label: '壁' },
  { type: 'roof',   label: '屋根' },
  { type: 'roof',   label: '屋根' },
];

export const CLEAR_RATE = 0.9;    // 一致率がこれ以上でステージクリア
export const BERRY_CHANCE = 0.16; // 実付きピースの出現率
export const BERRY_PITY = 7;      // 実なしがこの数続いたら強制的に実を付ける
export const START_TOKENS = 1;
export const MAX_TOKENS = 3;
// タイムバックで遡れる最大手数。
// スナップショットは実測で1手≈2KB(JSON)・ヒープ実体でも≈6KB程度のため、
// 64手でも最大約0.4MBと軽く、端末別の切り替えは不要(全端末共通)。
export const HISTORY_LIMIT = 64;
export const NEED_LOOKAHEAD = 4;  // ピース供給が参照する設計図の先読み段数
export const PREVIEW_COUNT = 3;
