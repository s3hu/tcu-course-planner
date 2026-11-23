# 通常モードの修得単位記録

2025年度入学・社会メディア学科の通常モードで、過去の修得科目をまとめて記録できるようにした。所属選択の「修得科目をまとめて記録する」で取り込みダイアログが開く。通常モード内の「修得科目」と「基本情報・設定」からは、取り込みとカタログ外科目の入力ができる。「修得科目」には自由入力の一覧と削除ボタンがある。

照合と手動選択は全312科目が対象で、計画中の年度・学期・タームによる絞り込みを行わない。Run A が追加した2025年度開講301件の講義名から対応する科目IDへ照合できることをテストした。画像は既存のブラウザ内OCRでテキスト化し、テキスト貼り付けと同じ画面で確認してから反映する。新たに修得済みにした科目のクラスは仮時間割から外れる。

自由入力の単位は区分別の合計、卒業算入参考の総単位、選択済み単位に加える。科目IDを照合する必修、前提科目、選択必修、DS/MS、基礎体育などのチェックには、カタログ科目の記録を使う。自由入力は科目名の正規化・単位数・区分で重複を除き、version 2 の状態、プランJSON、`tcu-sm-2025-v2` のクラウド保存に含める。自由入力欄がない旧version 2 のプランも読み込める。

## 変更ファイル

- `src/components/planner.tsx`、`src/components/experience.tsx`、`src/components/credit-recording.tsx`、`src/components/past-credits-import.tsx` に導線、確認操作、自由入力の一覧を実装した。
- `src/lib/data.ts`、`src/lib/past-credits.ts`、`src/lib/rules.ts`、`src/lib/handbooks.ts` で型、取り込みの確定処理、集計、入力チェックを追加・共用した。
- `src/components/catalog-details.tsx`、`src/components/schedule-builder.tsx`、`src/lib/scheduling.ts` の単位集計に自由入力を反映した。
- `src/components/handbook-planner.tsx` と `src/app/editorial.css` で共通導線と表示を調整した。
- `tests/past-credits.test.ts`、`tests/cloud.test.ts`、`tests/credit-recording-access.test.ts` で照合、確定、集計、互換性、モック保存往復、アクセス表示を検証した。

## 検証範囲

OCRワーカーは既存テストでモック検証した。実画像のブラウザ操作と実Supabaseアカウントでの保存は未実施。2025年度の時間割作成と、学修要覧モードへの新しい要件管理ビューの追加は今回の対象外。
