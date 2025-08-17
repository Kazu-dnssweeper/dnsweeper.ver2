# DNS Sweeping (Stale Record Detection)

本書は「使われなくなったDNSレコード（ゴミ）」の検出→通知→将来的な自動削除（sweep）までの方針をまとめます。

## 目的
- 使われていない/壊れているレコードを発見し、誤検知を抑えつつ棚卸しを効率化。
- 将来的に、承認付きでプロバイダ（Cloudflare/Route53）から安全に削除可能にする。

## 検出ロジック v1（最小実装）
- 明確な不整合
  - CNAME 終端が `NXDOMAIN`/`TIMEOUT` → stale候補（強）
  - MX/NS の参照先が `NXDOMAIN` → stale候補（強）
- 実体未稼働の疑い（ヒューリスティック）
  - A/AAAA 先で HTTP/TLS が連続失敗（80/443、TLS握手、HEAD） → review候補（中）
  - CNAME 終端の最終FQDNでも同様に失敗 → review候補の確度上げ
- ルール寄せ（組織知見）
  - ドメインパターン（`-old`, `-deprecated`, `test`, `staging` 等）は scoreDelta を上げる
  - deny/allow は ruleset/annotate で制御（`labels:["keep"]` など）

## analyze 出力の拡張
- 以下のフィールドを追加（予定）
  - `action`: `keep|review|delete`
  - `reason`: 判定理由（例: `CNAME NXDOMAIN`, `HTTP/TLS all failed`）
  - `confidence`: 0.0–1.0 の確度（内部スコアから算出）
- list で列出力/CSV/JSON出力に反映（`--format json|csv` は実装済み）

## Sweep Plan
- 目的: レビュー/承認しやすい「計画ファイル」を生成
- コマンド（案）
  - `dnsweeper sweep plan <analyzed.json> --min-confidence 0.7 -o sweep-plan.json`
  - 出力: `[{ domain, type, currentValue(s), action, reason, confidence }]`
- 運用フロー
  1) `analyze` → `list --format csv/json` → 現状把握
  2) `sweep plan` → 計画ファイル作成
  3) レビュー/承認（PRや共有）

## Sweep Apply（将来）
- 目的: プロバイダAPIを使って計画どおりに削除（dry-run優先）
- コマンド（案）
  - `dnsweeper sweep apply --provider cloudflare|route53 --plan sweep-plan.json --dry-run`（初期）
  - `--yes` で実行確定、`--filter` で action/domain 絞り込み
- 前提
  - Provider 認証/権限（最小権限のトークン/IAM）
  - レート制御/失敗時リトライ/ロールバック（ログ/監査）

## 除外・強制保持
- ルールセットで `risk` や `scoreDelta` を調整（`docs/RULESET.md` 参照）
- `annotate` で `labels:["keep"]` を付与 → plan 生成時に `keep` は actionから除外

## 今後の拡張
- 逆参照（ゾーン内リンク整合性）や HTTP 以外の生存チェック（特定ポート/TLS SAN一致）
- 変更追跡（diff）と通知（Slack/Webhook）
- 誤検知防止のためのホワイトリスト/ブラックリストの整理

