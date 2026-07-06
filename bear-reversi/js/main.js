// アプリ全体のコントローラ。画面遷移とゲーム進行を束ねる
import * as G from "./game.js";
import * as UI from "./ui.js";
import * as Net from "./net.js";
import * as Sound from "./sound.js";
import { bestMove } from "./ai.js";

const SS_KEY = "bear-reversi-room";
const RESULT_DELAY = 900; // 最後の石が裏返るのを見せてから結果を出す
const CPU_THINK_MS = 850; // CPUが考えているフリをする時間
const STAMP_COOLDOWN_MS = 1200;

let mode = null; // "local" | "online"
let local = null; // { board, turn, last, over, cpu, tally: {brown, white} }
let online = null;

function bearName(color) {
  return color === G.BROWN ? "茶くま" : "しろくま";
}

function netInitialState() {
  return { b: G.boardToString(G.initialBoard()), turn: G.BROWN, last: -1, mc: 0, passed: 0 };
}

/* ---------- ローカル対戦(同一端末 / CPU) ---------- */

function startLocal(cpu) {
  mode = "local";
  local = { cpu, tally: { brown: 0, white: 0 } };
  UI.setPlayerNames("茶くま", "しろくま");
  UI.setRoomLabel(cpu ? "しろくまと対戦" : "ひとつの端末で対戦");
  UI.setOfflineBanner(false);
  UI.showStampBar(false);
  newLocalRound();
}

function newLocalRound() {
  Object.assign(local, { board: G.initialBoard(), turn: G.BROWN, last: -1, over: false });
  UI.hideResult();
  UI.resetBoardCache();
  UI.showScreen("game");
  renderLocal();
}

function renderLocal() {
  const cpuThinking = local.cpu && local.turn === G.WHITE;
  UI.renderGame(local, {
    tappable: !local.over && !cpuThinking,
    myColor: local.cpu ? G.BROWN : null,
  });
  if (local.over) UI.setMessage("おしまい！");
  else if (cpuThinking) UI.setMessage("しろくまが かんがえちゅう…🍯");
  else if (local.cpu) UI.setMessage("あなたのばん！ 🐾");
  else UI.setMessage(`${bearName(local.turn)}のばん`);
}

function playLocalMove(mover, idx) {
  const result = G.applyMove(local.board, mover, idx);
  if (!result) return false;
  local.board = result.board;
  local.last = idx;
  Sound.play("place");
  const next = G.resolveTurn(local.board, mover);
  if (next.over) {
    local.over = true;
    local.turn = G.EMPTY;
    renderLocal();
    finishLocal();
  } else {
    if (next.passed) {
      UI.toast(`${bearName(G.opponent(mover))}は うてないので パス！`);
      Sound.play("pass");
    }
    local.turn = next.turn;
    renderLocal();
    if (local.cpu && local.turn === G.WHITE) scheduleCpu();
  }
  return true;
}

function tapLocal(idx) {
  if (local.over) return;
  if (local.cpu && local.turn === G.WHITE) return; // CPUの手番中は触れない
  playLocalMove(local.turn, idx);
}

function scheduleCpu() {
  setTimeout(() => {
    if (mode !== "local" || !local?.cpu || local.over || local.turn !== G.WHITE) return;
    const idx = bestMove(local.board, G.WHITE);
    if (idx >= 0) playLocalMove(G.WHITE, idx);
  }, CPU_THINK_MS);
}

function finishLocal() {
  const board = local.board;
  const win = G.winner(board);
  if (win === G.BROWN) local.tally.brown++;
  else if (win === G.WHITE) local.tally.white++;
  setTimeout(() => {
    if (mode !== "local" || !local?.over) return;
    const { brown, white } = G.countStones(board);
    const t = local.tally;
    const tally = local.cpu
      ? `つうせん: あなた ${t.brown}勝 - ${t.white}勝 しろくま`
      : `つうせん: 茶くま ${t.brown}勝 - ${t.white}勝 しろくま`;
    if (win === G.EMPTY) Sound.play("draw");
    else if (local.cpu) Sound.play(win === G.BROWN ? "win" : "lose");
    else Sound.play("win");
    UI.showResult({ winner: win, brown, white, myColor: local.cpu ? G.BROWN : null, tally });
  }, RESULT_DELAY);
}

/* ---------- オンライン対戦 ---------- */

function attachRoom(code, seat) {
  mode = "online";
  online = {
    code,
    seat,
    room: null,
    myColor: null,
    lastMc: -1,
    prevStatus: null,
    started: false,
    waitShown: false,
    resultShown: false,
    seenSnapshot: false,
    lastStampTs: 0,
    lastStampSent: 0,
    unsub: null,
    presenceUnsub: null,
  };
  sessionStorage.setItem(SS_KEY, JSON.stringify({ code, seat }));
  online.presenceUnsub = Net.trackPresence(code, seat);
  online.unsub = Net.subscribe(code, onRoomUpdate);
}

