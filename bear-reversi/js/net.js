// Firebase Realtime Database を使ったルーム管理・状態同期。
// SDK はオンライン対戦を選んだときにだけ CDN から読み込む。
import { firebaseConfig, hasFirebaseConfig } from "./firebase-config.js";

const SDK_BASE = "https://www.gstatic.com/firebasejs/11.0.1";
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 紛らわしい文字(I,O,0,1)を除外
export const CODE_LENGTH = 4;

let db = null;
let fb = null; // firebase-database モジュール

export function isConfigured() {
  return hasFirebaseConfig();
}

async function ensure() {
  if (db) return;
  if (!hasFirebaseConfig()) throw new Error("NO_CONFIG");
  const [{ initializeApp }, dbModule] = await Promise.all([
    import(`${SDK_BASE}/firebase-app.js`),
    import(`${SDK_BASE}/firebase-database.js`),
  ]);
  fb = dbModule;
  db = fb.getDatabase(initializeApp(firebaseConfig));
}

function roomRef(code, ...path) {
  return fb.ref(db, ["rooms", code, ...path].join("/"));
}

function randomCode() {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

// 新しいルームを作る。initialState はルームに置く最初の対局状態
export async function createRoom(initialState) {
  await ensure();
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    const snap = await fb.get(roomRef(code));
    if (snap.exists()) continue;
    await fb.set(roomRef(code), {
      createdAt: fb.serverTimestamp(),
      status: "waiting",
      hostColor: 1,
      guestJoined: false,
      presence: { host: true, guest: false },
      rematch: { host: false, guest: false },
      state: initialState,
    });
    return { code, seat: "host" };
  }
  throw new Error("CODE_COLLISION");
}

// 接続状態を監視して presence を維持する(再接続時に自動復帰)。戻り値は解除関数
export function trackPresence(code, seat) {
  const connRef = fb.ref(db, ".info/connected");
  return fb.onValue(connRef, (snap) => {
    if (snap.val() === true) {
      fb.onDisconnect(roomRef(code, "presence", seat)).set(false);
      fb.set(roomRef(code, "presence", seat), true);
    }
  });
}

// リロード後などに既存ルームへ復帰する
export async function resumeRoom(code) {
  await ensure();
  const snap = await fb.get(roomRef(code));
  if (!snap.exists()) throw new Error("NOT_FOUND");
}

// 既存ルームに参加する。失敗時は理由つきの Error を投げる
export async function joinRoom(code) {
  await ensure();
  const snap = await fb.get(roomRef(code));
  if (!snap.exists()) throw new Error("NOT_FOUND");

  const result = await fb.runTransaction(roomRef(code, "guestJoined"), (joined) => {
    if (joined) return; // すでに満室 → abort
    return true;
  });
  if (!result.committed) throw new Error("ROOM_FULL");

  await fb.update(roomRef(code), {
    status: "playing",
    "presence/guest": true,
  });
  return { code, seat: "guest" };
}

// ルーム全体を購読する。戻り値は購読解除関数
export function subscribe(code, callback) {
  return fb.onValue(roomRef(code), (snap) => callback(snap.val()));
}

// 手を打った側が対局状態を書き込む
export async function sendState(code, state, status) {
  await fb.update(roomRef(code), { state, status });
}

export async function requestRematch(code, seat) {
  await fb.set(roomRef(code, "rematch", seat), true);
}

// ホストが再戦を開始する(先手・後手を入れ替える)
export async function startRematch(code, newHostColor, initialState) {
  await fb.update(roomRef(code), {
    status: "playing",
    hostColor: newHostColor,
    rematch: { host: false, guest: false },
    state: initialState,
  });
}

// ルームから退出する。待機中のホストならルームごと消す
export async function leaveRoom(code, seat, { removeRoom = false } = {}) {
  try {
    if (removeRoom) {
      await fb.remove(roomRef(code));
    } else {
      await fb.set(roomRef(code, "presence", seat), false);
    }
  } catch {
    // 退出時のエラーは無視してよい
  }
}
