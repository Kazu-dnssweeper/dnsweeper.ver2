# Roadmap

本ロードマップは DNSweeper を「商品レベル（GA）」へ到達させるための主要マイルストーンを示します。各マイルストーンは tasks/*.md に詳細（Goal/Scope/Deliverables/Tasks/DoD）があります。

## フェーズ概要
- M1–M7: MVP実装と最適化（進行中）
- M8–M15: 配布体制・クロスOS・運用/精度/安全性の強化（GA準備）
- M16–M21: プロダクト化（観測性/拡張性/UI/エンタープライズ/配布/QA）

## マイルストーン一覧（抜粋）
- M8 パッケージング/リリース運用（[tasks/task008.md](tasks/task008.md)）
- M9 クロスプラットフォーム対応（[tasks/task009.md](tasks/task009.md)）
- M10 ジョブ管理 & 進捗サービス（[tasks/task010.md](tasks/task010.md)）
- M11 キャッシュ永続化 & レジリエンス（[tasks/task011.md](tasks/task011.md)）
- M12 プロバイダ統合によるスイープ適用（[tasks/task012.md](tasks/task012.md)）
- M13 ルール拡張 & 誤検知抑制（[tasks/task013.md](tasks/task013.md)）
- M14 セキュリティ/コンプライアンス（[tasks/task014.md](tasks/task014.md)）
- M15 UX/ドキュメント拡充（[tasks/task015.md](tasks/task015.md)）
- M16 テレメトリ/観測性（[tasks/task016.md](tasks/task016.md)）
- M17 拡張性/SDK（[tasks/task017.md](tasks/task017.md)）
- M18 Web UI/レポーティング（[tasks/task018.md](tasks/task018.md)）
- M19 エンタープライズ対応（RBAC/SSO/Audit）（[tasks/task019.md](tasks/task019.md)）
- M20 配布チャネル（Docker/Homebrew/Chocolatey）（[tasks/task020.md](tasks/task020.md)）
- M21 QA/サポート体制/準拠（[tasks/task021.md](tasks/task021.md)）
  
  リリース系（v0.1.0〜）
  
- v0.1.0 Preview（[tasks/task022.md](tasks/task022.md)）
- v0.2.0 Feedback（[tasks/task023.md](tasks/task023.md)）
- v0.3.0 Packaging（[tasks/task024.md](tasks/task024.md)）
- v0.4.0 Sweep Plan（[tasks/task025.md](tasks/task025.md)）
- v0.5.0 Performance Mid（[tasks/task026.md](tasks/task026.md)）
- v0.6.0 Provider Apply β（[tasks/task027.md](tasks/task027.md)）
- v0.7.0 Cache Persist（[tasks/task028.md](tasks/task028.md)）
- v0.8.0 Telemetry（[tasks/task029.md](tasks/task029.md)）
- v0.9.0 HTML Report α（[tasks/task030.md](tasks/task030.md)）
- v1.0.0 GA（[tasks/task031.md](tasks/task031.md)）
- v1.1.0 通知/連携（[tasks/task032.md](tasks/task032.md)）
- v1.2.0 ジョブ強化（[tasks/task033.md](tasks/task033.md)）
- v1.3.0 Apply GA（[tasks/task034.md](tasks/task034.md)）
- v1.4.0 拡張性/SDK（[tasks/task035.md](tasks/task035.md)）
- v1.5.0 UI/レポーティングβ（[tasks/task036.md](tasks/task036.md)）
- v1.6.0 SaaS α（[tasks/task037.md](tasks/task037.md)）
- v1.7.0 SaaS β（[tasks/task038.md](tasks/task038.md)）
- v1.8.0 SaaS 収益化（[tasks/task039.md](tasks/task039.md)）
- v2.0.0 SaaS GA + AI α（[tasks/task040.md](tasks/task040.md)）
- v2.1.0+ AI拡張/自動化（[tasks/task041.md](tasks/task041.md)）

## 依存関係（例）
- M8→M9: 配布とクロスOSを並行/相互検証
- M10/M11→M18: ジョブ/キャッシュの基盤がUIの前提
- M14→M19/M21: セキュリティ方針はエンタープライズ/サポートの前提

## GAゲート（抜粋）
- 性能: 100kレコードの目標時間達成（条件明記）
- 品質: FP<1%の実測、主要OSでのスモーク安定
- 配布: npm/Docker/Homebrew/Chocolateyのうち少なくともnpm+Dockerを安定提供
- 運用: リリース/ロールバック手順、サポートポリシー/FAQ/トラブルシュート
