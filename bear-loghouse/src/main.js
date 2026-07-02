import { Game } from './core/game.js';
import { COLS } from './core/config.js';
import { PointerInput } from './input/pointer.js';
import { Renderer } from './render/renderer.js';
import { Effects } from './render/effects.js';
import { Sound } from './audio/sound.js';
import { HUD } from './ui/hud.js';

const canvas = document.getElementById('game');
const renderer = new Renderer(canvas);
const effects = new Effects();
const sound = new Sound();

let game = new Game();
let pendingResult = null;
let resultTimer = 0;

// 描画用のビュー状態(ロジックとは分離)
const view = {
  pieceX: null,   // 待機ピースの表示x(スムージング)
  tilt: 0,        // ドラッグ方向への傾き
  grabbing: false,
  grabOffset: 0,
  dropAnim: null, // { x, y0, y1, t, dur, piece, res }
  hint: true,
};

const hud = new HUD({
  onRewind: attemptRewind,
  onRestart: restart,
  onMute: () => { sound.muted = !sound.muted; return sound.muted; },
});

function grid() { return renderer.layout.grid; }
function pieceTargetX() { return grid().x + game.active.col * grid().cell; }

effects.onBuildArrive = () => {
  sound.play('build');
  const p = renderer.housePoint();
  effects.addDust(p.x, p.y, '#e0b46a', 8);
  effects.housePop();
};

// ================= 入力 =================
function handleGrab(p) {
  sound.init();
  if (game.phase !== 'idle' || !game.active) return;
  view.grabbing = true;
  const g = grid();
  const center = view.pieceX + game.active.piece.w * g.cell / 2;
  // ピースの近くを掴んだ時はオフセットを保持(指の下にピースが吸い付く感覚)
  view.grabOffset = Math.abs(p.x - center) < g.cell * 2.4 ? p.x - center : 0;
  sound.play('grab');
  handleMove(p);
}

function handleMove(p) {
  if (!view.grabbing || game.phase !== 'idle') return;
  const g = grid();
  const w = game.active.piece.w;
  const col = Math.round((p.x - view.grabOffset - g.x) / g.cell - w / 2);
  const prev = game.active.col;
  game.moveTo(col);
  if (game.active.col !== prev) sound.play('tick');
}

function handleRelease() {
  if (!view.grabbing) return;
  view.grabbing = false;
  if (game.phase !== 'idle') return;
  const res = game.drop();
  if (!res) return;
  if (res.rejected) {
    sound.play('reject');
    effects.addShake(4);
    hud.toast('ここには おけない!');
    return;
  }
  if (res.topOut) {
    onTopOut();
    return;
  }
  view.hint = false;
  startDropAnim(res);
}

new PointerInput(canvas, {
  onGrab: handleGrab,
  onMove: handleMove,
  onRelease: handleRelease,
  onCancel: () => { view.grabbing = false; },
});

// ================= 落下 → 確定 =================
function startDropAnim(res) {
  const g = grid();
  view.dropAnim = {
    x: g.x + res.col * g.cell,
    y0: renderer.hoverPieceY(),
    y1: g.y + res.row * g.cell,
    t: 0,
    dur: Math.min(0.3, 0.09 + 0.02 * (res.row + 1)),
    piece: res.piece,
    res,
  };
}

function finishDrop(res) {
  const out = game.lock();
  if (!out) return;
  const g = grid();

  sound.play('drop');
  effects.addShake(res.row > 5 ? 2 : 3);
  effects.squash({ col: res.col, row: res.row, piece: res.piece });
  effects.addDust(
    g.x + (res.col + res.piece.w / 2) * g.cell,
    g.y + (res.row + 1) * g.cell,
    '#cbb490', 6,
  );

  if (out.cleared.length) {
    sound.play('clear');
    let missed = null;
    out.cleared.forEach((cl, i) => {
      const fy = g.y + cl.rowIndex * g.cell;
      effects.addFlash({ x: g.x, y: fy, w: g.cell * COLS, h: g.cell });
      effects.addDust(g.x + g.cell * COLS / 2, fy + g.cell / 2, '#ffe9a8', 14);
      if (cl.build) {
        effects.addBear({
          delay: 0.15 + i * 0.35,
          layerIndex: cl.build.index,
          matched: cl.build.matched,
          type: cl.build.layer.type,
        });
        if (!cl.build.matched) missed = cl.build.layer;
      }
    });
    // 必要パーツなしで建ってしまった → その場で気付かせて巻き戻しを促す
    if (missed) {
      sound.play('miss');
      effects.addFloat(g.x + g.cell * COLS / 2, g.y + g.cell * 3.2, `✕ ${missed.label}が ない…`, '#d84343');
      if (game.canRewind()) hud.toast('⏪ タイムバックで やりなおせるよ');
    }
  }

  if (out.tokensEarned > 0) {
    sound.play('token');
    effects.addFloat(g.x + g.cell * COLS / 2, g.y + g.cell * 2, '⏪ タイムバックけん +1', '#e07b1a');
  }

  if (out.completed) {
    pendingResult = out.score;
    const hp = renderer.housePoint();
    effects.celebrate(hp.x, hp.y);
  }

  // 新しいピースは中央から(スムージングさせず即時配置)
  if (game.active) view.pieceX = pieceTargetX();
}

