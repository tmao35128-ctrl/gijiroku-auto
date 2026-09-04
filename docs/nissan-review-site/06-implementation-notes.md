# 実装メモ（Cursor で自分で書く用）

対象：`05-design-handoff.md` のデザインを、**完成度 75% を目標に最速で**動く形にする。

---

## 1. 「75%」の定義

全部を等しく 75% にするのではなく、**作るものと捨てるものを先に決める**。

### 作る（Phase 1 のコア）

| # | 画面 | 完成度目標 | 理由 |
|---|---|---|---|
| 1 | ホーム（レビュー一覧・並び替え・いいね） | **95%** | 顔。ここだけは妥協しない |
| 2 | レビュー投稿（バリデーション・完了遷移） | **95%** | 制度の目的そのもの |
| 3 | 車種一覧 / 車種詳細 | 80% | 写真がなくても成立する形に |
| 4 | 予約カレンダー | 70% | 一番重い。**動くことを優先、装飾は後** |
| 5 | マイページ | 70% | 未投稿アラート＋履歴だけあればよい |
| 6 | 販売店一覧 | 90% | 静的データ＋外部リンクだけなので安い |

### 捨てる（今回は作らない）

- 管理ダッシュボード（1-8）→ 当面は DB を直接見る／CSV を手で出す
- Phase 2・3・4 の全画面
- 認証（社内公開なら URL＋合言葉で十分。SSO は後）
- 画像アップロード機能（車両写真は静的ファイルで置く）
- スケルトン・アニメーション類（最後に余裕があれば）

**判断基準**：「これが無いとレビューが1件も集まらないか？」で切る。

---

## 2. 推奨スタック（最短ルート）

```
Next.js 15 (App Router) + TypeScript
Supabase (Postgres + supabase-js)
Vercel
CSS: cr-design-system.css を globals.css に丸ごと入れて、そのまま使う
```

**Tailwind に変換しないこと。** `design/cr-design-system.css` は
トークンとコンポーネントクラスが揃っているので、`import './cr-design-system.css'` して
`className="cr-btn cr-btn--primary cr-btn--lg cr-btn--block"` と書くのが一番速い。
足りないレイアウトだけ CSS Modules か素の `<style jsx>` で足す。

**理由**：デザインシステムの移植は「見た目が合っているか」の確認に時間を食う。
すでに hifi で確定した CSS があるなら、それを正とするのが最速。

---

## 3. 実装順（この順番で積む）

1. `create-next-app` → `globals.css` に `cr-design-system.css` を入れる → フォント読み込み
   （`Noto Sans JP` 400/500/700 と `Zen Kaku Gothic New` 700/900）
2. Supabase プロジェクト作成 → `cars` / `reviews` / `review_likes` / `dealers` /
   `availability` / `reservations` のテーブル作成
3. **シードデータを先に入れる**（車 7 台・レビュー 15 件・販売店 8 件）
   → 空の画面を相手に CSS を書くのは遅い
4. ホームのレビュー一覧（読み取りのみ）
5. 並び替え（`sortKey` を URL クエリに持たせると実装も共有も楽）
6. レビュー投稿 → バリデーション → 完了後ホームへ `router.push('/?posted=1')`
7. いいね（楽観的更新。`visitor_token` は `localStorage` の UUID で十分）
8. 車種一覧・車種詳細・販売店一覧（ほぼ静的）
9. マイページ
10. 予約カレンダー ← **最後**。ここで詰まっても 1〜9 が動いていれば公開できる

**9 まで終わった時点で一度デプロイして社内に見せる。** 予約はその後で足せる。

---

## 4. 資料どうしの食い違い（先に決着させること）

`05-design-handoff.md`（プロトタイプの実測値）と `design/cr-design-system.css`（設計されたトークン）で
値がズレている箇所がある。**CSS 側を正とする**のを推奨（トークン化されていて状態も揃っているため）。
ただし ★ の付いた 2 つは見た目が明確に変わるので、自分で決めること。

| 項目 | handoff (README) | cr-design-system.css | 推奨 |
|---|---|---|---|
| ★ 円形ナビ | 直径 **62px**・`2px solid #C3002F`（赤枠） | `.cr-navcircle__icon` **72px**・`1.5px solid #E4E6E9`（グレー枠、accent は別 modifier） | **要決定**。赤枠3つは目を引くが赤が増える。1つだけ accent にするのが CSS 側の意図 |
| ★ success | `#1B7A3E` / 地 `#F2F9F4` / 枠 `#C6E3CF` | `#0E7A4F` / 地 `#E9F5EF` | **要決定**（予約の「空いています」バーの色） |
| accent tint | `#FDECEF` | `#FDEDF0` | CSS |
| accent border | `#F0B9C4` | `--cr-accent-tint-2: #FBDCE2` | CSS（`#F0B9C4` は枠、tint-2 は地。用途が別なので両方要る） |
| border（入力欄） | `#DEE0E4` | `#D8DADE` | CSS |
| アバター径 | 38px | 40px | CSS |
| 入力欄の高さ | 52px | 50px | CSS |
| textarea min-height | 150px | 168px | CSS |
| ★ 空の高さ | ボタン 56px（投稿） | `.cr-btn` 48px / `--lg` 56px | `cr-btn--lg` を使う |
| カード shadow | `0 1px 4px rgba(26,28,31,.07)` | `0 1px 3px rgba(26,28,31,.10)` | CSS |
| ★ empty | `#DEE0E4` | `#D8DADE` | CSS |

