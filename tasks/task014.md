# M14: セキュリティ/コンプライアンス強化

## Goal
- 責任あるプロービングとログ管理/依存監査/利用規約整備で安心して運用できる状態にする。

## Scope（FR/NFR）
- FR: `SECURITY.md`/`CODE_OF_CONDUCT.md`/`PRIVACY` 表明（匿名統計は現状なし/opt-in）
- NFR: 依存脆弱性ゼロ（許容範囲）、UA/レート制御の既定明記、DoH 既定先の規約確認

## Deliverables
- ドキュメント各種、`npm audit`/SCA レポート、プロービングポリシー
- ドメイン allow/deny/skip のポリシー機構（設定/CLI）

## Tasks
- [ ] 依存監査（CIでの監査ジョブ）
- [ ] DoH 既定先の表明/切替オプション（`--doh-endpoint`）の推奨ガイド
- [ ] ポリシー: private/special/特定TLDの既定スキップと解除方法の整理
- [ ] ログ保持/匿名化の方針（現状は匿名化・外送なし）を明記

## Definition of Done
- 監査/方針がREADME/Docsに明記され、CI監査を通過

## User-side Tasks（あなたの担当）
- セキュリティ連絡先: `security@<your-domain>` などの受信体制、SECURITY.mdの窓口運用
- VDP（脆弱性報告方針）: 受け入れ手順/謝辞ポリシーの策定
- 組織SSO/権限: GitHub/ npm/ GHCR のSSO承認・権限レビュー
