"use strict";

/* ============================================================
   くまのソリティア
   - 4スート(Fire/Water/Leaf/Thunder) × A〜I(1〜9) + JOKER の37枚
   - タブロー6列 / フリーポケット3つ / 組札4
   - タブローはスートを問わず降順で重ねる
   - JOKERはワイルド: どこにでも置けて、上に何でも置ける
   ============================================================ */

const SUITS = ["Fire", "Water", "Leaf", "Thunder"];
const RANKS = ["A", "B", "C", "D", "E", "F", "G", "H", "I"];
const SUIT_ICON = { Fire: "🔥", Water: "💧", Leaf: "🍃", Thunder: "⚡", JOKER: "🃏" };
const RANK_VALUE = Object.fromEntries(RANKS.map((r, i) => [r, i + 1]));
const SUIT_INDEX = Object.fromEntries(SUITS.map((s, i) => [s, i]));
const COLS = 6;
const CELLS = 3;
const TEX_W = 320, TEX_H = 480;       // 縮小テクスチャ解像度(発熱・メモリ対策)
const SAVE_KEY = "bearFreecell.save.v1";
const BEST_KEY = "bearFreecell.best.v1";
const MUTE_KEY = "bearFreecell.muted";

const rankVal = (r) => RANK_VALUE[r];
const isWarm = (s) => s === "Fire" || s === "Thunder";

function cardImagePath(card) {
  return card.suit === "JOKER" ? "cards/JOKER.png" : `cards/${card.rank}_${card.suit}.png`;
}

/* ---------- DOM ---------- */
const board = document.getElementById("board");
const elScore = document.getElementById("stat-score");
const elMoves = document.getElementById("stat-moves");
const elTime = document.getElementById("stat-time");

/* ---------- 状態 ---------- */
let cards = [];                // 全カード
let cardById = new Map();
let columns, cells, foundations;
let history = [];
let moves = 0, score = 0, combo = 0;
let elapsedBase = 0, runStamp = null, timerId = null;
let busy = true;               // 配り中・演出中は入力禁止
let won = false;
let muted = localStorage.getItem(MUTE_KEY) === "1";

/* レイアウト値 */
const M = {};
let boardRect = null;
let slotEls = { cells: [], founds: [], colBases: [] };
const noAnimEls = new Set();
let noAnimRaf = null;
let relayoutRaf = null;
let autoSafeTimer = null;

/* ============================================================
   効果音 (WebAudio・合成音のみ)
   ============================================================ */
let audioCtx = null;
function ensureAudio() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* 無音で続行 */ }
  }
  if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
}
function tone(freq, dur, type = "sine", gain = 0.12, delay = 0) {
  if (muted || !audioCtx) return;
  const t = audioCtx.currentTime + delay;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(audioCtx.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}
const sndPick = () => tone(520, 0.05, "triangle", 0.08);
const sndDrop = () => tone(660, 0.07, "triangle", 0.10);
const sndError = () => tone(150, 0.15, "sawtooth", 0.08);
const sndFound = (n = 0) => { tone(660 + n * 40, 0.09, "sine", 0.12); tone(990 + n * 60, 0.12, "sine", 0.10, 0.06); };
const sndWin = () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.25, "triangle", 0.14, i * 0.12));

/* ============================================================
   テクスチャ準備 (1024×1536 → 320×480 に縮小して保持)
   ============================================================ */
function makeDeckList() {
  const list = [];
  for (const suit of SUITS) for (const rank of RANKS) list.push({ rank, suit });
  list.push({ rank: null, suit: "JOKER" });
  return list;
}

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function prepareTextures(onProgress) {
  const defs = makeDeckList();
  const jobs = defs.map((d) => ({ d, src: cardImagePath(d) }));
  jobs.push({ d: null, src: "cards/Back.png" });

  let done = 0;
  const results = await Promise.all(jobs.map(async (job) => {
    const img = await loadImage(job.src);
    done++;
    onProgress(done / jobs.length);
    return { job, img };
  }));

  const tex = new Map();
  let backURL = "";
  for (const { job, img } of results) {
    const cv = document.createElement("canvas");
    cv.width = TEX_W;
    cv.height = TEX_H;
    const ctx = cv.getContext("2d");
    if (img) {
      ctx.drawImage(img, 0, 0, TEX_W, TEX_H);
    } else {
      // 画像が読めなくても遊べるフォールバック
      ctx.fillStyle = "#fffdf5";
      ctx.fillRect(0, 0, TEX_W, TEX_H);
      ctx.fillStyle = "#6b4a2b";
      ctx.font = "bold 80px sans-serif";
      ctx.textAlign = "center";
      const d = job.d;
      ctx.fillText(d ? (d.rank || "J") : "?", TEX_W / 2, TEX_H / 2);
    }
    if (job.d === null) {
      backURL = cv.toDataURL("image/png");
    } else {
      const id = job.d.suit === "JOKER" ? "JOKER" : `${job.d.rank}_${job.d.suit}`;
      tex.set(id, cv);
    }
  }
  return { tex, backURL };
}

