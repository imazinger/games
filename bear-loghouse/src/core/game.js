import {
  COLS, ROWS, BLUEPRINT, START_TOKENS, MAX_TOKENS, HISTORY_LIMIT, NEED_LOOKAHEAD,
} from './config.js';
import { RNG } from './rng.js';
import { Board } from './board.js';
import { House } from './house.js';
import { PieceQueue } from './pieces.js';
import { History } from './history.js';

// ゲーム本体(純ロジック・DOM非依存)。
// フェーズ: idle(操作待ち) / dropping(落下演出中) / topout / finished / gameover
export class Game {
  constructor(seed = Date.now()) {
    this.rng = new RNG(seed);
    this.board = new Board(COLS, ROWS);
    this.house = new House(BLUEPRINT);
    this.queue = new PieceQueue(this.rng, () => this.house.upcomingNeeds(NEED_LOOKAHEAD));
    this.history = new History(HISTORY_LIMIT);
    this.tokens = START_TOKENS;
    this.moves = 0;
    this.active = null;
    this.phase = 'idle';
    // 連続タイムバック中フラグ。開始時に1個だけ消費し、
    // パズル操作(掴む・移動・落下)を行った時点でセッション確定。
    this.rewindSession = false;
    this.spawn();
  }

  spawn() {
    const piece = this.queue.next();
    this.active = { piece, col: Math.floor((COLS - piece.w) / 2) };
    this.phase = 'idle';
  }

  moveTo(col) {
    if (this.phase !== 'idle' || !this.active) return;
    this.rewindSession = false; // 操作した時点で連続タイムバックを確定
    const max = COLS - this.active.piece.w;
    this.active.col = Math.max(0, Math.min(max, col));
  }

  ghostRow() {
    if (!this.active) return -1;
    return this.board.landingRow(this.active.col, this.active.piece.w);
  }

  // どこかの列に置ける余地があるか(=積み上がり判定)
  anyPlacement() {
    const w = this.active.piece.w;
    for (let c = 0; c <= COLS - w; c++) if (this.board.landingRow(c, w) >= 0) return true;
    return false;
  }

  canRewind() {
    if (this.history.size === 0) return false;
    if (this.phase !== 'idle' && this.phase !== 'topout') return false;
    return this.rewindSession || this.tokens > 0; // 連続中は追加消費なし
  }

  // 指を離した瞬間。落下情報を返す(演出は呼び出し側)
  drop() {
    if (this.phase !== 'idle') return null;
    this.rewindSession = false; // 操作した時点で連続タイムバックを確定
    const { piece, col } = this.active;
    const row = this.board.landingRow(col, piece.w);
    if (row < 0) {
      if (this.anyPlacement()) return { rejected: true }; // その列だけ置けない
      this.phase = 'topout'; // どこにも置けない
      return { topOut: true };
    }
    this.history.push(this.snapshot());
    this.phase = 'dropping';
    return { topOut: false, rejected: false, row, col, piece };
  }

  // 落下演出の完了後に確定。列回収・建築・実の判定まで行う
  lock() {
    if (this.phase !== 'dropping') return null;
    const { piece, col } = this.active;
    const row = this.board.landingRow(col, piece.w);
    this.board.place(piece, col, row);
    this.moves++;

    const rows = this.board.fullRows().sort((a, b) => b - a); // 下の列から建てる
    const result = { row, col, piece, cleared: [], tokensEarned: 0, completed: false };
    for (const r of rows) {
      const cells = this.board.rowCells(r);
      const berry = cells.some((c) => c && c.berry);
      const build = this.house.build(cells);
      if (berry && this.tokens < MAX_TOKENS) {
        this.tokens++;
        result.tokensEarned++;
      }
      result.cleared.push({ rowIndex: r, cells, berry, build });
    }
    if (rows.length) this.board.clearRows(rows);

    if (this.house.isComplete) {
      this.phase = 'finished';
      this.active = null;
      result.completed = true;
      result.score = this.house.score();
    } else {
      this.spawn();
    }
    return result;
  }

  // タイムバック: セッション開始時のみトークンを1消費し、
  // 連続で押している間は無料でさらに過去へ戻れる
  rewind() {
    if (!this.canRewind()) return null;
    if (!this.rewindSession) {
      this.tokens--;
      this.rewindSession = true;
    }
    const s = this.history.pop();
    this.board.restore(s.board);
    this.house.restore(s.house);
    this.queue.restore(s.queue);
    this.active = { piece: { ...s.active.piece }, col: s.active.col };
    this.moves = s.moves;
    this.phase = 'idle';
    return s;
  }

  forceGameOver() { this.phase = 'gameover'; }

  snapshot() {
    return {
      board: this.board.snapshot(),
      house: this.house.snapshot(),
      queue: this.queue.snapshot(),
      active: { piece: { ...this.active.piece }, col: this.active.col },
      moves: this.moves,
    };
  }
}
