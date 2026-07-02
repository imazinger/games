import { MAX_TOKENS } from '../core/config.js';

const TYPE_ICON = { wood: '🪵', window: '🪟', door: '🚪', roof: '🔺' };

// DOM側のUI(ボタン・トークン表示・トースト・モーダル)
export class HUD {
  constructor(handlers) {
    this.h = handlers;
    this.rewindBtn = document.getElementById('rewindBtn');
    this.tokenEl = document.getElementById('tokenCount');
    this.muteBtn = document.getElementById('muteBtn');
    this.restartBtn = document.getElementById('restartBtn');
    this.toastEl = document.getElementById('toast');
    this.overlay = document.getElementById('overlay');
    this._cache = {};
    this._toastTimer = null;

    this.rewindBtn.addEventListener('click', () => this.h.onRewind());
    this.restartBtn.addEventListener('click', () => this.h.onRestart());
    this.muteBtn.addEventListener('click', () => {
      const muted = this.h.onMute();
      this.muteBtn.textContent = muted ? '🔇' : '🔊';
    });
  }

  // 毎フレーム呼ばれる。変化があった時だけDOMを触る
  update(game) {
    const pips = '●'.repeat(game.tokens) + '○'.repeat(MAX_TOKENS - game.tokens);
    if (this._cache.pips !== pips) {
      this._cache.pips = pips;
      this.tokenEl.textContent = pips;
    }
    const can = game.canRewind();
    if (this._cache.can !== can) {
      this._cache.can = can;
      this.rewindBtn.classList.toggle('disabled', !can);
    }
  }

  toast(msg) {
    this.toastEl.textContent = msg;
    this.toastEl.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => this.toastEl.classList.remove('show'), 1700);
  }

  pulseRewind(on) {
    this.rewindBtn.classList.toggle('pulse', on);
  }

  showStart(onStart) {
    this.overlay.innerHTML = `
      <div class="card">
        <h1>🧸 くまのログハウス</h1>
        <p class="lead">ピースを ドラッグして<br>ログハウスを たてよう!</p>
        <ul class="howto">
          <li><span>👆</span>よこ1れつ そろえると クマが はこんで 1だん たつよ</li>
          <li><span>🪟</span>「つぎの だん」の パーツを れつに いれてから そろえよう</li>
          <li><span>🍒</span>実つきの れつを そろえると ⏪タイムバックけん ゲット</li>
          <li><span>🏠</span>せっけいず と 90%いじょう いっちで クリア!</li>
        </ul>
        <button id="startBtn" class="primary">はじめる</button>
      </div>`;
    this.overlay.classList.remove('hidden');
    document.getElementById('startBtn').addEventListener('click', () => {
      this.hideOverlay();
      onStart?.();
    });
  }

  showResult(score, layers, gameover = false) {
    const pct = Math.round(score.rate * 100);
    const title = gameover
      ? '🪵 つみあげすぎた…'
      : score.cleared ? '🎉 ステージクリア!' : '😢 もう すこし!';
    const dots = layers.map((l) => {
      const cls = l.built ? (l.matched ? 'ok' : 'ng') : 'none';
      return `<span class="dot ${cls}">${TYPE_ICON[l.type]}</span>`;
    }).join('');
    this.overlay.innerHTML = `
      <div class="card">
        <h2>${title}</h2>
        <div class="rate"><span class="rate-num">${pct}</span><span class="rate-unit">%</span></div>
        <div class="rate-caption">せっけいず いっちりつ (${score.correct}/${score.total})</div>
        <div class="layer-dots">${dots}</div>
        <button id="retryBtn" class="primary">もういちど あそぶ</button>
      </div>`;
    this.overlay.classList.remove('hidden');
    document.getElementById('retryBtn').addEventListener('click', () => {
      this.hideOverlay();
      this.h.onRestart();
    });
  }

  hideOverlay() { this.overlay.classList.add('hidden'); }
}
