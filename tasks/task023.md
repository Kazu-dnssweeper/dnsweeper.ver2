# v0.2.0: フィードバック反映

## Goal
- 初回ユーザのFBを反映してUX・既定値を改善。

## Scope
- FR: 既定timeout/retry/QPSプリセット、`--no-downgrade`、ヘルプ/エラー改善。
- NFR: FAQ/トラブルシュート草案。

## Deliverables
- タグ `v0.2.0`、CHANGELOG、FB対応表（Issue/Discussリンク付き）。

## Tasks
- [ ] タイムアウト/再試行/QPSの既定調整（低/高遅延プリセット）。
- [ ] ルール重み微調整・`--no-downgrade` 導入。
- [ ] CLIヘルプ全面見直し、代表エラーの対処ヒント付与。
- [ ] README: FAQ/トラブルシュート追記。

## Definition of Done
- 代表FBが反映され、Quickstart体験が短時間で安定する。

## Timeline / Owner / Dependencies
- 期日: TBD（GitHub Milestone v0.2.0に準拠）
- 担当: Maintainers
- 依存: v0.1.0 公開完了
