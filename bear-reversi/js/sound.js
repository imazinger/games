// WebAudioで合成する効果音。音声ファイル不要で、ミュート設定は端末に保存される
const LS_KEY = "bear-reversi-muted";

let ctx = null;
let muted = false;
try {
  muted = localStorage.getItem(LS_KEY) === "1";
} catch {
  // プライベートモードなどで localStorage が使えなくても動作は続ける
}

function ensureCtx() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

// iOS等はユーザー操作内で AudioContext を起こす必要がある。最初のタップで呼ぶ
export function unlock() {
  if (!muted) ensureCtx();
}

export function isMuted() {
  return muted;
}

export function setMuted(value) {
  muted = value;
  try {
    localStorage.setItem(LS_KEY, value ? "1" : "0");
  } catch {
    // 保存できなくてもよい
  }
  if (!value) ensureCtx();
}

function tone({ freq = 440, dur = 0.12, type = "sine", vol = 0.2, when = 0, slide = 0 }) {
  const c = ensureCtx();
  if (!c) return;
  const t0 = c.currentTime + when;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(60, freq + slide), t0 + dur);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

const SOUNDS = {
  // 石を置いた(ぽこっ)
  place: () => {
    tone({ freq: 330, dur: 0.09, type: "triangle", vol: 0.22 });
    tone({ freq: 495, dur: 0.08, when: 0.055, type: "triangle", vol: 0.15 });
  },
  // パス(しゅん…)
  pass: () => tone({ freq: 380, dur: 0.28, type: "sine", vol: 0.16, slide: -180 }),
  // 勝ち(ぱんぱかぱーん)
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, dur: 0.16, when: i * 0.13, type: "triangle", vol: 0.2 })),
  // 負け(しょんぼり)
  lose: () => [392, 330, 262].forEach((f, i) => tone({ freq: f, dur: 0.22, when: i * 0.17, type: "sine", vol: 0.16 })),
  // 引き分け
  draw: () => [440, 554].forEach((f, i) => tone({ freq: f, dur: 0.18, when: i * 0.16, type: "sine", vol: 0.15 })),
  // スタンプ(ぽんっ)
  stamp: () => {
    tone({ freq: 720, dur: 0.07, type: "square", vol: 0.07 });
    tone({ freq: 1080, dur: 0.09, when: 0.05, type: "square", vol: 0.05 });
  },
  // 対戦相手が来た・対局開始
  join: () => [523, 784].forEach((f, i) => tone({ freq: f, dur: 0.13, when: i * 0.1, type: "triangle", vol: 0.18 })),
};

export function play(name) {
  if (muted) return;
  SOUNDS[name]?.();
}
