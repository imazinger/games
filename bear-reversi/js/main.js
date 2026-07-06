// アプリ全体のコントローラ。画面遷移とゲーム進行を束ねる
import * as G from "./game.js";
import * as UI from "./ui.js";
import * as Net from "./net.js";

const SS_KEY = "bear-reversi-room";
const RESULT_DELAY = 900; // 最後の石が裏返るのを見せてから結果を出す

let mode = null; // "local" | "online"
let local = null;
let online = null;

function bearName(color) {
  return color === G.BROWN ? "茶くま" : "しろくま";
}

function netInitialState() {
  return { b: G.boardToString(G.initialBoard()), turn: G.BROWN, last: -1, mc: 0, passed: 0 };
}

/* ---------- ローカル(同一端末)対戦 ---------- */

function startLocal() {
  mode = "local";
  local = { board: G.initialBoard(), turn: G.BROWN, last: -1, over: false };
  UI.hideResult();
  UI.resetBoardCache();
  UI.setPlayerNames("茶くま", "しろくま");
  UI.setRoomLabel("ひとつの端末で対戦");
  UI.setOfflineBanner(false);
  UI.showScreen("game");
  renderLocal();
}

function renderLocal() {
  UI.renderGame(local, { tappable: !local.over, myColor: null });
  UI.setMessage(local.over ? "おしまい！" : `${bearName(local.turn)}のばん`);
}

function tapLocal(idx) {
  if (local.over) return;
  const mover = local.turn;
  const result = G.applyMove(local.board, mover, idx);
  if (!result) return;
  local.board = result.board;
  local.last = idx;
  const next = G.resolveTurn(local.board, mover);
  if (next.over) {
    local.over = true;
    local.turn = G.EMPTY;
    renderLocal();
    setTimeout(() => {
      const { brown, white } = G.countStones(local.board);
      UI.showResult({ winner: G.winner(local.board), brown, white, myColor: null });
    }, RESULT_DELAY);
  } else {
    if (next.passed) UI.toast(`${bearName(G.opponent(mover))}は うてないので パス！`);
    local.turn = next.turn;
    renderLocal();
  }
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
    cleanupOnline({ leave: true });
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
  }

  const st = room.state;
  const board = G.boardFromString(st.b);
  UI.renderGame(
    { board, turn: room.status === "playing" ? st.turn : G.EMPTY, last: st.last },
    { tappable: room.status === "playing" && st.turn === myColor, myColor },
  );

  if (st.mc !== online.lastMc) {
    online.lastMc = st.mc;
    if (st.passed) UI.toast(`${bearName(st.passed)}は うてないので パス！`);
  }

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
        if (online?.room?.status === "finished") {
          const { brown, white } = G.countStones(board);
          UI.showResult({ winner: G.winner(board), brown, white, myColor });
        }
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
  Net.sendState(online.code, newState, next.over ? "finished" : "playing").catch((err) => {
    console.error(err);
    UI.toast("そうしんに しっぱいした…");
  });
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
  cleanupOnline({ leave: true });
  mode = null;
  local = null;
  UI.showScreen("home");
}

function onRematch() {
  if (mode === "local") {
    startLocal();
    return;
  }
  if (!online) return;
  Net.requestRematch(online.code, online.seat).catch(() => UI.toast("そうしんに しっぱいした…"));
  UI.setRematchWaiting();
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
  onLocal: startLocal,
  onCopyLink: copyInviteLink,
  onCancelWait: goHome,
  onLeave: goHome,
  onRematch,
  onHome: goHome,
});

UI.setConfigNote(!Net.isConfigured());

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
