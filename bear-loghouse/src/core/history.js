// タイムバック用のスナップショット履歴(直近 limit 手)
export class History {
  constructor(limit) {
    this.limit = limit;
    this.stack = [];
  }
  push(s) {
    this.stack.push(s);
    if (this.stack.length > this.limit) this.stack.shift();
  }
  pop() { return this.stack.pop(); }
  get size() { return this.stack.length; }
  clear() { this.stack.length = 0; }
}
