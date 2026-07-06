// リバーシのルールエンジン(純ロジック・DOM/通信に依存しない)
export const EMPTY = 0;
export const BROWN = 1; // 茶くま(先手・黒に相当)
export const WHITE = 2; // しろくま(後手・白に相当)
export const SIZE = 8;

const DIRS = [-9, -8, -7, -1, 1, 7, 8, 9];

export function initialBoard() {
  const b = new Array(64).fill(EMPTY);
  b[27] = WHITE;
  b[28] = BROWN;
  b[35] = BROWN;
  b[36] = WHITE;
  return b;
}

export function opponent(player) {
  return player === BROWN ? WHITE : BROWN;
}

// idx から dir 方向に1マス進む。盤外・左右ラップなら -1
function step(idx, dir) {
  const next = idx + dir;
  if (next < 0 || next >= 64) return -1;
  if (Math.abs((next % 8) - (idx % 8)) > 1) return -1;
  return next;
}

// idx に player が打ったときに裏返る石のインデックス一覧。打てないなら []
export function flipsFor(board, player, idx) {
  if (board[idx] !== EMPTY) return [];
  const opp = opponent(player);
  const flips = [];
  for (const dir of DIRS) {
    const line = [];
    let j = step(idx, dir);
    while (j !== -1 && board[j] === opp) {
      line.push(j);
      j = step(j, dir);
    }
    if (line.length && j !== -1 && board[j] === player) {
      flips.push(...line);
    }
  }
  return flips;
}

export function legalMoves(board, player) {
  const moves = [];
  for (let i = 0; i < 64; i++) {
    if (board[i] === EMPTY && flipsFor(board, player, i).length) moves.push(i);
  }
  return moves;
}

// 打てる手なら新しい盤面を返す。打てないなら null
export function applyMove(board, player, idx) {
  const flips = flipsFor(board, player, idx);
  if (!flips.length) return null;
  const next = board.slice();
  next[idx] = player;
  for (const f of flips) next[f] = player;
  return { board: next, flips };
}

export function countStones(board) {
  let brown = 0;
  let white = 0;
  for (const c of board) {
    if (c === BROWN) brown++;
    else if (c === WHITE) white++;
  }
  return { brown, white };
}

// mover が打った直後の手番を決める。
// 相手が打てれば相手、打てなければパスで mover 続行、両者打てなければ終局。
export function resolveTurn(board, mover) {
  const opp = opponent(mover);
  if (legalMoves(board, opp).length) return { turn: opp, passed: false, over: false };
  if (legalMoves(board, mover).length) return { turn: mover, passed: true, over: false };
  return { turn: EMPTY, passed: false, over: true };
}

// 終局時の勝者。BROWN / WHITE / EMPTY(引き分け)
export function winner(board) {
  const { brown, white } = countStones(board);
  if (brown > white) return BROWN;
  if (white > brown) return WHITE;
  return EMPTY;
}

export function boardToString(board) {
  return board.join("");
}

export function boardFromString(s) {
  return Array.from(s, Number);
}
