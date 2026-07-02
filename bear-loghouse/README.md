# くまのログハウス (プロトタイプ)

スマホ縦画面向けのオリジナル落ち物パズル。
ピースをドラッグ&ドロップで積み上げ、横1列を「建材」として回収し、
クマが運んでログハウスを1段ずつ建てていく。実(🍒)付きの列を回収すると
タイムバック権を得て、失敗を数手前まで巻き戻せる。

## 遊び方

1. 画面上部に出現したピースを指でドラッグして左右に移動、離すと落下
2. 横1列そろえると回収され、その列がログハウスの「次の段」になる
3. 「つぎの だん」に表示されたパーツ(窓・ドア・屋根)を列に含めてから回収すると一致
4. 設計図(10段)との一致率90%以上でステージクリア

## 起動(ローカル)

ES Modules を使っているため、静的サーバー経由で開く:

```sh
python3 -m http.server 8123 --directory loghouse-puzzle
# → http://localhost:8123 をiPhone Safariで開く
```

## GitHub Pages で公開

サーバー側処理はなく、全パスが相対指定のためリポジトリ配下のURLでそのまま動く。

1. GitHubでリポジトリを作成し、`loghouse-puzzle/` の中身をリポジトリ直下に push する
   ```sh
   cd loghouse-puzzle
   git init && git add -A && git commit -m "くまのログハウス プロトタイプ"
   git remote add origin https://github.com/<ユーザー名>/<リポジトリ名>.git
   git push -u origin main
   ```
2. リポジトリの **Settings → Pages** を開き、
   **Source: Deploy from a branch / Branch: `main` / フォルダ: `/ (root)`** を選択して保存
3. 数分後に `https://<ユーザー名>.github.io/<リポジトリ名>/` で公開される
   (iPhone Safariで開き、ホーム画面に追加するとフルスクリーンで遊べる)

補足:
- `.nojekyll` を同梱済み(Jekyllビルドを無効化し、素の静的ファイルとして配信させる)
- `serve.rb` はローカル開発用。公開に影響しないのでそのまま置いてよい
- サブパス配信での動作(css/src の相対読み込み・ES Modules・ゲームプレイ)は検証済み

## アーキテクチャ

レイヤーを分離し、SwiftUI / SpriteKit への移植を想定した構成。

```
src/
  core/      # 純粋なゲームロジック(DOM非依存・決定論的)
    config.js   # 定数・設計図・チューニング値
    rng.js      # snapshot可能な乱数
    pieces.js   # ピース定義と供給キュー(設計図の需要を見て自己補正)
    board.js    # 盤面・着地判定・列回収
    house.js    # ログハウス・設計図一致judge・採点
    history.js  # タイムバック用スナップショット履歴
    game.js     # 状態機械(idle/dropping/topout/finished/gameover)
  input/     # Pointer Events → grab/move/release 意図への変換
  render/    # Canvas描画(renderer)と演出状態(effects)
  audio/     # WebAudio簡易シンセ
  ui/        # DOM側HUD(ボタン・モーダル・トースト)
  main.js    # 配線・アニメーションのシーケンス・メインループ
```

- **core は同期API**: `drop()` → (演出) → `lock()` の2段階で、演出時間は
  呼び出し側(main.js)が管理する。ロジックにタイマーを持たせない。
- **タイムバック**: 各手の直前に全状態(盤面/家/キュー/乱数)をスナップショット。
  トークンは履歴の外に置くことで巻き戻しによる増殖を防ぐ。
  消費はセッション制: 開始時に1個だけ消費し、連続で押して更に過去へ戻るのは無料。
  パズル操作(掴む・移動・落下)を行った時点でセッション確定し、次回はまた1個消費。
- **デバッグ**: コンソールで `__game.autoStep()`(自動1手)、`__game.restart()`。

## 採点ルール

- 設計図は10段(土台/壁×4/ドア/窓×2/屋根×2)
- 回収した列に、その段の必要パーツが1つでも含まれていれば一致
- 壁の段は常に一致(特殊パーツが混ざっていても減点なし)
- 一致率 = 一致段数 / 10。90%以上でクリア(=特殊パーツの失敗は1回まで)