function cleanupOnline({ leave = false } = {}) {
  if (!online) return;
  online.unsub?.();
  online.presenceUnsub?.();
  if (leave) {
    const removeRoom = online.seat === "host" && online.room?.status === "waiting";
    Net.leaveRoom(online.code, online.seat, { removeRoom });
    sessionStorage.removeItem(SS_KEY);
  }
  online = null;
}

async function createRoomFlow() {
  if (!Net.isConfigured()) {
    UI.setConfigNote(true);
    UI.toast("オンライン対戦の じゅんびが まだみたい…");
    return;
  }
  try {
    const { code, seat } = await Net.createRoom(netInitialState());
    attachRoom(code, seat);
  } catch (err) {
    console.error(err);
    UI.toast("ルームを つくれなかった…");
  }
}

async function joinRoomFlow(codeArg) {
  const code = (codeArg || UI.getJoinCodeInput()).toUpperCase();
  if (code.length !== Net.CODE_LENGTH) {
    UI.toast(`${Net.CODE_LENGTH}もじの コードを いれてね`);
    return;
  }
  if (!Net.isConfigured()) {
    UI.setConfigNote(true);
    UI.toast("オンライン対戦の じゅんびが まだみたい…");
    return;
  }
  try {
    const { seat } = await Net.joinRoom(code);
    attachRoom(code, seat);
  } catch (err) {
    if (err.message === "NOT_FOUND") UI.toast("そのルームは みつからないよ");
    else if (err.message === "ROOM_FULL") UI.toast("そのルームは まんいんだよ");
    else {
      console.error(err);
      UI.toast("ルームに はいれなかった…");
    }
  }
}

async function resumeFlow() {
  const saved = sessionStorage.getItem(SS_KEY);
  if (!saved || !Net.isConfigured()) return false;
  try {
    const { code, seat } = JSON.parse(saved);
    await Net.resumeRoom(code);
    attachRoom(code, seat);
    return true;
  } catch {
    sessionStorage.removeItem(SS_KEY);
    return false;
  }
}

function onRoomUpdate(room) {
  if (!online) return;

  if (!room) {
    // ルーム自体が消えているので presence 等は書き戻さない
    sessionStorage.removeItem(SS_KEY);
    cleanupOnline();
    mode = null;
    UI.showScreen("home");
    UI.toast("ルームが なくなったみたい…");
    return;
  }
  online.room = room;

  // ホストの待機画面
  if (room.status === "waiting") {
    if (online.seat === "host" && !online.waitShown) {
      online.waitShown = true;
      UI.showRoomCode(online.code);
      UI.showScreen("wait");
    }
    return;
  }

  const myColor = online.seat === "host" ? room.hostColor : G.opponent(room.hostColor);
  online.myColor = myColor;

  // 再戦開始(finished -> playing)を検知して盤を作り直す
  if (online.prevStatus === "finished" && room.status === "playing") {
    online.resultShown = false;
    UI.hideResult();
    UI.resetBoardCache();
  }
  online.prevStatus = room.status;

  if (!online.started) {
    online.started = true;
    UI.resetBoardCache();
    UI.setPlayerNames("茶くま", "しろくま");
    UI.setRoomLabel(`ルーム ${online.code}`);
    UI.setOfflineBanner(false);
    UI.showScreen("game");
    Sound.play("join");
  }

  const st = room.state;
  const board = G.boardFromString(st.b);
  UI.renderGame(
    { board, turn: room.status === "playing" ? st.turn : G.EMPTY, last: st.last },
    { tappable: room.status === "playing" && st.turn === myColor, myColor },
  );

  if (st.mc !== online.lastMc) {
    if (online.lastMc !== -1 && st.last >= 0) Sound.play("place");
    online.lastMc = st.mc;
    if (st.passed) {
      UI.toast(`${bearName(st.passed)}は うてないので パス！`);
      Sound.play("pass");
    }
  }

  // スタンプ(最初のスナップショットは過去分なので鳴らさない)
  if (room.stamp && online.seenSnapshot && room.stamp.ts !== online.lastStampTs) {
    const stampColor = room.stamp.seat === "host" ? room.hostColor : G.opponent(room.hostColor);
    UI.flyStamp(stampColor, room.stamp.emoji);
    Sound.play("stamp");
  }
  online.lastStampTs = room.stamp?.ts ?? 0;
  online.seenSnapshot = true;

  UI.showStampBar(room.status === "playing");

  if (room.status === "playing") {
    UI.setMessage(st.turn === myColor ? "あなたのばん！ 🐾" : "あいてのばん…");
    UI.setOfflineBanner(!isOpponentOnline(room));
  } else {
    UI.setMessage("おしまい！");
    UI.setOfflineBanner(false);
  }

  if (room.status === "finished") {
    if (!online.resultShown) {
      online.resultShown = true;
      setTimeout(() => {
        if (online?.room?.status !== "finished") return;
        const { brown, white } = G.countStones(board);
        const win = G.winner(board);
        const wins = online.room.wins || {};
        const mine = wins[online.seat] || 0;
        const theirs = wins[online.seat === "host" ? "guest" : "host"] || 0;
        if (win === G.EMPTY) Sound.play("draw");
        else Sound.play(win === myColor ? "win" : "lose");
        UI.showResult({
          winner: win,
          brown,
          white,
          myColor,
          tally: `つうせん: あなた ${mine}勝 - ${theirs}勝 あいて`,
        });
      }, RESULT_DELAY);
    }
    // 双方が再戦を希望したらホストが色を入れ替えて開始
    if (online.seat === "host" && room.rematch?.host && room.rematch?.guest) {
      Net.startRematch(online.code, G.opponent(room.hostColor), netInitialState());
    }
  }
}

