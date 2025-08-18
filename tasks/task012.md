# M12: プロバイダ統合（Cloudflare/Route53）によるスイープ適用

## Goal
- `sweep plan` の結果を、Cloudflare/Route53 API に対して安全に適用（dry-run/実行）できる。

## Scope（FR/NFR）
- FR: Provider Adaptor（CF/R53）/ 資格情報の取得方法 / dry-run / バックオフ/リトライ / 失敗の再実行
- NFR: ガードレール（ラベル/オーナー必須、重要レコードの保護、スロットリング）

## Deliverables
- CLI: `dnsweeper sweep apply --provider cf|r53 --plan sweep-plan.json --dry-run` 他
- Provider: ID解決（name+type+content→record id）/ idempotent な削除
- 監査: JSONL でアクション/対象/結果/エラーを記録

## Tasks
- [ ] Adaptor 実装（CF: zones/dns_records, R53: changeResourceRecordSets）
- [ ] プラン→API リクエストのマッピング（バリデーション/二重送信防止）
- [ ] ガードレール（ラベル/owner/保護ルール/レート制御）
- [ ] ドライラン/コミットの2段階実行、リトライ戦略
- [ ] ドキュメントとサンプル（最小権限のIAM/Token）

## Definition of Done
- ダミーゾーンで dry-run→実行→検証 が往復可能、ロールバック手順が明記
