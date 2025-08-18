# Roadmap

本ロードマップは DNSweeper を「商品レベル（GA）」へ到達させるための主要マイルストーンを示します。各マイルストーンは tasks/*.md に詳細（Goal/Scope/Deliverables/Tasks/DoD）があります。

## フェーズ概要
- M1–M7: MVP実装と最適化（進行中）
- M8–M15: 配布体制・クロスOS・運用/精度/安全性の強化（GA準備）
- M16–M21: プロダクト化（観測性/拡張性/UI/エンタープライズ/配布/QA）

## マイルストーン一覧（抜粋）
- M8 パッケージング/リリース運用（tasks/task008.md）
- M9 クロスプラットフォーム対応（tasks/task009.md）
- M10 ジョブ管理 & 進捗サービス（tasks/task010.md）
- M11 キャッシュ永続化 & レジリエンス（tasks/task011.md）
- M12 プロバイダ統合によるスイープ適用（tasks/task012.md）
- M13 ルール拡張 & 誤検知抑制（tasks/task013.md）
- M14 セキュリティ/コンプライアンス（tasks/task014.md）
- M15 UX/ドキュメント拡充（tasks/task015.md）
- M16 テレメトリ/観測性（tasks/task016.md）
- M17 拡張性/SDK（tasks/task017.md）
- M18 Web UI/レポーティング（tasks/task018.md）
- M19 エンタープライズ対応（RBAC/SSO/Audit）（tasks/task019.md）
- M20 配布チャネル（Docker/Homebrew/Chocolatey）（tasks/task020.md）
- M21 QA/サポート体制/準拠（tasks/task021.md）

## 依存関係（例）
- M8→M9: 配布とクロスOSを並行/相互検証
- M10/M11→M18: ジョブ/キャッシュの基盤がUIの前提
- M14→M19/M21: セキュリティ方針はエンタープライズ/サポートの前提

## GAゲート（抜粋）
- 性能: 100kレコードの目標時間達成（条件明記）
- 品質: FP<1%の実測、主要OSでのスモーク安定
- 配布: npm/Docker/Homebrew/Chocolateyのうち少なくともnpm+Dockerを安定提供
- 運用: リリース/ロールバック手順、サポートポリシー/FAQ/トラブルシュート

