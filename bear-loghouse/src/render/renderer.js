import { COLS, ROWS } from '../core/config.js';

// ピース種別ごとの配色
const PALETTE = {
  wood:   { a: '#d29a55', b: '#96632f', line: '#7a4b20', cap: '#ecc98f', capRing: '#a5744a' },
  window: { a: '#9fd3e8', b: '#659fb9', line: '#41758c', glass: '#dbf2fb' },
  door:   { a: '#8a5a30', b: '#59371b', line: '#3f2610', knob: '#f2c14e' },
  roof:   { a: '#d06a4f', b: '#9c3e2b', line: '#7c2f20' },
};
const TYPE_LABEL = { wood: '壁', window: '窓', door: 'ドア', roof: '屋根' };

function rr(ctx, x, y, w, h, r) {
  const rad = Array.isArray(r) ? r : [r, r, r, r];
  const [tl, tr, br, bl] = rad.map((v) => Math.min(v, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + w - tr, y);
  ctx.arcTo(x + w, y, x + w, y + tr, tr);
  ctx.lineTo(x + w, y + h - br);
  ctx.arcTo(x + w, y + h, x + w - br, y + h, br);
  ctx.lineTo(x + bl, y + h);
  ctx.arcTo(x, y + h, x, y + h - bl, bl);
  ctx.lineTo(x, y + tl);
  ctx.arcTo(x, y, x + tl, y, tl);
  ctx.closePath();
}

const easeInQuad = (t) => t * t;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this._size = { w: 0, h: 0, dpr: 0 };
    this.houseGeom = null;
    this.resize();
  }

  resizeIfNeeded() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    if (w !== this._size.w || h !== this._size.h || dpr !== this._size.dpr) this.resize();
  }

  resize() {
    const w = this.canvas.clientWidth || 375;
    const h = this.canvas.clientHeight || 600;
    const dpr = window.devicePixelRatio || 1;
    this._size = { w, h, dpr };
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);

    const houseH = Math.max(118, Math.min(185, h * 0.25));
    const stripH = 68;
    const boardAvail = h - houseH - stripH - 10;
    const cell = Math.min((w - 26) / COLS, boardAvail / (ROWS + 1.35));
    const gridW = cell * COLS;
    const hoverH = cell * 1.35;
    const gridX = (w - gridW) / 2;
    const hoverY = houseH + stripH + 6;
    const gridY = hoverY + hoverH;

    this.layout = {
      W: w, H: h,
      house: { x: 0, y: 0, w, h: houseH },
      strip: { x: 8, y: houseH + 2, w: w - 16, h: stripH - 4 },
      hoverY, hoverH,
      grid: { x: gridX, y: gridY, cell, w: gridW, h: cell * ROWS },
    };
  }

  hoverPieceY() {
    const L = this.layout;
    return L.hoverY + (L.hoverH - L.grid.cell) / 2;
  }

  housePoint() {
    const g = this.houseGeom;
    if (!g) return { x: this.layout.W * 0.3, y: this.layout.house.h * 0.7 };
    return { x: g.hx + g.houseW / 2, y: g.groundY - g.visibleBuilt * g.layerH };
  }

  // ================= メイン描画 =================
  draw(game, effects, view, time) {
    const { ctx } = this;
    const L = this.layout;
    ctx.setTransform(this._size.dpr, 0, 0, this._size.dpr, 0, 0);

    // 背景(空〜森)
    const bg = ctx.createLinearGradient(0, 0, 0, L.H);
    bg.addColorStop(0, '#aee0f7');
    bg.addColorStop(0.35, '#cdeccf');
    bg.addColorStop(1, '#9ec98b');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, L.W, L.H);

    const sh = effects.shake;
    const shx = (Math.random() * 2 - 1) * sh;
    const shy = (Math.random() * 2 - 1) * sh;
    ctx.save();
    ctx.translate(shx, shy);

    this.drawHouseArea(game, effects, time);
    this.drawStrip(game, time);
    this.drawBoard(game, effects, view, time);
    this.drawEffectsOverlay(effects);

    ctx.restore();

    if (effects.rewindT > 0) this.drawRewindFx(effects.rewindT);
  }

  // ================= 家エリア =================
  drawHouseArea(game, effects, time) {
    const { ctx } = this;
    const area = this.layout.house;
    const W = this.layout.W;

    const groundH = Math.max(14, area.h * 0.12);
    const groundY = area.y + area.h - groundH;
    const layerH = Math.max(6.5, Math.min(12, (area.h - 44) / 12));
    const houseW = Math.min(150, W * 0.4);
    const hx = W * 0.31 - houseW / 2;
    const visibleBuilt = Math.max(0, game.house.next - effects.pendingBuilds());
    this.houseGeom = { hx, houseW, groundY, layerH, visibleBuilt };

    // 太陽
    ctx.fillStyle = 'rgba(255, 224, 130, 0.9)';
    ctx.beginPath();
    ctx.arc(W - 34, area.y + 26, 14, 0, Math.PI * 2);
    ctx.fill();

    // 地面
    ctx.fillStyle = '#8cc06f';
    ctx.fillRect(0, groundY, W, groundH);
    ctx.fillStyle = 'rgba(0,0,0,0.10)';
    ctx.fillRect(0, groundY, W, 2);

    // 木々
    this.drawTree(12, groundY, 22);
    this.drawTree(hx + houseW + 24, groundY, 17);

    // 家(建築演出でぴょこんと跳ねる)
    const hop = -effects.housePopT * 4;
    ctx.save();
    ctx.translate(0, hop);
    this.drawHouse(game.house, visibleBuilt, hx, houseW, groundY, layerH);
    ctx.restore();

    // 完成後のキラキラ
    if (game.phase === 'finished' && Math.random() < 0.12) {
      effects.addDust(hx + Math.random() * houseW, groundY - Math.random() * layerH * 11, '#ffe082', 1);
    }

    // クマの運搬
    for (const b of effects.bears) {
      if (b.elapsed < b.delay) continue;
      const t = b.progress;
      const startX = W - 40;
      const endX = hx + houseW + 6;
      const x = startX + (endX - startX) * t;
      const bob = Math.abs(Math.sin(b.elapsed * 14)) * 3;
      const y = groundY - bob;
      // 運んでいる建材
      const pal = PALETTE[b.type] || PALETTE.wood;
      ctx.fillStyle = pal.a;
      ctx.strokeStyle = pal.line;
      ctx.lineWidth = 1;
      rr(ctx, x - 26, y - 15, 18, 8, 3);
      ctx.fill();
      ctx.stroke();
      // クマ(テディベア)
      ctx.font = '22px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText('🧸', x, y);
    }

    this.drawBlueprint(game, time);
  }

  drawTree(x, groundY, size) {
    const { ctx } = this;
    ctx.fillStyle = '#6d4a2a';
    ctx.fillRect(x + size * 0.42, groundY - size * 0.35, size * 0.16, size * 0.35);
    ctx.fillStyle = '#4e8f4e';
    for (let i = 0; i < 3; i++) {
      const w = size * (1 - i * 0.24);
      const y = groundY - size * 0.3 - i * size * 0.34;
      ctx.beginPath();
      ctx.moveTo(x + size / 2, y - size * 0.42);
      ctx.lineTo(x + size / 2 - w / 2, y);
      ctx.lineTo(x + size / 2 + w / 2, y);
      ctx.closePath();
      ctx.fill();
    }
  }

  drawHouse(house, visibleBuilt, hx, houseW, groundY, layerH) {
    const { ctx } = this;
    for (let i = 0; i < visibleBuilt; i++) {
      const layer = house.layers[i];
      const y = groundY - (i + 1) * layerH;
      if (i === 0) {
        // 土台(石)
        ctx.fillStyle = '#a8adb3';
        rr(ctx, hx - 5, y, houseW + 10, layerH, 2);
        ctx.fill();
        ctx.fillStyle = '#8b9096';
        for (let s = 0; s < 5; s++) {
          ctx.beginPath();
          ctx.arc(hx + 8 + s * (houseW / 4.6), y + layerH / 2, layerH * 0.26, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (layer.type === 'roof') {
        this.drawRoofLayer(layer, i, hx, houseW, y, layerH, groundY);
      } else {
        this.drawLogRow(hx, y, houseW, layerH);
      }
    }
    // 特殊パーツ(ドア・窓)は丸太の上に重ねて描く
    for (let i = 0; i < visibleBuilt; i++) {
      const layer = house.layers[i];
      if (layer.type === 'wood' || layer.type === 'roof') continue;
      const yBottom = groundY - i * layerH;
      if (layer.type === 'door') {
        if (layer.matched) {
          const dw = houseW * 0.2;
          const dh = layerH * 2.1;
          ctx.fillStyle = '#5f3a1c';
          rr(ctx, hx + houseW / 2 - dw / 2, yBottom - dh, dw, dh, [4, 4, 0, 0]);
          ctx.fill();
          ctx.fillStyle = PALETTE.door.knob;
          ctx.beginPath();
          ctx.arc(hx + houseW / 2 + dw * 0.24, yBottom - dh * 0.45, 1.8, 0, Math.PI * 2);
          ctx.fill();
        } else {
          this.drawMissPatch(hx + houseW / 2, yBottom - layerH * 0.5, layerH);
        }
      } else if (layer.type === 'window') {
        const offset = (i <= 4 ? -1 : 1) * houseW * 0.22;
        const cx = hx + houseW / 2 + offset;
        const cy = yBottom - layerH * 0.5;
        if (layer.matched) {
          const s = layerH * 1.35;
          ctx.fillStyle = '#6d4a2a';
          rr(ctx, cx - s / 2 - 1.5, cy - s / 2 - 1.5, s + 3, s + 3, 2);
          ctx.fill();
          ctx.fillStyle = PALETTE.window.glass;
          ctx.fillRect(cx - s / 2, cy - s / 2, s, s);
          ctx.strokeStyle = '#6d4a2a';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(cx, cy - s / 2); ctx.lineTo(cx, cy + s / 2);
          ctx.moveTo(cx - s / 2, cy); ctx.lineTo(cx + s / 2, cy);
          ctx.stroke();
        } else {
          this.drawMissPatch(cx, cy, layerH);
        }
      }
    }
  }

  drawRoofLayer(layer, i, hx, houseW, y, layerH, groundY) {
    const { ctx } = this;
    const step = i - 8; // 0: 屋根下段, 1: 屋根上段
    const color = layer.matched ? PALETTE.roof : { a: '#a49a90', b: '#7d746b', line: '#5f574f' };
    const grad = ctx.createLinearGradient(0, y, 0, y + layerH);
    grad.addColorStop(0, color.a);
    grad.addColorStop(1, color.b);
    ctx.fillStyle = grad;
    ctx.strokeStyle = color.line;
    ctx.lineWidth = 1;
    if (step === 0) {
      const over = 12;
      ctx.beginPath();
      ctx.moveTo(hx - over, y + layerH);
      ctx.lineTo(hx + houseW * 0.16, y);
      ctx.lineTo(hx + houseW * 0.84, y);
      ctx.lineTo(hx + houseW + over, y + layerH);
      ctx.closePath();
    } else {
      ctx.beginPath();
      ctx.moveTo(hx + houseW * 0.13, y + layerH);
      ctx.lineTo(hx + houseW / 2, y - layerH * 0.9);
      ctx.lineTo(hx + houseW * 0.87, y + layerH);
      ctx.closePath();
    }
    ctx.fill();
    ctx.stroke();
    if (!layer.matched) this.drawMissPatch(hx + houseW / 2, y + layerH * 0.4, layerH);
  }

  drawLogRow(x, y, w, h) {
    const { ctx } = this;
    const pal = PALETTE.wood;
    const grad = ctx.createLinearGradient(0, y, 0, y + h);
    grad.addColorStop(0, pal.a);
    grad.addColorStop(1, pal.b);
    ctx.fillStyle = grad;
    rr(ctx, x, y + 0.5, w, h - 1, h / 2);
    ctx.fill();
    ctx.strokeStyle = pal.line;
    ctx.lineWidth = 0.8;
    ctx.stroke();
    // 丸太の切り口
    for (const ex of [x + h * 0.45, x + w - h * 0.45]) {
      ctx.fillStyle = pal.cap;
      ctx.beginPath();
      ctx.arc(ex, y + h / 2, h * 0.32, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = pal.capRing;
      ctx.stroke();
    }
  }

  drawMissPatch(cx, cy, layerH) {
    const { ctx } = this;
    const s = layerH * 1.2;
    ctx.strokeStyle = '#d84343';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(cx - s / 2, cy - s / 2); ctx.lineTo(cx + s / 2, cy + s / 2);
    ctx.moveTo(cx + s / 2, cy - s / 2); ctx.lineTo(cx - s / 2, cy + s / 2);
    ctx.stroke();
  }

  // ================= 設計図パネル =================
  drawBlueprint(game, time) {
    const { ctx } = this;
    const area = this.layout.house;
    const W = this.layout.W;
    const bpW = 92;
    const x0 = W - bpW - 6;
    const y0 = area.y + 6;
    const h0 = area.h - 12;
    const layers = game.house.layers;
    const rowH = Math.min(13, (h0 - 22) / layers.length);
    const visibleBuilt = this.houseGeom.visibleBuilt;

    ctx.fillStyle = 'rgba(255,255,255,0.62)';
    rr(ctx, x0, y0, bpW, h0, 8);
    ctx.fill();

    ctx.fillStyle = '#4a3b2a';
    ctx.font = 'bold 10px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('せっけいず', x0 + bpW / 2, y0 + 10);

    const baseY = y0 + h0 - 8;
    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i];
      const y = baseY - (i + 1) * rowH + rowH / 2;
      const isNext = i === game.house.next;

      if (isNext) {
        const pulse = 0.25 + 0.2 * Math.sin(time * 6);
        ctx.fillStyle = `rgba(255, 170, 60, ${pulse + 0.2})`;
        rr(ctx, x0 + 3, y - rowH / 2 + 0.5, bpW - 6, rowH - 1, 4);
        ctx.fill();
      }

      // 種別アイコン
      const pal = PALETTE[layer.type];
      ctx.fillStyle = pal.a;
      ctx.strokeStyle = pal.line;
      ctx.lineWidth = 1;
      rr(ctx, x0 + 8, y - 4.5, 9, 9, 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = layer.type === 'wood' ? '#5c4a35' : '#3d2f1e';
      ctx.font = `${layer.type === 'wood' ? '' : 'bold '}9px -apple-system, sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText(layer.label, x0 + 22, y + 0.5);

      // 状態: 建築済みは○✕、次の段は▶
      ctx.textAlign = 'right';
      if (i < visibleBuilt) {
        ctx.font = 'bold 9px -apple-system, sans-serif';
        ctx.fillStyle = layer.matched ? '#2e9e44' : '#d84343';
        ctx.fillText(layer.matched ? '✓' : '✕', x0 + bpW - 8, y + 0.5);
      } else if (isNext) {
        ctx.font = 'bold 9px -apple-system, sans-serif';
        ctx.fillStyle = '#e07b1a';
        ctx.fillText('つぎ', x0 + bpW - 8, y + 0.5);
      }
    }
  }

  // ================= 中段ストリップ(次の段 + ネクスト) =================
  drawStrip(game, time) {
    const { ctx } = this;
    const s = this.layout.strip;

    ctx.fillStyle = 'rgba(255,255,255,0.58)';
    rr(ctx, s.x, s.y, s.w, s.h, 10);
    ctx.fill();

    // --- 次に建てる段(パーツ名のみを大きく表示。全ラベル2文字以内) ---
    const layer = game.house.nextLayer();
    const chipW = 98;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#6b5a44';
    ctx.font = 'bold 11px -apple-system, sans-serif';
    ctx.fillText('つぎの だん', s.x + 10, s.y + 12);

    if (layer) {
      const special = layer.type !== 'wood';
      const chipH = s.h - 27;
      const cy = s.y + 20 + chipH / 2;
      // チップ背景(特殊パーツは強調色 + パルス枠)
      ctx.fillStyle = special ? 'rgba(255, 238, 214, 0.95)' : 'rgba(255, 255, 255, 0.45)';
      rr(ctx, s.x + 6, s.y + 20, chipW, chipH, 8);
      ctx.fill();
      if (special) {
        const pulse = 0.5 + 0.5 * Math.sin(time * 5);
        ctx.strokeStyle = `rgba(224, 123, 26, ${0.35 + pulse * 0.5})`;
        ctx.lineWidth = 2;
        rr(ctx, s.x + 6, s.y + 20, chipW, chipH, 8);
        ctx.stroke();
      }
      const pal = PALETTE[layer.type];
      ctx.fillStyle = pal.a;
      ctx.strokeStyle = pal.line;
      ctx.lineWidth = 1;
      rr(ctx, s.x + 14, cy - 9, 18, 18, 4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = special ? '#c9660f' : '#3d2f1e';
      ctx.font = 'bold 17px -apple-system, sans-serif';
      ctx.fillText(layer.label, s.x + 40, cy + 0.5);
    } else {
      ctx.fillStyle = '#2e9e44';
      ctx.font = 'bold 15px -apple-system, sans-serif';
      ctx.fillText('かんせい!', s.x + 12, s.y + s.h / 2 + 6);
    }

    // --- ネクストピース(横3マスぶんのガイド付きスロットに大きく表示) ---
    ctx.fillStyle = '#6b5a44';
    ctx.font = 'bold 11px -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('つぎの ピース', s.x + s.w - 10, s.y + 12);

    const previews = game.queue.preview();
    const px0 = s.x + chipW + 16;
    const pw = s.x + s.w - 10 - px0;
    const gap = 6;
    const slotW = (pw - gap * (previews.length - 1)) / previews.length;
    const cellMini = slotW / 3; // ピース最大幅=3マスを常に確保
    const slotH = cellMini + 6;
    const sy = s.y + 20 + (s.h - 27 - slotH) / 2;

    for (let i = 0; i < previews.length; i++) {
      const p = previews[i];
      const sx = px0 + i * (slotW + gap);
      ctx.save();
      ctx.globalAlpha = i === 0 ? 1 : 0.62;
      // スロット背景
      ctx.fillStyle = 'rgba(107, 74, 44, 0.10)';
      rr(ctx, sx, sy, slotW, slotH, 5);
      ctx.fill();
      // マス目ガイド(点線): 何マスのピースかが一目で分かる
      ctx.strokeStyle = 'rgba(107, 74, 44, 0.45)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      for (let c = 0; c < 3; c++) {
        rr(ctx, sx + c * cellMini + 1.5, sy + 3, cellMini - 3, slotH - 6, 3);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      // ピース本体(左詰めでマス目に合わせる)
      this.drawPieceBody(sx + 1, sy + 3, p.w * cellMini - 2, slotH - 6, p.type, p.berry);
      ctx.restore();
    }
  }

  // ================= 盤面 =================
  drawBoard(game, effects, view, time) {
    const { ctx } = this;
    const g = this.layout.grid;
    const cell = g.cell;

    // 枠(丸太フレーム)
    ctx.fillStyle = '#33413a';
    rr(ctx, g.x - 5, g.y - 5, g.w + 10, g.h + 10, 10);
    ctx.fill();
    ctx.strokeStyle = '#6b4a2c';
    ctx.lineWidth = 5;
    rr(ctx, g.x - 5, g.y - 5, g.w + 10, g.h + 10, 10);
    ctx.stroke();

    // グリッド線
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let c = 1; c < COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(g.x + c * cell, g.y);
      ctx.lineTo(g.x + c * cell, g.y + g.h);
      ctx.stroke();
    }
    for (let r = 1; r < ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(g.x, g.y + r * cell);
      ctx.lineTo(g.x + g.w, g.y + r * cell);
      ctx.stroke();
    }

    // 操作ガイド(掴んでいる列のハイライト + 着地ゴースト)
    const active = game.active;
    if (active && game.phase === 'idle' && !view.dropAnim) {
      const ghost = game.ghostRow();
      if (ghost >= 0) {
        ctx.fillStyle = view.grabbing ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.05)';
        ctx.fillRect(g.x + active.col * cell, g.y, active.piece.w * cell, (ghost + 1) * cell);
        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 4]);
        rr(ctx, g.x + active.col * cell + 2, g.y + ghost * cell + 2, active.piece.w * cell - 4, cell - 4, cell * 0.22);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // 確定済みセル
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cellData = game.board.cell(r, c);
        if (!cellData) continue;
        this.drawSegment(g.x + c * cell, g.y + r * cell, cell, cellData);
      }
    }

    // 危険ゾーン警告
    const top = game.board.stackTop();
    if (top <= 3 && top < ROWS) {
      const pulse = 0.10 + 0.08 * Math.sin(time * 7);
      const danger = ctx.createLinearGradient(0, g.y, 0, g.y + cell * 2.5);
      danger.addColorStop(0, `rgba(230, 60, 60, ${pulse + 0.12})`);
      danger.addColorStop(1, 'rgba(230, 60, 60, 0)');
      ctx.fillStyle = danger;
      ctx.fillRect(g.x, g.y, g.w, cell * 2.5);
    }

    // 落下中 or 待機中のアクティブピース
    if (view.dropAnim) {
      const a = view.dropAnim;
      const t = Math.min(1, a.t / a.dur);
      const y = a.y0 + (a.y1 - a.y0) * easeInQuad(t);
      this.drawPieceBody(a.x, y, a.piece.w * cell, cell, a.piece.type, a.piece.berry);
    } else if (active && (game.phase === 'idle' || game.phase === 'topout')) {
      const y = this.hoverPieceY();
      const bob = view.grabbing ? 0 : Math.sin(time * 2.4) * 2;
      const w = active.piece.w * cell;
      ctx.save();
      ctx.translate(view.pieceX + w / 2, y + cell / 2 + bob);
      ctx.rotate(view.tilt);
      const scale = view.grabbing ? 1.07 : 1;
      ctx.scale(scale, scale);
      if (view.grabbing) {
        ctx.shadowColor = 'rgba(0,0,0,0.35)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 5;
      }
      this.drawPieceBody(-w / 2, -cell / 2, w, cell, active.piece.type, active.piece.berry);
      ctx.restore();

      // 初回ヒント
      if (view.hint) {
        ctx.fillStyle = 'rgba(60,45,25,0.85)';
        ctx.font = 'bold 12px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const hy = this.layout.hoverY - 4 + Math.sin(time * 3) * 1.5;
        ctx.fillText('← ドラッグでうごかす / はなすと おちるよ →', this.layout.W / 2, hy);
      }
    }

    // 着地スカッシュ(ぷにっと潰れる)
    if (effects.landSquash) {
      const sq = effects.landSquash;
      const p = sq.t / 0.13;
      const sy = 0.72 + 0.28 * p;
      const sx = 1.22 - 0.22 * p;
      const w = sq.piece.w * cell;
      const cx = g.x + sq.col * cell + w / 2;
      const by = g.y + (sq.row + 1) * cell;
      ctx.save();
      ctx.translate(cx, by);
      ctx.scale(sx, sy);
      this.drawPieceBody(-w / 2, -cell, w, cell, sq.piece.type, sq.piece.berry);
      ctx.restore();
    }
  }

  // 1ピース丸ごと(待機・落下・プレビュー・スカッシュ用)
  drawPieceBody(x, y, w, h, type, berry) {
    const { ctx } = this;
    const pal = PALETTE[type];
    const r = h * 0.3;
    const grad = ctx.createLinearGradient(0, y, 0, y + h);
    grad.addColorStop(0, pal.a);
    grad.addColorStop(1, pal.b);
    ctx.fillStyle = grad;
    rr(ctx, x, y + h * 0.06, w, h * 0.88, r);
    ctx.fill();
    ctx.strokeStyle = pal.line;
    ctx.lineWidth = Math.max(1, h * 0.05);
    ctx.stroke();
    this.drawTypeDeco(x, y + h * 0.06, w, h * 0.88, type);
    if (berry) this.drawBerry(x + w / 2, y + h * 0.16, h);
  }

  // 盤面の1セル(丸太の連結を cap で表現)
  drawSegment(x, y, cell, data) {
    const { ctx } = this;
    const pal = PALETTE[data.type];
    const r = cell * 0.28;
    const pad = cell * 0.04;
    const radii = {
      solo: [r, r, r, r],
      left: [r, 0, 0, r],
      right: [0, r, r, 0],
      mid: [0, 0, 0, 0],
    }[data.cap] || [r, r, r, r];

    const grad = ctx.createLinearGradient(0, y, 0, y + cell);
    grad.addColorStop(0, pal.a);
    grad.addColorStop(1, pal.b);
    ctx.fillStyle = grad;
    const x0 = data.cap === 'left' || data.cap === 'solo' ? x + pad : x - 0.5;
    const x1 = data.cap === 'right' || data.cap === 'solo' ? x + cell - pad : x + cell + 0.5;
    rr(ctx, x0, y + pad, x1 - x0, cell - pad * 2, radii);
    ctx.fill();
    ctx.strokeStyle = pal.line;
    ctx.lineWidth = 1;
    ctx.stroke();

    this.drawTypeDeco(x + pad * 0.5, y + pad, cell - pad, cell - pad * 2, data.type, data.cap);
    if (data.berry) this.drawBerry(x + cell / 2, y + cell * 0.2, cell);
  }

  drawTypeDeco(x, y, w, h, type, cap) {
    const { ctx } = this;
    const pal = PALETTE[type];
    if (type === 'wood') {
      // 木目
      ctx.strokeStyle = 'rgba(90, 55, 20, 0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + w * 0.14, y + h * 0.38);
      ctx.lineTo(x + w * 0.86, y + h * 0.38);
      ctx.moveTo(x + w * 0.2, y + h * 0.66);
      ctx.lineTo(x + w * 0.8, y + h * 0.66);
      ctx.stroke();
      // 切り口(端のみ)。幅1マス相当は中央にひとつだけ
      const drawCap = (cx) => {
        ctx.fillStyle = pal.cap;
        ctx.beginPath();
        ctx.arc(cx, y + h / 2, h * 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = pal.capRing;
        ctx.stroke();
      };
      if (w < h * 1.5) {
        drawCap(x + w / 2);
      } else {
        if (!cap || cap === 'left' || cap === 'solo') drawCap(x + h * 0.34);
        if (!cap || cap === 'right' || cap === 'solo') drawCap(x + w - h * 0.34);
      }
    } else if (type === 'window') {
      const ix = x + w * 0.14, iy = y + h * 0.2, iw = w * 0.72, ih = h * 0.6;
      ctx.fillStyle = pal.glass;
      rr(ctx, ix, iy, iw, ih, 2);
      ctx.fill();
      ctx.strokeStyle = pal.line;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(ix + iw / 2, iy); ctx.lineTo(ix + iw / 2, iy + ih);
      ctx.stroke();
      // 光沢
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath();
      ctx.moveTo(ix + iw * 0.12, iy + ih * 0.6);
      ctx.lineTo(ix + iw * 0.3, iy + ih * 0.2);
      ctx.stroke();
    } else if (type === 'door') {
      ctx.strokeStyle = 'rgba(40, 22, 8, 0.5)';
      ctx.lineWidth = 1;
      rr(ctx, x + w * 0.18, y + h * 0.18, w * 0.64, h * 0.64, 2);
      ctx.stroke();
      // ノブはドアの右端だけに描く
      if (!cap || cap === 'right' || cap === 'solo') {
        ctx.fillStyle = pal.knob;
        ctx.beginPath();
        ctx.arc(x + w * 0.72, y + h * 0.52, Math.max(1.5, h * 0.07), 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (type === 'roof') {
      // 瓦のスカラップ
      ctx.strokeStyle = 'rgba(80, 25, 15, 0.4)';
      ctx.lineWidth = 1;
      const n = Math.max(2, Math.round(w / (h * 0.8)));
      for (let i = 0; i < n; i++) {
        const cx = x + (i + 0.5) * (w / n);
        ctx.beginPath();
        ctx.arc(cx, y + h * 0.42, w / n / 2.4, 0, Math.PI);
        ctx.stroke();
      }
    }
  }

  drawBerry(cx, cy, cell) {
    const { ctx } = this;
    const r = Math.max(2.4, cell * 0.13);
    // 葉
    ctx.fillStyle = '#4e9e3f';
    ctx.beginPath();
    ctx.ellipse(cx, cy - r * 0.9, r * 0.8, r * 0.42, -0.5, 0, Math.PI * 2);
    ctx.fill();
    // 実 ×2
    for (const [dx, dy] of [[-r * 0.62, r * 0.5], [r * 0.62, r * 0.55]]) {
      ctx.fillStyle = '#e23b52';
      ctx.beginPath();
      ctx.arc(cx + dx, cy + dy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.beginPath();
      ctx.arc(cx + dx - r * 0.3, cy + dy - r * 0.3, r * 0.28, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ================= エフェクト =================
  drawEffectsOverlay(effects) {
    const { ctx } = this;

    for (const f of effects.flashes) {
      const a = 1 - f.t / f.life;
      ctx.fillStyle = `rgba(255, 245, 200, ${a * 0.85})`;
      rr(ctx, f.x, f.y, f.w, f.h, 4);
      ctx.fill();
    }

    for (const p of effects.particles) {
      const a = 1 - p.t / p.life;
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const f of effects.floats) {
      const a = f.t < 0.2 ? f.t / 0.2 : 1 - (f.t - 0.2) / (f.life - 0.2);
      ctx.globalAlpha = Math.max(0, a);
      ctx.font = 'bold 15px -apple-system, sans-serif';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      const y = f.y - f.t * 34;
      ctx.strokeText(f.text, f.x, y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, y);
    }
    ctx.globalAlpha = 1;
  }

  drawRewindFx(t) {
    const { ctx } = this;
    const L = this.layout;
    ctx.fillStyle = `rgba(255, 240, 205, ${t * 0.45})`;
    ctx.fillRect(0, 0, L.W, L.H);
    // 逆回転の弧
    ctx.strokeStyle = `rgba(224, 123, 26, ${t * 0.85})`;
    ctx.lineWidth = 4;
    const cx = L.W / 2, cy = L.H * 0.45;
    for (let i = 0; i < 3; i++) {
      const r = 34 + i * 26 + (1 - t) * 40;
      ctx.beginPath();
      ctx.arc(cx, cy, r, Math.PI * (0.2 + t), Math.PI * (1.3 + t));
      ctx.stroke();
    }
    ctx.globalAlpha = Math.min(1, t * 1.6);
    ctx.font = 'bold 40px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⏪', cx, cy);
    ctx.globalAlpha = 1;
  }
}
