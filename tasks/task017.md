# M17: 拡張性 / SDK（プラグイン・ルール拡張）

## Goal
- ユーザが独自ルールや出力変換、プローブ拡張を安全に追加できる拡張ポイントとSDKを提供する。

## Scope（FR/NFR）
- FR: ルール拡張API、出力フィルタ/トランスフォーマ、簡易プローブフック
- NFR: 安全サンドボックス（実行制限）、バージョン互換ポリシー、型定義の安定

## Deliverables
- `docs/EXTENSIBILITY.md`（API/サンプル/互換性）
- 公式サンプルプラグイン（1〜2種）

## Tasks
- [ ] ルールAPIの公開（evaluate(ctx)/meta/weights）
- [ ] 拡張のロード/有効化（config/CLI）
- [ ] 互換テスト（semver範囲）と破壊的変更ポリシー

## Definition of Done
- サンプル拡張が `--plugin` で動作し、アップグレード時も互換性が保たれる