決めたら **`cr-design-system.css` を書き換えて、そこだけを正にする**。
2 つの資料を見比べながら実装すると必ず事故る。

---

## 5. 実装の落とし穴（先に知っておくと速い）

### `.cr-stars` は `--i` を各星に渡さないと動かない
```html
<span class="cr-stars" style={{'--cr-rating': 4.5}}>
  <span class="cr-stars__star" style={{'--i': 0}}>…</span>
  <span class="cr-stars__star" style={{'--i': 1}}>…</span>
  …
</span>
```
`--i` が無いと全星が満点表示になる。ループの index をそのまま渡すこと。

### 予約カレンダーは「在庫」で持つ、「予約」で持たない
セルの状態は `availability { carId, date, total, booked }` から
`free | partial | full` を**派生**させる。予約テーブルを毎回集計すると遅いし複雑になる。

- 空き＝`booked === 0` → **何も表示しない**（白のまま。マークも付けない）
- 一部＝`0 < booked < total` → 「残 n」
- 満車＝`booked >= total` → 「満車」

### 期間選択のバリデーション
開始日タップ → 終了日タップで範囲確定。
範囲内に `full` が 1 日でもあれば警告状態にして送信ボタンを `disabled`。
**代替候補は「同一車種の近い空き期間」と「他車種の同一期間」の 2 件**を出す（handoff 1-6）。
連続貸出は最大 5 日。

### 月初の空白セル
`2026/10` は 1 日が木曜なので先頭に空セル 4 つ。`getDay()` で計算すること。

### 「全部必須です」は `alert()` ではない
`cr-modal` か `cr-toast--error` を使う。**同時に該当フィールドに
`aria-invalid="true"`** を付ける（CSS に赤枠のスタイルが入っている）。

### いいねの重複防止
ログインが無いので `localStorage` に UUID（`visitor_token`）を1回だけ発行して使う。
`review_likes` に `UNIQUE(review_id, visitor_token)` を張れば十分。

### 写真は未提供
`image-slot` はプロトタイプ用なので**本番では使わない**。
`next/image` か素の `<img>` に置き換え、当面は
`cr-card__media` のグレー地（`#EDEEF0`）＋車種名テキストのままでも成立する。
写真が無いことを理由に着手を遅らせないこと。

---

## 6. 先に確認が要ること

- [ ] **7 台の内訳**（エクストレイル何台／オーラ何台）。handoff の予約画面は
      「4台」「2台」のチップで 7 台にならない。カレンダーの `total` に直結するので確定必須
- [ ] 静岡県の販売店データ（店名・住所・電話・営業時間・定休日・公式 URL）
- [ ] 社内公開の方法（URL のみ／合言葉／SSO）
- [ ] 返却翌日のリマインドを Power Automate から出せるか（現行フローの確認）
- [ ] 車両写真の入手先と、日産の商標・画像の利用可否

---

## 7. Cursor に置くルール（`.cursorrules` にそのまま貼る）

```
このプロジェクトは「logoCR」— ジヤトコの社用車貸出レビューアプリ（Phase 1）。

## 必ず参照するもの
- docs/nissan-review-site/05-design-handoff.md … 画面仕様の正
- docs/nissan-review-site/design/cr-design-system.css … 色・タイポ・コンポーネントの正
数値や色を自分で決めないこと。上の2つに書かれた値を使う。
書かれていない場合だけ、既存トークン（--cr-*）から選ぶ。新しい色は足さない。

## スタイル方針
- cr-design-system.css のクラス（cr-btn, cr-card, cr-chip, cr-review など）を使う
- Tailwind に置き換えない
- 足りないレイアウトだけ CSS Modules で追加する

## デザインの約束
- 赤（#C3002F）は面で使わない。ボーダー・★・主要ボタン1箇所まで
- タップ領域は 44x44px 以上
- 本文コントラストは 4.5:1 以上。グレー地の上は #4E535A 以上の濃さ
- 色だけで意味を持たせない（満車は色＋「満車」ラベル）
- 日本語主体。本文の line-height は 1.95

## スコープ
Phase 1 のみ実装する。Phase 2〜4 の機能は作らない。
管理ダッシュボード・認証・画像アップロードは今回のスコープ外。

## 実装の決まりごと
- 予約カレンダーのセル状態は availability(total, booked) から派生させる
- 空き日は白のまま。マークを付けない
- 「全部必須です」はブラウザの alert() ではなくアプリ内モーダル／トーストで出す
- .cr-stars を使うときは各星に --i（0〜4）を渡す
```