/* ============================================================
   カード生成
   ============================================================ */
function buildCards(tex, backURL) {
  const defs = makeDeckList();
  cards = defs.map((d) => {
    const id = d.suit === "JOKER" ? "JOKER" : `${d.rank}_${d.suit}`;
    const el = document.createElement("div");
    el.className = "card down no-anim";
    el.dataset.id = id;

    const inner = document.createElement("div");
    inner.className = "inner";

    const face = tex.get(id);
    face.className = "face";

    const back = document.createElement("img");
    back.className = "back";
    back.src = backURL;
    back.alt = "";
    back.draggable = false;

    const badge = document.createElement("div");
    badge.className = "badge";
    badge.textContent = SUIT_ICON[d.suit];

    inner.appendChild(face);
    inner.appendChild(back);
    el.appendChild(inner);
    el.appendChild(badge);
    board.appendChild(el);

    const card = { rank: d.rank, suit: d.suit, id, el, x: 0, y: 0, s: 1, z: 10 };
    cardById.set(id, card);
    return card;
  });
}

/* ============================================================
   レイアウト
   ============================================================ */
function computeMetrics() {
  const W = board.clientWidth;
  const H = board.clientHeight;
  M.boardW = W;
  M.boardH = H;
  M.gap = Math.min(8, Math.max(3, W * 0.012));
  // 幅と高さ(横画面)の両方からカード幅を決め、7枚の列が収まるようにする
  const byWidth = (W - M.gap * (COLS + 1)) / COLS;
  const byHeight = (H - M.gap * 3) / 5.4;
  M.cardW = Math.min(byWidth, byHeight);
  M.cardH = M.cardW * 1.5;
  const layoutW = M.cardW * COLS + M.gap * (COLS + 1);
  M.orx = (W - layoutW) / 2;
  const extra = ((layoutW - M.gap * 8) / 7.25) * 0.25;
  M.slotW = (layoutW - M.gap * 8 - extra) / 7;
  M.slotH = M.slotW * 1.5;
  M.slotExtra = extra;
  M.slotScale = M.slotW / M.cardW;
  M.topY = M.gap;
  M.tabY = M.topY + M.slotH + M.gap * 2;
  board.style.setProperty("--card-w", M.cardW + "px");
  boardRect = board.getBoundingClientRect();
}

const colX = (i) => M.orx + M.gap + i * (M.cardW + M.gap);
function slotX(i) {
  const base = M.orx + M.gap + i * (M.slotW + M.gap);
  return i < CELLS ? base : base + M.slotExtra;
}
function colOffset(n) {
  if (n <= 1) return 0;
  const avail = M.boardH - M.tabY - M.cardH - M.gap;
  return Math.max(10, Math.min(M.cardH * 0.30, avail / (n - 1)));
}

function buildSlots() {
  const mk = (cls, type, index, iconText, labelText) => {
    const s = document.createElement("div");
    s.className = "slot " + cls;
    s.dataset.type = type;
    s.dataset.index = index;
    if (iconText) {
      const ic = document.createElement("span");
      ic.className = "slot-icon";
      ic.textContent = iconText;
      s.appendChild(ic);
    }
    if (labelText) {
      const lb = document.createElement("span");
      lb.className = "slot-label";
      lb.textContent = labelText;
      s.appendChild(lb);
    }
    board.appendChild(s);
    return s;
  };
  for (let i = 0; i < CELLS; i++) slotEls.cells.push(mk("cell-slot", "cell", i, "", "FREE"));
  SUITS.forEach((suit, i) => slotEls.founds.push(mk("found-slot", "found", suit, SUIT_ICON[suit], "")));
  for (let i = 0; i < COLS; i++) slotEls.colBases.push(mk("col-base", "col", i, "", ""));
}

function positionSlots() {
  const set = (el, x, y, w, h) => {
    el.style.left = x + "px";
    el.style.top = y + "px";
    el.style.width = w + "px";
    el.style.height = h + "px";
  };
  slotEls.cells.forEach((el, i) => set(el, slotX(i), M.topY, M.slotW, M.slotH));
  slotEls.founds.forEach((el, i) => set(el, slotX(CELLS + i), M.topY, M.slotW, M.slotH));
  slotEls.colBases.forEach((el, i) => set(el, colX(i), M.tabY, M.cardW, M.cardH));
}

function computeLayout() {
  const pos = new Map();
  cells.forEach((c, i) => {
    if (c) pos.set(c.id, { x: slotX(i), y: M.topY, s: M.slotScale, z: 20 });
  });
  SUITS.forEach((suit, k) => {
    foundations[suit].forEach((c, j) => {
      pos.set(c.id, { x: slotX(CELLS + k), y: M.topY, s: M.slotScale, z: 10 + j });
    });
  });
  columns.forEach((col, ci) => {
    const off = colOffset(col.length);
    col.forEach((c, j) => {
      pos.set(c.id, { x: colX(ci), y: M.tabY + j * off, s: 1, z: 10 + j });
    });
  });
  return pos;
}

