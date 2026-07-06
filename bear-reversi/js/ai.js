// CPU(しろくま)の思考ルーチン。
// 序中盤は位置の重み+打てる手の多さで評価する alpha-beta 探索、終盤は石差を読み切る
import { EMPTY, opponent, legalMoves, applyMove, countStones } from "./game.js";

// 定番の位置評価: 角が最強、角のとなり(X/C打ち)は危険
const WEIGHTS = [
  100, -20, 10, 5, 5, 10, -20, 100,
  -20, -50, -2, -2, -2, -2, -50, -20,
  10, -2, 3, 1, 1, 3, -2, 10,
  5, -2, 1, 0, 0, 1, -2, 5,
  5, -2, 1, 0, 0, 1, -2, 5,
  10, -2, 3, 1, 1, 3, -2, 10,
  -20, -50, -2, -2, -2, -2, -50, -20,
  100, -20, 10, 5, 5, 10, -20, 100,
];

const MIDGAME_DEPTH = 3;
const ENDGAME_EMPTIES = 10; // 残りこれ以下なら終局まで読む

function evaluate(board, me) {
  const opp = opponent(me);
  let score = 0;
  for (let i = 0; i < 64; i++) {
    if (board[i] === me) score += WEIGHTS[i];
    else if (board[i] === opp) score -= WEIGHTS[i];
  }
  score += 6 * (legalMoves(board, me).length - legalMoves(board, opp).length);
  return score;
}

function finalScore(board, me) {
  const { brown, white } = countStones(board);
  const diff = me === 1 ? brown - white : white - brown;
  return diff * 1000; // 終局の石差は評価値より常に優先
}

function search(board, player, me, depth, alpha, beta) {
  const moves = legalMoves(board, player);
  if (!moves.length) {
    if (!legalMoves(board, opponent(player)).length) return finalScore(board, me);
    return search(board, opponent(player), me, depth, alpha, beta); // パス
  }
  if (depth <= 0) return evaluate(board, me);

  const maximizing = player === me;
  let best = maximizing ? -Infinity : Infinity;
  for (const move of moves) {
    const next = applyMove(board, player, move).board;
    const value = search(next, opponent(player), me, depth - 1, alpha, beta);
    if (maximizing) {
      best = Math.max(best, value);
      alpha = Math.max(alpha, value);
    } else {
      best = Math.min(best, value);
      beta = Math.min(beta, value);
    }
    if (beta <= alpha) break;
  }
  return best;
}

export function bestMove(board, me) {
  const moves = legalMoves(board, me);
  if (!moves.length) return -1;
  const empties = board.filter((c) => c === EMPTY).length;
  const depth = empties <= ENDGAME_EMPTIES ? empties : MIDGAME_DEPTH;

  let best = moves[0];
  let bestValue = -Infinity;
  for (const move of moves) {
    const next = applyMove(board, me, move).board;
    const value = search(next, opponent(me), me, depth - 1, -Infinity, Infinity);
    if (value > bestValue) {
      bestValue = value;
      best = move;
    }
  }
  return best;
}
