# 社用車貸出レビューアプリ「logoCR」 ドキュメント

ジヤトコ株式会社 PoC ／ 日産車（エクストレイル・オーラ 計7台）の社内貸出制度アプリ。

| ファイル | 内容 |
|---|---|
| `01-requirements.md` | 制度の背景と最初の要件整理 |
| `02-claude-design-prompt.md` | Claude Design 用プロンプト（第1回・Phase 1 のみ） |
| `03-phase-roadmap.md` | Phase 1〜4 の定義、ニーズ評価、フィードバック |
| `04-claude-design-prompts-v2.md` | Claude Design 用プロンプト（全フェーズ版＋会議用 MAP） |
| **`05-design-handoff.md`** | **デザイン確定版のハンドオフ。画面仕様の正** |
| **`06-implementation-notes.md`** | **実装メモ。75% 目標のスコープ、実装順、落とし穴、`.cursorrules`** |
| `design/cr-design-system.css` | トークンとコンポーネント CSS。**色・タイポの正** |
| `design/logoCR UI Canvas.dc.html` | Phase 1 の状態バリエーション集（ブラウザで開ける） |
| `design/support.js` / `design/image-slot.js` | 上の HTML を開くのに必要。**本番では不要** |

## 現在地

- 要件・フェーズ構想：**確定**
- UI デザイン：**確定（hifi）**。写真のみ未提供
- 実装：**これから**。Cursor で手を動かす。目標は Phase 1 の完成度 75%

## 進め方

1. `06-implementation-notes.md` の「4. 資料どうしの食い違い」を先に決着させる
2. `.cursorrules` を置く（同ファイル 7 章）
3. 実装順（同ファイル 3 章）に沿って積む。予約カレンダーは最後

## 仕様の優先順位

値が食い違ったときは **`design/cr-design-system.css` > `05-design-handoff.md` > それ以前のドキュメント**。
01〜04 は検討の記録であり、確定仕様ではない。