function queueNoAnimRemoval(el) {
  noAnimEls.add(el);
  if (noAnimRaf) return;
  noAnimRaf = requestAnimationFrame(() => {
    noAnimRaf = requestAnimationFrame(() => {
      noAnimEls.forEach((target) => target.classList.remove("no-anim"));
      noAnimEls.clear();
      noAnimRaf = null;
    });
  });
}

function applyPos(card, p, instant) {
  card.x = p.x; card.y = p.y; card.s = p.s; card.z = p.z;
  if (instant) card.el.classList.add("no-anim");
  if (card.w !== M.cardW) {
    card.w = M.cardW;
    card.el.style.width = M.cardW + "px";
  }
  if (card.h !== M.cardH) {
    card.h = M.cardH;
    card.el.style.height = M.cardH + "px";
  }
  card.el.style.transform = `translate3d(${p.x}px,${p.y}px,0) scale(${p.s})`;
  card.el.style.zIndex = p.z;
  if (instant) queueNoAnimRemoval(card.el);
}

function positionAll(instant = false, boostSeq = null) {
  const pos = computeLayout();
  const dragging = ptr && ptr.dragging ? new Set(ptr.pick.seq) : null;
  for (const card of cards) {
    if (dragging && dragging.has(card)) continue;
    const p = pos.get(card.id);
    if (p) applyPos(card, p, instant);
  }
  if (boostSeq) {
    // 移動中のカードは他より手前を通す
    boostSeq.forEach((c, k) => { c.el.style.zIndex = 600 + k; });
    setTimeout(() => boostSeq.forEach((c) => { c.el.style.zIndex = c.z; }), 280);
  }
}

function relayout() {
  if (!columns || !cells || !foundations) return;
  cancelDrag();
  computeMetrics();
  positionSlots();
  positionAll(true);
}

function scheduleRelayout() {
  if (relayoutRaf) return;
  relayoutRaf = requestAnimationFrame(() => {
    relayoutRaf = null;
    relayout();
  });
}

/* ============================================================
   ルール
   ============================================================ */
function canStack(card, onto) {
  if (card.suit === "JOKER" || onto.suit === "JOKER") return true;
  return rankVal(card.rank) === rankVal(onto.rank) - 1;
}
function isSeq(list) {
  for (let i = 0; i < list.length - 1; i++) {
    if (!canStack(list[i + 1], list[i])) return false;
  }
  return true;
}
const freeCellCount = () => cells.filter((c) => !c).length;
const emptyColCount = () => columns.filter((c) => c.length === 0).length;
const foundLen = (suit) => foundations[suit].length;

function findLoc(card) {
  for (let i = 0; i < CELLS; i++) if (cells[i] === card) return { type: "cell", index: i };
  for (const suit of SUITS) {
    const j = foundations[suit].indexOf(card);
    if (j >= 0) return { type: "found", suit, index: j };
  }
  for (let c = 0; c < COLS; c++) {
    const j = columns[c].indexOf(card);
    if (j >= 0) return { type: "col", col: c, index: j };
  }
  return null;
}

/* カードから持ち上げられる列 (無効なら null) */
function pickableSeq(card) {
  const loc = findLoc(card);
  if (!loc) return null;
  if (loc.type === "cell") return { seq: [card], loc };
  if (loc.type === "found") return null; // 組札からは戻せない
  const seq = columns[loc.col].slice(loc.index);
  if (!isSeq(seq)) return null;
  return { seq, loc };
}

/* 置ける場所の一覧 */
function computeTargets(seq, loc) {
  const targets = [];
  const head = seq[0];

  if (seq.length === 1) {
    if (head.suit !== "JOKER" && foundLen(head.suit) === rankVal(head.rank) - 1) {
      targets.push({ type: "found", suit: head.suit });
    }
    for (let i = 0; i < CELLS; i++) {
      if (!cells[i]) targets.push({ type: "cell", index: i });
    }
  }
  for (let c = 0; c < COLS; c++) {
    if (loc.type === "col" && loc.col === c) continue;
    const col = columns[c];
    if (col.length === 0) {
      targets.push({ type: "col", col: c, empty: true });
    } else if (canStack(head, col[col.length - 1])) {
      targets.push({ type: "col", col: c, empty: false });
    }
  }
  return targets;
}

function targetRect(t) {
  if (t.type === "cell") return { x: slotX(t.index), y: M.topY, w: M.slotW, h: M.slotH };
  if (t.type === "found") return { x: slotX(CELLS + SUIT_INDEX[t.suit]), y: M.topY, w: M.slotW, h: M.slotH };
  return { x: colX(t.col), y: M.tabY, w: M.cardW, h: M.boardH - M.tabY };
}

/* ============================================================
   移動の実行
   ============================================================ */
function removeSeq(seq, loc) {
  if (loc.type === "cell") cells[loc.index] = null;
  else if (loc.type === "col") columns[loc.col].splice(loc.index, seq.length);
}

