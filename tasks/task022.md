# v0.1.0: Preview（超早期プレビュー・フィードバック募集）

## Goal
- 最小CLIをOSS公開（JSON/テーブル/summary、DoH/HTTP、ルールMVP）。

## Scope（FR/NFR）
- FR: `analyze/import/export/list/ruleset/annotate/sweep plan` の最低限。
- NFR: CI最小（Unit/Net/lint）、Apache-2.0、初期SECURITY/CONTRIBUTING。

## Deliverables
- タグ `v0.1.0`、npm `dnsweeper@0.1.0`、Docker `ghcr.io/<org>/dnsweeper:0.1.0`。
- README: Quickstart/Use Case/Options/Roadmap/Feedback。

## Tasks
- [ ] CLIコマンド最小セットの公開品質化（help/exit code/エラー文言）。
- [ ] 出力: JSON/テーブル/summary（XLSX/CSVは最小）。
- [ ] CI: Unit/Net/lint を main/PR に。
- [ ] 配布: Release作成→npm publish→Docker push。
- [ ] ライセンス/SECURITY/CONTRIBUTING 整備。

## Definition of Done
- 上記配布が成功し、Quickstartどおりに初回結果が再現できる。

## Timeline / Owner / Dependencies
- 期日: TBD（GitHub Milestone v0.1.0に準拠）
- 担当: Maintainers（@Kazu-dnssweeper 他）
- 依存: M8/M9の一部（配布/OS互換）
