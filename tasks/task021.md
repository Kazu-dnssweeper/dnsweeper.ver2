# M21: QA / サポート体制 / 準拠

## Goal
- GA公開に必要な品質保証・サポート運用・法務準拠を整える。

## Scope（FR/NFR）
- FR: SLO/SLAの定義（CLI適用範囲での現実的な指標）、サポート窓口/手順、インシデント運用
- NFR: 長時間テスト/Soak/Chaos/回帰テストの自動化、EULA/ToS/Privacyの整備

## Deliverables
- `SUPPORT.md`/`SLx.md`/`RUNBOOKS/`（テンプレ）
- 長時間テストジョブ（nightly）/Fuzz/Edgeケース

## Tasks
- [ ] Soak（100k×連続N回）/Chaos（ネットワーク劣化）をCIに追加
- [ ] Fuzz（CSV/JSON入力）とルール境界値テスト
- [ ] サポート運用手順（受付→再現→暫定対応→恒久対応）を整備
- [ ] 法務文書のひな形（EULA/ToS/Privacy）

## Definition of Done
- SLO/SLA/サポート運用が文書化・合意され、Nightlyでの長時間テストが安定