function addSeq(seq, target) {
  if (target.type === "cell") cells[target.index] = seq[0];
  else if (target.type === "found") foundations[target.suit].push(seq[0]);
  else columns[target.col].push(...seq);
}

function snapshot() {
  return {
    columns: columns.map((col) => col.map((c) => c.id)),
    cells: cells.map((c) => (c ? c.id : null)),
    foundations: Object.fromEntries(SUITS.map((s) => [s, foundations[s].map((c) => c.id)])),
    moves, score, combo,
  };
}

function restoreSnapshot(sn) {
  columns = sn.columns.map((ids) => ids.map((id) => cardById.get(id)));
  cells = sn.cells.map((id) => (id ? cardById.get(id) : null));
  foundations = {};
  SUITS.forEach((s) => { foundations[s] = sn.foundations[s].map((id) => cardById.get(id)); });
  moves = sn.moves; score = sn.score; combo = sn.combo;
  updateStats();
}

/* 選択やドラッグの後に状態が変わっていないか確認して取り直す */
function validatePick(pick) {
  const head = pick.seq[0];
  const loc = findLoc(head);
  if (!loc) return null;
  if (loc.type === "cell") return pick.seq.length === 1 ? { seq: [head], loc } : null;
  if (loc.type !== "col") return null;
  const seq = columns[loc.col].slice(loc.index);
  if (seq.length !== pick.seq.length || seq.some((c, i) => c !== pick.seq[i])) return null;
  return { seq, loc };
}

function sameTarget(a, b) {
  return a.type === b.type &&
    (a.type === "cell" ? a.index === b.index : a.type === "found" ? a.suit === b.suit : a.col === b.col);
}

/* ユーザー操作としての移動 (Undo履歴・スコア・自動回収込み) */
function executeUserMove(rawPick, rawTarget) {
  // 自動回収などで状態が変わっている可能性があるため検証し直す
  const pick = validatePick(rawPick);
  const target = pick && computeTargets(pick.seq, pick.loc).find((t) => sameTarget(t, rawTarget));
  if (!pick || !target) {
    clearSelection();
    sndError();
    positionAll(false, rawPick.seq);
    return;
  }
  history.push(snapshot());
  if (history.length > 300) history.shift();

  removeSeq(pick.seq, pick.loc);
  addSeq(pick.seq, target);
  moves++;
  startTimer();

  if (target.type === "found") {
    combo++;
    const gain = 10 + (combo - 1) * 5;
    score += gain;
    sndFound(combo);
    if (combo >= 2) showComboPop(target, combo, gain);
  } else {
    combo = 0;
    sndDrop();
  }

  clearSelection();
  updateStats();
  positionAll(false, pick.seq);
  scheduleAutoSafeLoop(240);
}

/* 安全なカードを自動で組札へ */
function isSafeToFound(card) {
  if (card.suit === "JOKER") return false;
  const v = rankVal(card.rank);
  if (foundLen(card.suit) !== v - 1) return false;
  if (v <= 2) return true;
  const warm = isWarm(card.suit);
  const opp = SUITS.filter((s) => isWarm(s) !== warm);
  const same = SUITS.find((s) => s !== card.suit && isWarm(s) === warm);
  return opp.every((s) => foundLen(s) >= v - 1) && foundLen(same) >= v - 2;
}

function findAutoMove() {
  for (let i = 0; i < CELLS; i++) {
    if (cells[i] && isSafeToFound(cells[i])) return { card: cells[i], loc: { type: "cell", index: i } };
  }
  for (let c = 0; c < COLS; c++) {
    const col = columns[c];
    const top = col[col.length - 1];
    if (top && isSafeToFound(top)) return { card: top, loc: { type: "col", col: c, index: col.length - 1 } };
  }
  return null;
}

function autoSafeLoop() {
  autoSafeTimer = null;
  if (won) return;
  if (ptr && ptr.dragging) {
    // ドラッグ中は状態をいじらない
    scheduleAutoSafeLoop(300);
    return;
  }
  const m = findAutoMove();
  if (!m) {
    saveGame();
    checkWin();
    return;
  }
  removeSeq([m.card], m.loc);
  addSeq([m.card], { type: "found", suit: m.card.suit });
  combo++;
  const gain = 10 + (combo - 1) * 5;
  score += gain;
  sndFound(combo);
  if (combo >= 2) showComboPop({ type: "found", suit: m.card.suit }, combo, gain);
  updateStats();
  positionAll(false, [m.card]);
  scheduleAutoSafeLoop(170);
}

function scheduleAutoSafeLoop(delay) {
  if (autoSafeTimer) clearTimeout(autoSafeTimer);
  autoSafeTimer = setTimeout(autoSafeLoop, delay);
}

function showComboPop(target, comboN, gain) {
  const r = targetRect(target);
  const pop = document.createElement("div");
  pop.className = "combo-pop";
  pop.textContent = `コンボ×${comboN} +${gain}`;
  pop.style.left = Math.max(4, Math.min(M.boardW - 90, r.x - 20)) + "px";
  pop.style.top = (r.y + r.h * 0.6) + "px";
  board.appendChild(pop);
  setTimeout(() => pop.remove(), 950);
}

