# M15: UX/ドキュメント拡充（導入〜運用ガイド）

## Goal
- 初見ユーザーが10分で導入〜最初の解析ができ、運用者が困らないドキュメントを提供する。

## Scope（FR/NFR）
- FR: チュートリアル/クックブック/FAQ/トラブルシュート、例示CSV/設定、スニペット
- NFR: Docs の検索性/一貫性、更新容易性（テンプレ/目次）

## Deliverables
- `docs/` にチュートリアル（Quickstart/Analyze/Import/Rules/Export/Sweep）
- FAQ（ネットワーク/タイムアウト/証明書/権限/プロキシ）
- トラブルシュート（HTTPエラー分類/対処、DNSステータス別の解釈）

## Tasks
- [ ] Quickstart を README から切り出し/連携
- [ ] 代表ユースケース別のクックブック（例: 監査、掃除、エビデンス作成）
- [ ] 典型エラーに対する対処フローチャート

## Definition of Done
- 新規ユーザーが手順どおりに 1 回目の結果を得られる（レビューチェック）

## User-side Tasks（あなたの担当）
- 記事/宣伝: Zenn/Qiita/Note/ブログでQuickstart紹介、X/Blueskyにスレッド投稿
- ランディング: GitHub Pagesや簡易LPの用意（概要/導入/ロードマップ/リンク）
- ブランド: ロゴ/アイコンの準備（任意）
