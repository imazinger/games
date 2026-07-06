// くまの顔のSVGアセット
import { BROWN } from "./game.js";

const PALETTE = {
  brown: {
    head: "#B07E52",
    ear: "#8F653D",
    earIn: "#D8B48C",
    muzzle: "#F0DFC3",
    nose: "#5B4531",
    eye: "#463527",
    stroke: "none",
  },
  white: {
    head: "#FDFBF4",
    ear: "#EDE4D2",
    earIn: "#F6DFD6",
    muzzle: "#FFFFFF",
    nose: "#6C6156",
    eye: "#4A4038",
    stroke: "#E0D6C2",
  },
};

// kind: "brown" | "white"
// mood: "normal" | "happy" | "sad"
export function bearFace(kind, mood = "normal") {
  const c = PALETTE[kind];
  const eyes =
    mood === "happy"
      ? `<path d="M31 47 q5 -6 10 0" fill="none" stroke="${c.eye}" stroke-width="3.5" stroke-linecap="round"/>
         <path d="M59 47 q5 -6 10 0" fill="none" stroke="${c.eye}" stroke-width="3.5" stroke-linecap="round"/>`
      : mood === "sad"
        ? `<circle cx="36" cy="49" r="3.6" fill="${c.eye}"/>
           <circle cx="64" cy="49" r="3.6" fill="${c.eye}"/>
           <path d="M29 42 l10 4 M71 42 l-10 4" stroke="${c.eye}" stroke-width="2.4" stroke-linecap="round"/>`
        : `<circle cx="36" cy="48" r="4" fill="${c.eye}"/>
           <circle cx="64" cy="48" r="4" fill="${c.eye}"/>
           <circle cx="37.4" cy="46.6" r="1.3" fill="#FFF" opacity="0.9"/>
           <circle cx="65.4" cy="46.6" r="1.3" fill="#FFF" opacity="0.9"/>`;
  const mouth =
    mood === "sad"
      ? `<path d="M44 76 q6 -5 12 0" fill="none" stroke="${c.nose}" stroke-width="2.5" stroke-linecap="round"/>`
      : `<path d="M44 72 q6 5 12 0" fill="none" stroke="${c.nose}" stroke-width="2.5" stroke-linecap="round"/>`;
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <circle cx="25" cy="24" r="14" fill="${c.ear}" stroke="${c.stroke}" stroke-width="2"/>
    <circle cx="75" cy="24" r="14" fill="${c.ear}" stroke="${c.stroke}" stroke-width="2"/>
    <circle cx="25" cy="24" r="7" fill="${c.earIn}"/>
    <circle cx="75" cy="24" r="7" fill="${c.earIn}"/>
    <circle cx="50" cy="55" r="38" fill="${c.head}" stroke="${c.stroke}" stroke-width="2"/>
    <circle cx="28" cy="60" r="5.5" fill="#EC8278" opacity="0.4"/>
    <circle cx="72" cy="60" r="5.5" fill="#EC8278" opacity="0.4"/>
    <ellipse cx="50" cy="66" rx="16" ry="12" fill="${c.muzzle}"/>
    <ellipse cx="50" cy="61" rx="6.5" ry="5" fill="${c.nose}"/>
    ${eyes}
    ${mouth}
  </svg>`;
}

export function faceForColor(color, mood = "normal") {
  return bearFace(color === BROWN ? "brown" : "white", mood);
}

// タイトル用ロゴ: 2匹のくまが並ぶ
export function logoSvg() {
  return `<svg viewBox="0 0 220 110" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <g transform="translate(10 14) rotate(-8 45 45) scale(0.9)">${inner(bearFace("brown", "happy"))}</g>
    <g transform="translate(115 14) rotate(8 45 45) scale(0.9)">${inner(bearFace("white", "happy"))}</g>
    <text x="108" y="30" font-size="22" text-anchor="middle">🍯</text>
  </svg>`;
}

// SVG文字列から中身だけ取り出す(ロゴ合成用)
function inner(svg) {
  return svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
}