/* ============================================================
   選択・ハイライト
   ============================================================ */
let selection = null; // { pick, targets }
const highlightedEls = new Set();

function addHighlight(el, cls) {
  el.classList.add(cls);
  highlightedEls.add(el);
}

function clearHighlights() {
  highlightedEls.forEach((el) => el.classList.remove("hl", "hl-active", "hl-card", "hl-card-active"));
  highlightedEls.clear();
}

function highlightTargets(targets) {
  for (const t of targets) {
    if (t.type === "cell") addHighlight(slotEls.cells[t.index], "hl");
    else if (t.type === "found") {
      const pile = foundations[t.suit];
      if (pile.length) addHighlight(pile[pile.length - 1].el, "hl-card");
      else addHighlight(slotEls.founds[SUIT_INDEX[t.suit]], "hl");
    } else {
      const col = columns[t.col];
      if (col.length) addHighlight(col[col.length - 1].el, "hl-card");
      else addHighlight(slotEls.colBases[t.col], "hl");
    }
  }
}

function select(pick) {
  clearSelection();
  const targets = computeTargets(pick.seq, pick.loc);
  if (targets.length === 0) {
    pick.seq[0].el.classList.add("shake");
    setTimeout(() => pick.seq[0].el.classList.remove("shake"), 500);
    sndError();
    return;
  }
  selection = { pick, targets };
  pick.seq.forEach((c) => c.el.classList.add("selected"));
  highlightTargets(targets);
  sndPick();
}

function clearSelection() {
  if (selection) selection.pick.seq.forEach((c) => c.el.classList.remove("selected"));
  selection = null;
  clearHighlights();
}

/* タップした要素 → 対象ターゲット */
function targetFromElement(el, targets) {
  const slot = el.closest(".slot");
  if (slot) {
    const type = slot.dataset.type;
    return targets.find((t) =>
      (t.type === "cell" && type === "cell" && t.index === +slot.dataset.index) ||
      (t.type === "found" && type === "found" && t.suit === slot.dataset.index) ||
      (t.type === "col" && type === "col" && t.col === +slot.dataset.index)
    ) || null;
  }
  const cardEl = el.closest(".card");
  if (!cardEl) return null;
  const card = cardById.get(cardEl.dataset.id);
  const loc = findLoc(card);
  if (!loc) return null;
  if (loc.type === "col") return targets.find((t) => t.type === "col" && t.col === loc.col) || null;
  if (loc.type === "found") return targets.find((t) => t.type === "found" && t.suit === loc.suit) || null;
  return null;
}

/* 自動で一番良い場所へ */
function smartMove(pick) {
  const targets = computeTargets(pick.seq, pick.loc);
  const order = ["found", "colFull", "colEmpty", "cell"];
  const key = (t) => (t.type === "col" ? (t.empty ? "colEmpty" : "colFull") : t.type);
  targets.sort((a, b) => order.indexOf(key(a)) - order.indexOf(key(b)));
  if (targets.length) {
    executeUserMove(pick, targets[0]);
    return true;
  }
  return false;
}

/* ============================================================
   ポインタ入力 (タップ & ドラッグ)
   ============================================================ */
let ptr = null; // { id, startX, startY, pick, dragging, offX, offY, targets, lastActive }

function boardPoint(e) {
  return { x: e.clientX - boardRect.left, y: e.clientY - boardRect.top };
}

board.addEventListener("pointerdown", (e) => {
  ensureAudio();
  if (busy || won || ptr) return;
  const p = boardPoint(e);
  const cardEl = e.target.closest(".card");
  let pick = null;
  if (cardEl) pick = pickableSeq(cardById.get(cardEl.dataset.id));
  try { board.setPointerCapture(e.pointerId); } catch (err) { /* 未対応でも続行 */ }
  ptr = {
    id: e.pointerId,
    startX: p.x, startY: p.y,
    downEl: e.target,
    pick,
    dragging: false,
    lastActive: null,
  };
});

board.addEventListener("pointermove", (e) => {
  if (!ptr || e.pointerId !== ptr.id) return;
  const p = boardPoint(e);
  if (!ptr.dragging) {
    const dist = Math.hypot(p.x - ptr.startX, p.y - ptr.startY);
    if (dist < 9) return;
    if (!ptr.pick) return;
    beginDrag(p);
  }
  moveDrag(p);
});

board.addEventListener("pointerup", (e) => {
  if (!ptr || e.pointerId !== ptr.id) return;
  const p = boardPoint(e);
  if (ptr.dragging) endDrag(p);
  else handleTap(ptr.downEl);
  ptr = null;
});

board.addEventListener("pointercancel", (e) => {
  if (!ptr || e.pointerId !== ptr.id) return;
  cancelDrag();
  ptr = null;
});

board.addEventListener("contextmenu", (e) => e.preventDefault());

