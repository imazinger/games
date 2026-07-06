// ルールエンジンのテスト。
// Node があれば `node tests/game.test.js`、なければ tests/index.html をブラウザで開いて実行。
import {
  EMPTY, BROWN, WHITE,
  initialBoard, flipsFor, legalMoves, applyMove,
  countStones, resolveTurn, winner, boardToString, boardFromString,
} from "../js/game.js";

// Node 環境に依存しない最小限のアサーション
const assert = {
  ok(value, message = "expected truthy") {
    if (!value) throw new Error(message);
  },
  equal(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(message || `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
  },
  deepEqual(actual, expected, message) {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a !== e) throw new Error(message || `expected ${e}, got ${a}`);
  },
};

const tests = [];
function test(name, fn) {
  tests.push([name, fn]);
}

test("初期盤面は中央4石", () => {
  const b = initialBoard();
  const { brown, white } = countStones(b);
  assert.equal(brown, 2);
  assert.equal(white, 2);
  assert.equal(b[27], WHITE);
  assert.equal(b[28], BROWN);
  assert.equal(b[35], BROWN);
  assert.equal(b[36], WHITE);
});

test("先手(茶くま)の初手は4箇所", () => {
  const moves = legalMoves(initialBoard(), BROWN);
  assert.deepEqual([...moves].sort((a, b) => a - b), [19, 26, 37, 44]);
});

test("初手を打つと相手の石が1つ裏返る", () => {
  const b = initialBoard();
  const result = applyMove(b, BROWN, 19);
  assert.ok(result);
  assert.deepEqual(result.flips, [27]);
  assert.equal(result.board[19], BROWN);
  assert.equal(result.board[27], BROWN);
  const { brown, white } = countStones(result.board);
  assert.equal(brown, 4);
  assert.equal(white, 1);
});

test("空マスでない場所・挟めない場所には打てない", () => {
  const b = initialBoard();
  assert.equal(applyMove(b, BROWN, 27), null); // 石がある
  assert.equal(applyMove(b, BROWN, 0), null); // 何も挟めない
});

test("盤端で左右にラップして裏返らない", () => {
  const b = new Array(64).fill(EMPTY);
  b[7] = WHITE;
  b[8] = WHITE;
  b[9] = BROWN;
  // 6 に茶を打っても 7 の白は挟めない(8 は次の行なのでラップ不成立)
  assert.deepEqual(flipsFor(b, BROWN, 6), []);
});

test("両者打てなければ終局", () => {
  const b = new Array(64).fill(BROWN);
  const r = resolveTurn(b, BROWN);
  assert.equal(r.over, true);
  assert.equal(winner(b), BROWN);
});

test("引き分け判定", () => {
  const b = new Array(64).fill(EMPTY);
  for (let i = 0; i < 32; i++) b[i] = BROWN;
  for (let i = 32; i < 64; i++) b[i] = WHITE;
  assert.equal(winner(b), EMPTY);
});

test("盤面の文字列変換が往復できる", () => {
  const b = initialBoard();
  const s = boardToString(b);
  assert.equal(s.length, 64);
  assert.deepEqual(boardFromString(s), b);
});

test("ランダム対局が必ず終局する", () => {
  for (let trial = 0; trial < 50; trial++) {
    let board = initialBoard();
    let turn = BROWN;
    let plies = 0;
    while (turn !== EMPTY) {
      const moves = legalMoves(board, turn);
      assert.ok(moves.length > 0, "手番プレイヤーには必ず合法手がある");
      const idx = moves[Math.floor(Math.random() * moves.length)];
      const result = applyMove(board, turn, idx);
      assert.ok(result, "合法手が適用できない");
      board = result.board;
      const r = resolveTurn(board, turn);
      turn = r.over ? EMPTY : r.turn;
      plies++;
      assert.ok(plies <= 130, "対局が長すぎる(無限ループの疑い)");
    }
    const { brown, white } = countStones(board);
    assert.ok(brown + white <= 64);
    assert.ok(brown + white >= 4);
  }
});

export function runTests(log = console.log, error = console.error) {
  let failed = 0;
  for (const [name, fn] of tests) {
    try {
      fn();
      log(`ok - ${name}`);
    } catch (err) {
      failed++;
      error(`NG - ${name}: ${err.message}`);
    }
  }
  log(failed === 0 ? `all ${tests.length} tests passed` : `${failed} test(s) failed`);
  return failed;
}

// Node から直接実行された場合
if (typeof process !== "undefined" && process.argv?.[1]?.endsWith("game.test.js")) {
  process.exit(runTests() === 0 ? 0 : 1);
}
