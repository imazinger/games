# くまリバーシ (Bear Reversi)

かわいい「くま」をテーマにした、2人用オンラインリバーシ。
しろくま と 茶くま に分かれて、はちみつ(盤面)を取り合います 🍯

- **2人オンライン対戦**: 片方がルームを作り、4文字のルームコード(または招待リンク)で相手が参加
- **CPU対戦**: しろくま(コンピュータ)とひとりで対戦。終盤は読み切ってくるので結構つよい
- **同一端末対戦**: Firebase の設定がなくても、1台のスマホを交互に操作して遊べる
- **スマホ最適化**: 縦画面で快適に遊べるレイアウト
- **勝敗表示**: 終局すると勝者のくまが王冠つきでお祝いされる
- **連勝カウント**: 同じルームで再戦するかぎり「つうせん ◯勝 - ◯勝」を記録
- **スタンプ**: オンライン対戦中に 🐾🍯❤️😆😭👏 を相手に送れる
- **効果音**: WebAudioで合成(音声ファイルなし)。ゲーム画面右上の🔊でオン/オフ、設定は端末に保存

## あそびかた

1. ホストが「ルームをつくる」を押す
2. 表示された4文字のコードを相手に伝える(「しょうたいリンクをコピー」でリンク共有もOK)
3. 相手がコードを入力して「はいる」を押すと対戦開始
4. ホストが茶くま(先手)、参加者がしろくま(後手)。「もういちど」で先手・後手を入れ替えて再戦

## 構成

| 項目 | 採用したもの | 理由 |
|---|---|---|
| フロントエンド | Vanilla JS (ES Modules) | ビルド不要。push するだけで GitHub Pages に公開できる |
| 通信 | Firebase Realtime Database | 無料(Sparkプラン)・サーバー保守ゼロ・切断検知つき |
| ホスティング | GitHub Pages | この games リポジトリの一部としてそのまま公開 |

### フォルダ構成

```
bear-reversi/
├── index.html            # 画面(ホーム / 待機 / ゲーム / 結果)
├── css/style.css         # くまテーマのスタイル・アニメーション
├── js/
│   ├── game.js           # リバーシのルールエンジン(純ロジック・依存なし)
│   ├── ai.js             # CPU(しろくま)の思考ルーチン(alpha-beta探索)
│   ├── bears.js          # くまの顔のSVGアセット
│   ├── sound.js          # WebAudio合成の効果音
│   ├── ui.js             # DOM描画(盤面・演出・トースト・スタンプ)
│   ├── net.js            # Firebaseルーム管理・状態同期
│   ├── firebase-config.js # ★Firebaseの設定を貼る場所
│   └── main.js           # コントローラ(画面遷移・対戦進行)
├── tests/                # ルールエンジンのテスト
└── database.rules.json   # Realtime Database のセキュリティルール
```

### 通信のしくみ

- ルームは `rooms/{4文字コード}` に保存
- 手番のプレイヤーが打つと、新しい盤面(64文字の文字列)・手番・手数をまとめて書き込む
- 双方のクライアントは同じルームを購読し、**常にDBの状態を描画する**(DBが唯一の正)
- 参加は「トランザクション」で席を取るので、3人目は入れない
- `.info/connected` と `onDisconnect` で相手の切断を検知・表示。リロードしても同じルームに自動復帰

## オンライン対戦のセットアップ(初回のみ・約10分)

1. [Firebase Console](https://console.firebase.google.com/) で「プロジェクトを追加」(名前は `bear-reversi` など。Googleアナリティクスは不要)
2. 左メニュー「構築 > Realtime Database」→「データベースを作成」
   - ロケーションはどこでもOK(例: `asia-southeast1`)
   - セキュリティルールは「ロックモード」で開始
3. 「ルール」タブに [database.rules.json](database.rules.json) の内容を貼り付けて「公開」
4. プロジェクトの設定(⚙) > 「マイアプリ」> ウェブアプリを追加(`</>` アイコン)
   - Hosting は不要
5. 表示される `firebaseConfig` の値を [js/firebase-config.js](js/firebase-config.js) にコピー
   - `databaseURL` が含まれていない場合は、Realtime Database の画面上部に表示される
     `https://xxxx-default-rtdb.xxxx.firebasedatabase.app` を追記する
6. commit して push すれば完了

> **メモ**: ルームコードを知っている人だけが盤面を読み書きできる簡易ルールです。
> 2人で遊ぶ用途には十分ですが、公開ゲームにする場合は認証の追加を検討してください。
> 使い終わったルームはDBに残りますが、無料枠には十分収まります。
> 気になったら Firebase Console から `rooms` を削除してください。

## 開発

ES Modules を使っているので、ローカルではHTTPサーバー経由で開きます。

```sh
cd bear-reversi
python3 -m http.server 8787
# http://localhost:8787 を開く
```

### テスト

ルールエンジン(game.js)のテストがあります。

- ブラウザで `http://localhost:8787/tests/` を開く(タイトルが PASS になれば成功)
- Node がある環境なら `node tests/game.test.js` でも実行可能

### 動作確認のコツ

- オンライン対戦は、ブラウザの通常ウィンドウ+シークレットウィンドウで2人分を再現できる
- Firebase 未設定でも「ひとつの端末でふたりで」で全ゲームフローを確認できる

## GitHub Pages への公開

この games リポジトリ自体が GitHub Pages で公開されているので、
**main に push するだけ**で反映されます。

公開URL: `https://imazinger.github.io/games/bear-reversi/`

## 今後の拡張アイデア

- CPUの強さ選択(いまは1段階。ai.js の探索深さを変えるだけで調整できる)
- BGM
- 通算成績の永続化(いまはルーム単位。localStorage やDBに累計を持たせる)