function beginDrag(p) {
  clearSelection();
  ptr.dragging = true;
  ptr.targets = computeTargets(ptr.pick.seq, ptr.pick.loc);
  highlightTargets(ptr.targets);
  const head = ptr.pick.seq[0];
  ptr.offX = p.x - head.x;
  ptr.offY = p.y - head.y;
  ptr.spread = M.cardH * 0.28;
  ptr.pick.seq.forEach((c, k) => {
    c.el.classList.add("dragging");
    c.el.style.zIndex = 800 + k;
  });
  sndPick();
}

let rafPending = false;
function moveDrag(p) {
  ptr.px = p.x; ptr.py = p.y;
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => {
    rafPending = false;
    if (!ptr || !ptr.dragging) return;
    const hx = ptr.px - ptr.offX;
    const hy = ptr.py - ptr.offY;
    ptr.pick.seq.forEach((c, k) => {
      c.el.style.transform = `translate3d(${hx}px,${hy + k * ptr.spread}px,0) scale(1)`;
    });
    updateActiveTarget(hx + M.cardW / 2, hy + M.cardH / 2);
  });
}

function hitTarget(cx, cy, targets) {
  const pad = 14;
  let best = null;
  for (const t of targets) {
    const r = targetRect(t);
    const sx = r.x - pad, sy = r.y - pad, ex = r.x + r.w + pad, ey = r.y + r.h + pad;
    if (cx >= sx && cx <= ex && cy >= sy && cy <= ey) {
      // 複数当たったら中心が近いほうを採用
      const d = Math.hypot(cx - (r.x + r.w / 2), cy - (r.y + Math.min(r.h, M.cardH) / 2));
      if (!best || d < best.d) best = { t, d };
    }
  }
  return best ? best.t : null;
}

function targetHLElement(t) {
  if (t.type === "cell") return slotEls.cells[t.index];
  if (t.type === "found") {
    const pile = foundations[t.suit];
    return pile.length ? pile[pile.length - 1].el : slotEls.founds[SUIT_INDEX[t.suit]];
  }
  const col = columns[t.col];
  return col.length ? col[col.length - 1].el : slotEls.colBases[t.col];
}

function updateActiveTarget(cx, cy) {
  const t = hitTarget(cx, cy, ptr.targets);
  if (ptr.lastActive === t) return;
  if (ptr.lastActive) {
    const el = targetHLElement(ptr.lastActive);
    el.classList.remove("hl-active", "hl-card-active");
  }
  ptr.lastActive = t;
  if (t) {
    const el = targetHLElement(t);
    el.classList.add(el.classList.contains("slot") ? "hl-active" : "hl-card-active");
  }
}

function endDrag(p) {
  const seq = ptr.pick.seq;
  seq.forEach((c) => c.el.classList.remove("dragging"));
  const hx = p.x - ptr.offX + M.cardW / 2;
  const hy = p.y - ptr.offY + M.cardH / 2;
  const t = hitTarget(hx, hy, ptr.targets);
  ptr.dragging = false; // positionAllがドラッグ中カードを飛ばさないように
  clearHighlights();
  if (t) {
    executeUserMove(ptr.pick, t);
  } else {
    sndError();
    positionAll(false, seq);
  }
}

function cancelDrag() {
  if (ptr && ptr.dragging) {
    ptr.pick.seq.forEach((c) => c.el.classList.remove("dragging"));
    ptr.dragging = false;
    clearHighlights();
    positionAll(true);
  }
  ptr = null;
}

function handleTap(el) {
  const cardEl = el.closest(".card");
  const card = cardEl ? cardById.get(cardEl.dataset.id) : null;

  if (selection) {
    // 選択中: ハイライト先をタップ → 移動
    const t = targetFromElement(el, selection.targets);
    if (t) {
      executeUserMove(selection.pick, t);
      return;
    }
    // 同じカードをもう一度タップ → おまかせ移動
    if (card === selection.pick.seq[0]) {
      const pick = selection.pick;
      clearSelection();
      smartMove(pick);
      return;
    }
    clearSelection();
  }
  if (card) {
    const pick = pickableSeq(card);
    if (pick) {
      select(pick);
    } else {
      const loc = findLoc(card);
      if (!loc || loc.type === "found") return;
      card.el.classList.add("shake");
      setTimeout(() => card.el.classList.remove("shake"), 500);
      sndError();
    }
  }
}

/* ============================================================
   ヒント
   ============================================================ */
