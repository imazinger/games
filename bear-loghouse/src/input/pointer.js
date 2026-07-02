// Pointer Events を grab / move / release の意図に変換する。
// iOS Safari 最優先: スクロール・ダブルタップズーム・長押しを抑止する。
export class PointerInput {
  constructor(el, handlers) {
    this.el = el;
    this.h = handlers;
    this.activeId = null;

    el.addEventListener('pointerdown', (e) => {
      if (this.activeId !== null) return; // マルチタッチは最初の指だけ
      this.activeId = e.pointerId;
      try { el.setPointerCapture(e.pointerId); } catch (_) { /* noop */ }
      e.preventDefault();
      this.h.onGrab?.(this.pos(e));
    });

    el.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.activeId) return;
      e.preventDefault();
      this.h.onMove?.(this.pos(e));
    });

    const end = (e) => {
      if (e.pointerId !== this.activeId) return;
      this.activeId = null;
      e.preventDefault();
      this.h.onRelease?.(this.pos(e));
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', (e) => {
      if (e.pointerId !== this.activeId) return;
      this.activeId = null;
      this.h.onCancel?.();
    });

    // iOS のスクロール連動・ズームを確実に止める(touch-action: none と併用)
    el.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
    el.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  pos(e) {
    const r = this.el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
}