// ================= タイムバック / つみあげすぎ =================
function attemptRewind() {
  const wasSession = game.rewindSession;
  const s = game.rewind();
  if (!s) {
    if (game.phase !== 'idle' && game.phase !== 'topout') return;
    if (game.history.size === 0) hud.toast('これいじょう もどれない!');
    else if (game.tokens <= 0) hud.toast('タイムバックけんが ない! 🍒の れつを そろえよう');
    return;
  }
  if (!wasSession) hud.toast('つづけて おすと もっと もどれるよ');
  sound.play('rewind');
  effects.startRewind();
  effects.bears = []; // 運搬中のクマも巻き戻す
  hud.pulseRewind(false);
  pendingResult = null;
  resultTimer = 0;
  view.dropAnim = null;
  view.pieceX = pieceTargetX();
}

function onTopOut() {
  sound.play('reject');
  effects.addShake(5);
  if (game.canRewind()) {
    hud.toast('⏪ タイムバックで もどろう!');
    hud.pulseRewind(true);
  } else {
    game.forceGameOver();
    setTimeout(() => {
      sound.play('fail');
      hud.showResult(game.house.score(), game.house.layers, true);
    }, 700);
  }
}

function restart() {
  game = new Game();
  effects.hardReset();
  pendingResult = null;
  resultTimer = 0;
  view.dropAnim = null;
  view.grabbing = false;
  view.pieceX = pieceTargetX();
  hud.pulseRewind(false);
  hud.hideOverlay();
}

// ================= メインループ =================
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  renderer.resizeIfNeeded();

  if (view.pieceX === null && game.active) view.pieceX = pieceTargetX();

  // 待機ピースのスムージング(掴んでいる時はキビキビ追従)
  if (game.active && !view.dropAnim) {
    const target = pieceTargetX();
    const k = view.grabbing ? 26 : 15;
    view.pieceX += (target - view.pieceX) * Math.min(1, dt * k);
    view.tilt = Math.max(-0.13, Math.min(0.13, (target - view.pieceX) * 0.006));
  } else {
    view.tilt = 0;
  }

  // 落下アニメーション
  if (view.dropAnim) {
    view.dropAnim.t += dt;
    if (view.dropAnim.t >= view.dropAnim.dur) {
      const res = view.dropAnim.res;
      view.dropAnim = null;
      finishDrop(res);
    }
  }

  effects.update(dt);

  // 完成: クマが運び終わってから結果を出す
  if (pendingResult && !view.dropAnim && effects.pendingBuilds() === 0) {
    resultTimer += dt;
    if (resultTimer > 0.9) {
      const score = pendingResult;
      pendingResult = null;
      sound.play(score.cleared ? 'complete' : 'fail');
      hud.showResult(score, game.house.layers);
    }
  } else {
    resultTimer = 0;
  }

  hud.update(game);
  renderer.draw(game, effects, view, now / 1000);
  requestAnimationFrame(frame);
}

hud.showStart(() => sound.init());
requestAnimationFrame(frame);

// ================= デバッグ用フック =================
// 自動で1手打つ(検証用)。ゲーム性には影響しない。
function autoStep() {
  if (game.phase !== 'idle') return false;
  const w = game.active.piece.w;
  let best = null;
  for (let c = 0; c <= COLS - w; c++) {
    const r = game.board.landingRow(c, w);
    if (r >= 0 && (!best || r > best.r)) best = { c, r };
  }
  if (!best) return false;
  game.moveTo(best.c);
  const res = game.drop();
  if (!res || res.topOut || res.rejected) return false;
  view.dropAnim = null;
  finishDrop({ row: res.row, col: res.col, piece: res.piece });
  return true;
}

window.__game = {
  get g() { return game; },
  effects,
  autoStep,
  restart,
};