function findHint() {
  const picks = [];
  cells.forEach((c) => { if (c) { const p = pickableSeq(c); if (p) picks.push(p); } });
  for (let c = 0; c < COLS; c++) {
    const col = columns[c];
    for (let j = 0; j < col.length; j++) {
      const seq = col.slice(j);
      if (isSeq(seq)) {
        picks.push({ seq, loc: { type: "col", col: c, index: j } });
        break; // その列で一番長い有効列だけ
      }
    }
    // 一番上の1枚も候補に
    if (col.length >= 2) {
      const top = col[col.length - 1];
      picks.push({ seq: [top], loc: { type: "col", col: c, index: col.length - 1 } });
    }
  }

  let fallbackCell = null, fallbackEmpty = null;
  for (const pick of picks) {
    const targets = computeTargets(pick.seq, pick.loc);
    for (const t of targets) {
      if (t.type === "found") return { pick, t };
    }
    for (const t of targets) {
      if (t.type === "col" && !t.empty) {
        // 露出するカードが増える移動を優先
        if (pick.loc.type === "cell" || pick.loc.index > 0) return { pick, t };
      }
    }
    for (const t of targets) {
      if (t.type === "col" && t.empty && pick.loc.type === "col" && pick.loc.index > 0 && !fallbackEmpty) {
        fallbackEmpty = { pick, t };
      }
      if (t.type === "cell" && !fallbackCell && pick.loc.type === "col") {
        fallbackCell = { pick, t };
      }
    }
  }
  return fallbackEmpty || fallbackCell || null;
}

function showHint() {
  if (busy || won) return;
  clearSelection();
  const h = findHint();
  if (!h) {
    sndError();
    return;
  }
  sndPick();
  h.pick.seq.forEach((c) => c.el.classList.add("hint-pulse"));
  const tEl = targetHLElement(h.t);
  tEl.classList.add("hint-pulse");
  setTimeout(() => {
    h.pick.seq.forEach((c) => c.el.classList.remove("hint-pulse"));
    tEl.classList.remove("hint-pulse");
  }, 1600);
}

/* ============================================================
   Undo
   ============================================================ */
function undo() {
  if (busy || won || history.length === 0) return;
  clearSelection();
  restoreSnapshot(history.pop());
  positionAll(false);
  sndDrop();
  saveGame();
}

/* ============================================================
   タイマー・統計
   ============================================================ */
function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
function elapsedSec() {
  return Math.floor((elapsedBase + (runStamp ? Date.now() - runStamp : 0)) / 1000);
}
function startTimer() {
  if (runStamp || won) return;
  runStamp = Date.now();
  if (!timerId) timerId = setInterval(() => { elTime.textContent = fmtTime(elapsedSec()); }, 1000);
}
function pauseTimer() {
  if (runStamp) {
    elapsedBase += Date.now() - runStamp;
    runStamp = null;
  }
}
function stopTimer() {
  pauseTimer();
  if (timerId) { clearInterval(timerId); timerId = null; }
}
function updateStats() {
  elScore.textContent = score;
  elMoves.textContent = moves;
  elTime.textContent = fmtTime(elapsedSec());
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) { pauseTimer(); saveGame(); }
  else if (moves > 0 && !won) startTimer();
});
window.addEventListener("pagehide", () => { pauseTimer(); saveGame(); });

/* ============================================================
   勝利
   ============================================================ */
function checkWin() {
  if (SUITS.every((s) => foundations[s].length === RANKS.length)) {
    won = true;
    stopTimer();
    const sec = elapsedSec();
    score += 500 + Math.max(0, 600 - sec);
    updateStats();
    clearSave();
    sndWin();
    playWinAnimation(sec);
  }
}

function playWinAnimation(sec) {
  // 組札のカードがふわっと舞い上がる
  const all = SUITS.flatMap((s) => foundations[s]);
  all.forEach((c, k) => {
    setTimeout(() => {
      c.el.style.zIndex = 900 + k;
      c.el.style.transition = "transform 1.1s cubic-bezier(.3,.6,.4,1)";
      const tx = Math.random() * M.boardW * 0.8 + M.boardW * 0.1 - M.cardW / 2;
      const rot = (Math.random() * 260 - 130).toFixed(0);
      c.el.style.transform = `translate3d(${tx}px,${-M.cardH * 2.2}px,0) scale(1) rotate(${rot}deg)`;
    }, k * 26);
  });
  spawnConfetti();
  setTimeout(() => showWinPanel(sec), 1100);
}

function spawnConfetti() {
  const emo = ["🎉", "🌟", "🧸", "🍯", "🎊", "💛"];
  for (let i = 0; i < 26; i++) {
    const d = document.createElement("div");
    d.className = "confetti";
    d.textContent = emo[i % emo.length];
    d.style.left = Math.random() * 100 + "vw";
    d.style.animationDuration = (1.4 + Math.random() * 1.6) + "s";
    d.style.animationDelay = (Math.random() * 0.8) + "s";
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 4200);
  }
}

function showWinPanel(sec) {
  document.getElementById("win-score").textContent = score;
  document.getElementById("win-moves").textContent = moves;
  document.getElementById("win-time").textContent = fmtTime(sec);

  let bestMsg = "";
  try {
    const best = JSON.parse(localStorage.getItem(BEST_KEY) || "null");
    if (!best || score > best.score) {
      localStorage.setItem(BEST_KEY, JSON.stringify({ score, moves, sec }));
      bestMsg = "🏆 じこベスト こうしん！";
    } else {
      bestMsg = `🏆 じこベスト: ${best.score}てん`;
    }
  } catch (e) { /* localStorageが使えない環境でも続行 */ }
  document.getElementById("win-best").textContent = bestMsg;
  document.getElementById("win-overlay").classList.remove("hidden");
}

