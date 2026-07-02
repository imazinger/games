// 盤面。grid[row][col] = null | { type, berry, cap, pid }
// row 0 が最上段。cap は丸太の描画用(left/mid/right/solo)
export class Board {
  constructor(cols, rows) {
    this.cols = cols;
    this.rows = rows;
    this.grid = Array.from({ length: rows }, () => Array(cols).fill(null));
  }

  cell(r, c) { return this.grid[r][c]; }

  topFilled(col) {
    for (let r = 0; r < this.rows; r++) if (this.grid[r][col]) return r;
    return this.rows;
  }

  // その列に幅wのピースを落としたときの着地行。-1なら置けない
  landingRow(col, w) {
    let m = this.rows;
    for (let c = col; c < col + w; c++) m = Math.min(m, this.topFilled(c));
    return m - 1;
  }

  place(piece, col, row) {
    for (let i = 0; i < piece.w; i++) {
      const cap = piece.w === 1 ? 'solo' : i === 0 ? 'left' : i === piece.w - 1 ? 'right' : 'mid';
      this.grid[row][col + i] = {
        type: piece.type,
        berry: piece.berry && i === Math.floor((piece.w - 1) / 2),
        cap,
        pid: piece.id,
      };
    }
  }

  fullRows() {
    const out = [];
    for (let r = 0; r < this.rows; r++) if (this.grid[r].every((c) => c)) out.push(r);
    return out;
  }

  rowCells(r) { return this.grid[r].map((c) => (c ? { ...c } : null)); }

  clearRows(rows) {
    const set = new Set(rows);
    const kept = this.grid.filter((_, r) => !set.has(r));
    while (kept.length < this.rows) kept.unshift(Array(this.cols).fill(null));
    this.grid = kept;
  }

  // 積み上がりの最上段(危険度表示用)。空なら rows
  stackTop() {
    for (let r = 0; r < this.rows; r++) if (this.grid[r].some((c) => c)) return r;
    return this.rows;
  }

  snapshot() { return this.grid.map((row) => row.map((c) => (c ? { ...c } : null))); }
  restore(g) { this.grid = g.map((row) => row.map((c) => (c ? { ...c } : null))); }
}
