// 画面描画まわり。ゲーム進行のロジックは持たない
import { BROWN, WHITE, EMPTY, countStones, legalMoves } from "./game.js";
import { bearFace, faceForColor, logoSvg } from "./bears.js";

const $ = (id) => document.getElementById(id);

let cells = [];
let prevBoard = null;
let onCellTap = null;
let toastTimer = null;

export function init(handlers) {
  onCellTap = handlers.onCellTap;

  $("logo").innerHTML = logoSvg();
  $("wait-bear").innerHTML = bearFace("brown", "normal");
  $("panel-brown").querySelector(".avatar").innerHTML = bearFace("brown");
  $("panel-white").querySelector(".avatar").innerHTML = bearFace("white");

  const board = $("board");
  board.innerHTML = "";
  cells = [];
  for (let i = 0; i < 64; i++) {
    const cell = document.createElement("button");
    cell.className = "cell";
    cell.dataset.idx = i;
    cell.setAttribute("aria-label", `${Math.floor(i / 8) + 1}行${(i % 8) + 1}列`);
    cell.addEventListener("click", () => onCellTap?.(i));
    board.appendChild(cell);
    cells.push(cell);
  }
}

export function showScreen(name) {
  for (const s of document.querySelectorAll(".screen")) s.classList.remove("active");
  $(`screen-${name}`).classList.add("active");
  if (name !== "game") hideResult();
}

// state: { board, turn, last }
// opts: { tappable: 手番として石を置けるか, myColor: 自分の色(localならnull) }
export function renderGame(state, opts = {}) {
  const { board, turn, last } = state;
  const hints = opts.tappable ? new Set(legalMoves(board, turn)) : new Set();

  for (let i = 0; i < 64; i++) {
    const cell = cells[i];
    const now = board[i];
    const before = prevBoard ? prevBoard[i] : EMPTY;

    if (now === EMPTY) {
      cell.innerHTML = "";
    } else if (before === EMPTY || !cell.querySelector(".disc")) {
      const disc = document.createElement("div");
      disc.className = "disc" + (now === WHITE ? " show-white" : "");
      if (prevBoard) disc.classList.add("pop");
      disc.innerHTML =
        `<div class="face brown">${bearFace("brown")}</div>` +
        `<div class="face white">${bearFace("white")}</div>`;
      cell.innerHTML = "";
      cell.appendChild(disc);
    } else if (before !== now) {
      // 裏返し: 置いた石から遠い順にすこし遅れて波のようにめくる
      const disc = cell.querySelector(".disc");
      const dist = last >= 0
        ? Math.max(Math.abs((i % 8) - (last % 8)), Math.abs(Math.floor(i / 8) - Math.floor(last / 8)))
        : 0;
      disc.style.transitionDelay = `${dist * 70}ms`;
      disc.classList.toggle("show-white", now === WHITE);
    }

    cell.classList.toggle("playable", hints.has(i));
    cell.classList.toggle("last", i === last);
  }
  prevBoard = board.slice();

  const { brown, white } = countStones(board);
  $("panel-brown").querySelector(".pcount").textContent = brown;
  $("panel-white").querySelector(".pcount").textContent = white;
  $("panel-brown").classList.toggle("active", turn === BROWN);
  $("panel-white").classList.toggle("active", turn === WHITE);
  $("panel-brown").classList.toggle("me", opts.myColor === BROWN);
  $("panel-white").classList.toggle("me", opts.myColor === WHITE);
}

export function resetBoardCache() {
  prevBoard = null;
}

export function setPlayerNames(brownName, whiteName) {
  $("panel-brown").querySelector(".pname").textContent = brownName;
  $("panel-white").querySelector(".pname").textContent = whiteName;
}

export function setRoomLabel(text) {
  $("room-label").textContent = text;
}

export function setMessage(text) {
  $("msg").innerHTML = text || "&nbsp;";
}

export function setOfflineBanner(visible) {
  $("banner-offline").classList.toggle("hidden", !visible);
}

