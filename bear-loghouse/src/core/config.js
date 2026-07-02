// ゲーム全体の定数・チューニング値
export const COLS = 7;
export const ROWS = 11;

export const PIECE_DEFS = {
  wood:   { minW: 1, maxW: 3 },
  window: { w: 2 },
  door:   { w: 2 },
  roof:   { w: 3 },
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
export const HISTORY_LIMIT = 16;  // タイムバックで遡れる最大手数
export const NEED_LOOKAHEAD = 4;  // ピース供給が参照する設計図の先読み段数
export const PREVIEW_COUNT = 3;
