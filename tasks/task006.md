# M6: 設定ファイル & チューニング（Rules/Annotate/中断安全）

## Goal
- `dnsweeper.config.(json|ts)` によるデフォルト制御、ルール重み操作、注釈付与、Ctrl-C 後の安全再開。

## Scope（FR/NFR）
- FR-012, FR-013, FR-014, FR-015／NFR-003

## Deliverables
- `src/core/config/schema.ts`（zod or JSON Schema）
- `src/cli/commands/ruleset.ts`（weights on/off/set）
- `src/cli/commands/annotate.ts`（mark & note を JSON に追記）
- 中断安全の実装（途中結果のスナップショット & 再開差分）

## Tasks
- [ ] 設定読込の層（CLI 引数 > config > 既定）を実装
- [ ] `rules.weights` のバリデーション（0〜±100、ID 存在チェック）
- [ ] `ruleset weights set R-003=10 R-005=20` を反映
- [ ] annotate: `--mark keep:prod --note "理由"` のマージ仕様
- [ ] 実行スナップショット保存（未処理キュー/部分結果/統計）
- [ ] 再開時の差分計算（入力ハッシュ/ルールバージョンが一致時のみ）
- [ ] 競合時の解消規則（最新注釈優先）
- [ ] 単体/統合テスト（中断→再開で二重評価しない）

## Definition of Done
- config によりすべての既定値が上書き可能
- ルールの on/off/weight が CLI から操作できる
- Ctrl-C → 再開時に安全に続きを処理