export function setSoundIcon(muted) {
  const btn = $("btn-sound");
  btn.textContent = muted ? "🔇" : "🔊";
  btn.classList.toggle("muted", muted);
}

export function showStampBar(visible) {
  $("stamp-bar").classList.toggle("hidden", !visible);
}

// 連打防止のクールダウン表示
export function stampCooldown(ms) {
  const bar = $("stamp-bar");
  bar.classList.add("cooldown");
  setTimeout(() => bar.classList.remove("cooldown"), ms);
}

// 送った/届いたスタンプをくまカードの上にふわっと飛ばす
export function flyStamp(color, emoji) {
  const panel = color === BROWN ? $("panel-brown") : $("panel-white");
  const span = document.createElement("span");
  span.className = "stamp-fly";
  span.textContent = emoji;
  panel.appendChild(span);
  setTimeout(() => span.remove(), 1600);
}

// result: { winner: BROWN|WHITE|EMPTY, brown, white, myColor }
export function showResult(result) {
  const bear = $("result-bear");
  bear.classList.remove("winner", "duo");
  if (result.winner === EMPTY) {
    bear.classList.add("duo");
    bear.innerHTML = bearFace("brown", "happy") + bearFace("white", "happy");
    $("result-title").textContent = "ひきわけ！";
  } else {
    const kind = result.winner === BROWN ? "brown" : "white";
    const name = result.winner === BROWN ? "茶くま" : "しろくま";
    bear.classList.add("winner");
    bear.innerHTML = `<span class="crown">👑</span>` + bearFace(kind, "happy");
    if (result.myColor != null) {
      $("result-title").textContent = result.winner === result.myColor ? "あなたのかち！" : "あなたのまけ…";
    } else {
      $("result-title").textContent = `${name}のかち！`;
    }
  }
  $("result-score").textContent = `茶くま ${result.brown} - ${result.white} しろくま`;
  const tally = $("result-tally");
  tally.classList.toggle("hidden", !result.tally);
  if (result.tally) tally.textContent = result.tally;
  $("rematch-note").classList.add("hidden");
  $("btn-rematch").disabled = false;
  $("overlay-result").classList.remove("hidden");
}

export function setRematchWaiting() {
  $("btn-rematch").disabled = true;
  $("rematch-note").classList.remove("hidden");
}

export function hideResult() {
  $("overlay-result").classList.add("hidden");
}

export function showRoomCode(code) {
  $("room-code-display").innerHTML = [...code].map((c) => `<span>${c}</span>`).join("");
}

export function setConfigNote(visible) {
  $("config-note").classList.toggle("hidden", !visible);
}

export function toast(text, ms = 2200) {
  const el = $("toast");
  el.textContent = text;
  el.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add("hidden"), ms);
}

export function getJoinCodeInput() {
  return $("input-code").value.trim().toUpperCase();
}

export function setJoinCodeInput(code) {
  $("input-code").value = code;
}

export function bindButtons(handlers) {
  $("btn-create").addEventListener("click", handlers.onCreate);
  $("btn-join").addEventListener("click", handlers.onJoin);
  $("btn-cpu").addEventListener("click", handlers.onCpu);
  $("btn-local").addEventListener("click", handlers.onLocal);
  $("btn-sound").addEventListener("click", handlers.onToggleSound);
  for (const btn of document.querySelectorAll(".stamp-btn")) {
    btn.addEventListener("click", () => handlers.onStamp(btn.dataset.stamp));
  }
  $("btn-copy-link").addEventListener("click", handlers.onCopyLink);
  $("btn-cancel-wait").addEventListener("click", handlers.onCancelWait);
  $("btn-leave").addEventListener("click", handlers.onLeave);
  $("btn-rematch").addEventListener("click", handlers.onRematch);
  $("btn-home").addEventListener("click", handlers.onHome);
  $("input-code").addEventListener("keydown", (e) => {
    if (e.key === "Enter") handlers.onJoin();
  });
}