/* ============================================================
   セーブ / ロード
   ============================================================ */
function saveGame() {
  if (won) return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      ...snapshot(),
      elapsed: elapsedBase + (runStamp ? Date.now() - runStamp : 0),
    }));
  } catch (e) { /* 保存できなくても続行 */ }
}

function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
}

function tryLoadSave() {
  try {
    const sn = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
    if (!sn || !Array.isArray(sn.columns) || sn.columns.length !== COLS) return false;
    const ids = [...sn.columns.flat(), ...sn.cells.filter(Boolean), ...SUITS.flatMap((s) => sn.foundations[s])];
    if (ids.length !== cards.length || ids.some((id) => !cardById.has(id))) return false;
    restoreSnapshot(sn);
    elapsedBase = sn.elapsed || 0;
    history = [];
    return true;
  } catch (e) {
    return false;
  }
}

/* ============================================================
   ゲーム開始
   ============================================================ */
function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function resetState() {
  if (autoSafeTimer) {
    clearTimeout(autoSafeTimer);
    autoSafeTimer = null;
  }
  columns = Array.from({ length: COLS }, () => []);
  cells = Array(CELLS).fill(null);
  foundations = {};
  SUITS.forEach((s) => { foundations[s] = []; });
  history = [];
  moves = 0; score = 0; combo = 0;
  elapsedBase = 0;
  stopTimer();
  won = false;
  updateStats();
}

function newGame() {
  busy = true;
  clearSelection();
  document.getElementById("win-overlay").classList.add("hidden");
  resetState();

  // 勝利演出などで残ったインラインtransitionを消す
  cards.forEach((c) => { c.el.style.transition = ""; });

  const deck = shuffle(cards.slice());
  deck.forEach((c, i) => columns[i % COLS].push(c));

  // 山札位置から配るアニメーション
  const deckX = (M.boardW - M.cardW) / 2;
  const deckY = M.topY;
  const dealOrder = [];
  const maxLen = Math.max(...columns.map((c) => c.length));
  for (let j = 0; j < maxLen; j++) {
    for (let c = 0; c < COLS; c++) if (columns[c][j]) dealOrder.push(columns[c][j]);
  }
  cards.forEach((c, i) => {
    c.el.classList.add("down");
    applyPos(c, { x: deckX, y: deckY, s: 1, z: 100 + i }, true);
  });

  const pos = computeLayout();
  dealOrder.forEach((c, k) => {
    setTimeout(() => {
      applyPos(c, pos.get(c.id), false);
      setTimeout(() => c.el.classList.remove("down"), 120);
      if (k % 3 === 0) tone(400 + k * 8, 0.03, "triangle", 0.04);
    }, 120 + k * 34);
  });

  setTimeout(() => {
    busy = false;
    positionAll(false);
    saveGame();
  }, 120 + dealOrder.length * 34 + 450);
}

function resumeGame() {
  cards.forEach((c) => c.el.classList.remove("down"));
  positionAll(true);
  updateStats();
  busy = false;
}

/* ============================================================
   ボタン
   ============================================================ */
document.getElementById("btn-undo").addEventListener("click", () => { ensureAudio(); undo(); });
document.getElementById("btn-hint").addEventListener("click", () => { ensureAudio(); showHint(); });
document.getElementById("btn-again").addEventListener("click", () => { ensureAudio(); newGame(); });

document.getElementById("btn-sound").addEventListener("click", () => {
  muted = !muted;
  localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  document.getElementById("sound-icon").textContent = muted ? "🔇" : "🔊";
  ensureAudio();
  if (!muted) sndDrop();
});

document.getElementById("btn-new").addEventListener("click", () => {
  ensureAudio();
  if (busy) return;
  if (moves > 0 && !won) {
    document.getElementById("confirm-overlay").classList.remove("hidden");
  } else {
    clearSave();
    newGame();
  }
});
document.getElementById("btn-confirm-no").addEventListener("click", () => {
  document.getElementById("confirm-overlay").classList.add("hidden");
});
document.getElementById("btn-confirm-yes").addEventListener("click", () => {
  document.getElementById("confirm-overlay").classList.add("hidden");
  clearSave();
  newGame();
});

window.addEventListener("resize", scheduleRelayout);
if (window.visualViewport) window.visualViewport.addEventListener("resize", scheduleRelayout);

/* ============================================================
   起動
   ============================================================ */
(async function init() {
  document.getElementById("sound-icon").textContent = muted ? "🔇" : "🔊";
  const fill = document.getElementById("loading-fill");
  const { tex, backURL } = await prepareTextures((p) => { fill.style.width = Math.round(p * 100) + "%"; });

  resetState();
  buildCards(tex, backURL);
  computeMetrics();
  buildSlots();
  positionSlots();

  const loading = document.getElementById("loading");
  loading.classList.add("fade");
  setTimeout(() => loading.remove(), 400);

  if (tryLoadSave()) resumeGame();
  else newGame();
})();