function isOpponentOnline(room) {
  const p = room.presence || {};
  return online.seat === "host" ? Boolean(p.guest) : Boolean(p.host);
}

function tapOnline(idx) {
  const room = online?.room;
  if (!room || room.status !== "playing") return;
  const st = room.state;
  if (st.turn !== online.myColor) return;
  const board = G.boardFromString(st.b);
  const result = G.applyMove(board, online.myColor, idx);
  if (!result) return;
  const next = G.resolveTurn(result.board, online.myColor);
  const newState = {
    b: G.boardToString(result.board),
    turn: next.over ? G.EMPTY : next.turn,
    last: idx,
    mc: st.mc + 1,
    passed: next.passed ? G.opponent(online.myColor) : 0,
  };
  const extra = {};
  if (next.over) {
    const win = G.winner(result.board);
    if (win !== G.EMPTY) {
      const winnerSeat = win === room.hostColor ? "host" : "guest";
      extra[`wins/${winnerSeat}`] = (room.wins?.[winnerSeat] || 0) + 1;
    }
  }
  Net.sendState(online.code, newState, next.over ? "finished" : "playing", extra).catch((err) => {
    console.error(err);
    UI.toast("そうしんに しっぱいした…");
  });
}

function onStamp(emoji) {
  if (mode !== "online" || !online?.room || online.room.status !== "playing") return;
  const now = Date.now();
  if (now - online.lastStampSent < STAMP_COOLDOWN_MS) return;
  online.lastStampSent = now;
  UI.stampCooldown(STAMP_COOLDOWN_MS);
  Net.sendStamp(online.code, online.seat, emoji).catch(() => UI.toast("おくれなかった…"));
}

async function copyInviteLink() {
  const url = new URL(location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("room", online.code);
  const text = url.toString();
  try {
    await navigator.clipboard.writeText(text);
    UI.toast("しょうたいリンクを コピーしたよ！");
  } catch {
    window.prompt("このリンクを おくってね", text);
  }
}

/* ---------- 画面遷移 ---------- */

function goHome() {
  UI.hideResult();
  UI.showStampBar(false);
  cleanupOnline({ leave: true });
  mode = null;
  local = null;
  UI.showScreen("home");
}

function onRematch() {
  if (mode === "local") {
    newLocalRound();
    return;
  }
  if (!online) return;
  Net.requestRematch(online.code, online.seat).catch(() => UI.toast("そうしんに しっぱいした…"));
  UI.setRematchWaiting();
}

function onToggleSound() {
  Sound.setMuted(!Sound.isMuted());
  UI.setSoundIcon(Sound.isMuted());
  UI.toast(Sound.isMuted() ? "おとを けしたよ" : "おとを つけたよ🔔");
}

/* ---------- 起動 ---------- */

UI.init({
  onCellTap: (idx) => {
    if (mode === "local") tapLocal(idx);
    else if (mode === "online") tapOnline(idx);
  },
});

UI.bindButtons({
  onCreate: createRoomFlow,
  onJoin: () => joinRoomFlow(),
  onCpu: () => startLocal(true),
  onLocal: () => startLocal(false),
  onCopyLink: copyInviteLink,
  onCancelWait: goHome,
  onLeave: goHome,
  onRematch,
  onHome: goHome,
  onToggleSound,
  onStamp,
});

UI.setConfigNote(!Net.isConfigured());
UI.setSoundIcon(Sound.isMuted());
document.addEventListener("pointerdown", () => Sound.unlock(), { once: true });

(async () => {
  if (await resumeFlow()) return;
  const params = new URLSearchParams(location.search);
  const roomParam = (params.get("room") || "").toUpperCase();
  if (roomParam) {
    UI.setJoinCodeInput(roomParam);
    history.replaceState(null, "", location.pathname);
    await joinRoomFlow(roomParam);
  }
})();
