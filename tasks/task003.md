# M3: ルール評価エンジン MVP（Risk Engine & Evidence）

## Goal
- 正規化済み DNS レコードに対し、初期ルールセット（R-001〜R-010）を適用し、【スコア（0–100）/ level / Evidence】を一貫して算出できる。

## Scope（FR/NFR）
- FR-007, FR-008／NFR-002, NFR-003

## Deliverables
- `packages/dnsweeper/src/core/risk/engine.ts`（純関数・副作用なし）
- `packages/dnsweeper/src/core/risk/rules.ts`（R-001〜R-010 実装）
- `packages/dnsweeper/src/core/risk/weights.ts`（重み定義とバリデーション）
- ユニットテスト一式（カバレッジ 80%+）
- ルール仕様 README（evidence の書式・メタ情報の鍵名）

## Tasks
- [ ] ルール DSL/IF 仕様を決定（純TS実装：関数型でOK、YAMLは将来）
- [ ] `RiskEvidence` スキーマ確定（message/ meta/ ruleId/ severity）
- [ ] `RiskItem` 合成ロジック（score 正規化、level 閾値 30/60）
- [ ] 重み合算の丸め規則（小数→四捨五入、最大100 上限）を実装
- [ ] ルール共通ユーティリティ（名前パターン、TTL 判定、HTTP系・DNS系の存在判定）
- [ ] R-001〜R-010 実装（各 Evidence を最小1件以上返す）
- [ ] 負の重み（R-010）混在時の最終スコア飽和処理
- [ ] ルールごとの単体テスト（成功/失敗/境界値）
- [ ] エンジンの統合テスト（複数ルール競合時のスコア確認）
- [ ] README: ルール追加手順 / 命名規約 / evidence サンプルを記述

## Tests
- [ ] R-001: NXDOMAIN x3 → +40、attempts<3 では0
- [ ] R-003: `old|tmp|backup|bk|stg|dev` を含む name → +15
- [ ] R-010: `proxied=true` → −10（合算で floor=0 / cap=100）
- [ ] 複合ケース: R-001(40)+R-003(15)+R-005(15)=70 → level=high

## Definition of Done
- 代表ケースが仕様通りの score/level/evidence を返す
- すべてのルールが engine を介して有効化/無効化可能
- テスト 80%+、型定義 strict、ESLint/Prettier パス
