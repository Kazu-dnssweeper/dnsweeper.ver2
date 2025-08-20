# DNSweeper SPEC updates (cache/telemetry/jobs)
- Config additions:
  - cache.dohPersist.enabled: boolean (default: off)
  - cache.dohPersist.path: string (default: ~/.cache/dnsweeper/doh-cache.jsonl)
  - telemetry.enabled: boolean (default: off)
  - telemetry.endpoint: string URL (optional; if absent, logs JSONL to ~/.dnsweeper/telemetry.log)
- DoH cache:
  - Persistent JSONL cache honoring TTL; append-only. Used before network call when enabled.
- Jobs:
  - jobs status --snapshot <file>
  - jobs aggregate --dir <dir>
  - jobs cancel [--flag .tmp/job.cancel] to cooperatively cancel analyze runs.

# DNSweeper 製品仕様（GA想定）

バージョン: 1.0 (GA 想定)

## 1. 概要
- 目的: DNSレコード群の健全性評価・HTTP到達性確認・リスク判定・掃除計画の作成/適用を高速かつ安全に行うCLIツール。
- 対象: セキュリティ/インフラ/ドメイン運用チーム、SRE、クラウド運用者。
- 特徴: DoH対応、HTTP/TLSプローブ、ルールベースのリスク評価、スナップショット再開、スイープ計画/適用（CF/R53）、拡張性、オプトイン・テレメトリ。

## 2. スコープ/ユースケース
- 監査: ドメイン群の死活/誤設定検出、リスク抽出、レポーティング。
- 清掃: 不要/失効レコードの抽出（review/delete）→ プロバイダ適用。
- 継続改善: ルール重み/閾値最適化、エラー統計に基づくFP<1%の実現。

## 3. 非機能要件 (NFR)
- 性能: 100k レコードを 15 分以内（concurrency=40、平均ネット正常）。
- 精度: 誤検知 (FP) < 1%（実データ/ベンチで検証）。
- 可搬性: Linux/macOS/Windows で動作（Node 20）。
- 監査: 監査ログ（JSONL）と再現性（入力/ルール/バージョン/環境）を記録。
- 配布: npm/Docker/Homebrew/Chocolatey のうち npm+Dockerは安定提供。
- セキュリティ/コンプライアンス: レート制御、プライベート/特殊ドメインの既定スキップ、利用規約の明記。

## 4. アーキテクチャ
- CLI（commander）: サブコマンド群 `analyze/import/export/list/ruleset/annotate/sweep/jobs/echo`。
- コアモジュール:
  - Import: CSV→正規化JSON（Cloudflare/Route53/Generic 自動判定/明示指定/エラー分離）。
  - Analyze: CSV/JSON入力→(DoH→HTTP/TLS) 直列プローブ→Risk Engine→出力JSON。
  - Resolver (DoH): JSON-over-HTTPS、TTL/再試行、in-memory + 永続キャッシュ（JSONL）。
  - HTTP Prober: undici/HEAD→GETフォールバック、手動リダイレクト、TLS最小情報、失敗分類。
  - Risk Engine: ルールR-001〜R-020 + 重み/無効化。Evidence 出力、しきい値上書き。
  - Sweep: plan（review/delete候補生成）、apply（CF/R53アダプタ、dry-run/実行、ガード）。
  - Export: JSON→CSV/XLSX/JSON（pretty/再出力）。
  - List: JSON表示（閾値/ソート/列拡張）。
  - Jobs: スナップショット保存/再開、進捗集計、status/cancel（協調）。
  - Config: `dnsweeper.config.json` で既定/閾値/プリセット。
  - Audit: JSONLでコマンド/引数/入力ハッシュ/ルールセット/Node等を記録。
  - Telemetry (opt-in): 匿名イベント（cmd種別/サイズ/所要時間/エラー分類/環境粗指標）。
  - Extensibility/SDK: ルール/プローブフック/出力変換の拡張ポイント。
  - Reporting/UI: JSON→HTMLレポート生成 or 軽量ローカルUI（オフライン）。

## 5. CLI 仕様（抜粋）
- `dnsweeper analyze <input>`
  - 主オプション: `--http-check` `--doh` `--concurrency <n>` `--timeout <ms>` `--qps <n>` `--summary` `--probe-srv`
  - DNS: `--doh-endpoint <url>` `--dns-type A,AAAA,...` `--dns-timeout` `--dns-retries`
  - 出力: `-o/--output <file>` `--pretty` `--include-original` `--include-evidence`
  - ルール/設定: `--ruleset <name>` `--ruleset-dir <dir>` `--no-downgrade`
  - 中断/再開: `--snapshot <file>`（既定 .tmp/snapshot.json）`--resume` `--quiet`
  - 退出コード: 0=成功, 非0=致命/入出力エラー。
- `dnsweeper import <file>`: `--provider <cf|r53|gen>` `--encoding` `--errors <csv>` `--output` `--pretty`。
- `dnsweeper export <input>`: `--format json|csv|xlsx` `--output` `--pretty` `--verbose`（perf表示）。
- `dnsweeper list <input>`: `--min-risk` `--sort` `--format table|json|csv` `--show-tls --show-evidence --show-candidates`。
- `dnsweeper ruleset ...`: `list/add/version/validate/weights --set/--off/--on`。
- `dnsweeper annotate <input>`: `--contains/--regex` `--note` `--label` `--mark key:value`。
- `dnsweeper sweep plan <input>`: `--min-risk` `--actions` `--format json|jsonl|csv` `--domain-include/exclude` `--max-items` `--sort`。
- `dnsweeper sweep apply`（GA）: `--provider cf|r53` `--plan <file>` `--dry-run` `--confirm` `--rate-limit`。
- `dnsweeper jobs status --snapshot <file>` / `jobs start <input>` / `jobs cancel`。

## 6. 設定スキーマ（例）
```json
{
  "analyze": {
    "qps": 200,
    "concurrency": 40,
    "timeoutMs": 3000,
    "progressIntervalMs": 1000,
    "qpsBurst": 20,
    "dohEndpoint": "https://dns.google/resolve"
  },
  "risk": {
    "rules": {
      "disabled": ["R-010"],
      "weights": { "R-003": 10, "R-005": 20 }
    },
    "thresholds": { "lowTtlSec": 300 }
  },
  "annotate": { "defaults": {} },
  "cache": {
    "doh": {
      "enabled": true,
      "path": "~/.cache/dnsweeper/doh-cache.jsonl",
      "maxBytes": 104857600,
      "maxTtlSec": 86400
    }
  },
  "telemetry": { "enabled": false }
}
```

## 7. データモデル/スキーマ（要点）
- 正規化レコード（import）: `{ name, type, content, ttl?, proxied?, aliasTarget? }`。
- Analyze結果（必須）:
  ```json
  {
    "domain": "example.com",
    "risk": "low|medium|high",
    "https": { "ok": true, "status": 200, "elapsedMs": 120, "tls?": {"alpn":"h2","issuer":"..","sni":".."} },
    "http": { "ok": false, "errorType": "timeout" },
    "dns": { "status": "NOERROR|NXDOMAIN|SERVFAIL|TIMEOUT", "chain": [{"type":"A","data":"1.2.3.4","ttl":300}], "elapsedMs": 25, "queries":[...] },
    "candidates": ["https://target:443/"],
    "riskScore?": 42,
    "evidences?": [ {"rule":"R-004","score":10,"reason":"TTL<300s"} ],
    "original?": { ... },
    "action?": "keep|review|delete",
    "reason?": "DNS NXDOMAIN",
    "reasonCode?": "DNS_NXDOMAIN",
    "confidence?": 0.9,
    "skipped?": true,
    "skipReason?": "private-ip"
  }
  ```
- スナップショット: `{ meta: { inputHash, execId, ts, ruleset, total, processed }, results: Analyze[] }`。
- スイーププラン: `[{ domain, type?, action: "review|delete", reason, code, confidence, risk }]`。
- 永続キャッシュ: JSONL `{ key: "<qname>|<qtype>", result: ResolveResult, expiresAt }`。
- 監査ログ: JSONL `{ ts, cmd, argv, inputHash, rulesetVersion, node, version, ... }`。
- Telemetry(Opt-in): 匿名 `{ ts, cmd, size, elapsedMs, errors: {timeout: n, tls: n,...}, env: {os, node}, sampled }`。

## 8. ルールエンジン
- ルールID: R-001..R-020（例: NXDOMAIN, TXT/SPF弱設定, CNAME終端なし, 低TTL, HTTP/TLS失敗合算）。
- 評価: コンテキスト `{ name, dns.chain, http.statuses, hints }` に対し score/level/evidence を返す。
- 重み/無効化: `dnsweeper.config.json` / `ruleset weights` で調整。`--no-downgrade` でヒューリスティックより下げない。

## 9. パフォーマンス/レート制御
- `concurrency` + QPS 平滑化/バースト（`qpsBurst`）。
- 失敗率スパイクで一時バックオフ（例: 直近10件の>70%失敗で1秒スリープ）。
- DoH/HTTP のタイムアウト/再試行（指数+ジッタ）。

## 10. セキュリティ/コンプライアンス
- 既定: private/special ドメイン/IPはHTTPプローブをスキップ（`--allow-private`で解除）。
- プロービングポリシー: レート制限/UA明示/対象の同意（運用ガイドに記載）。
- 依存監査: CIでSCA/`npm audit`。DoH既定先の利用規約/切替ガイド。

## 11. スイープ適用（Provider）
- Cloudflare/Route53 アダプタ: name+type(+content)→ID解決、冪等な削除、dry-run/実行。
- ガード: ラベル/オーナー必須、重要レコード保護、レート/並列制御、失敗の再実行。
- 監査: 変更前後の差分/結果/エラーをJSONLで記録。

## 12. 運用/可観測性
- 進捗: `[progress] processed/total qps avg_ms fails eta_s` を1s間隔出力（`--quiet`抑制）。
- サマリ: `summary={low,medium,high}` / `[dns] hit_rate` / `[http] errors=...` をstderr。
- Jobs: `jobs status` でスナップショットから%表示、`jobs cancel` で協調キャンセル。
- 監査ログ: HOME不可時 `.tmp/audit.log` にフォールバック。

## 13. テレメトリ（Opt-in）
- 既定off。`dnsweeper.config.json` か `--telemetry on` で有効に。
- 匿名/最小限/非同期、個人情報やドメイン詳細は送信しない。
- `docs/TELEMETRY.md` に項目と無効化手順を明記。

## 14. 拡張性/SDK
- ルール拡張: `evaluate(ctx)` の外部提供、`--plugin` で読み込み。
- 出力変換/フィルタ: `list/export` 前段のトランスフォーマフック。
- 互換性: semver で破壊的変更は MAJOR に限定、サンプルプラグインを用意。

## 15. 配布/インストール
- npm: `npm i -g dnsweeper` / `pnpm add -g`。`bin/dnsweeper` がエントリ。
- Docker: `ghcr.io/<org>/dnsweeper:1`（最小イメージ、ローカルマウントで入力/出力を扱う）。
- Homebrew/Chocolatey: Tap/パッケージで提供（macOS/Windows）。

## 16. CI/CD
- Unit（push/PR）/ Network（手動/スケジュール）/ Large（週次）/ Cross-OS（3OS）/ Bench（手動）。
- Release: タグ or 手動で npm 公開、Docker/その他配布は将来拡張。

## 17. サポート/ポリシー
- バージョン: SemVer。サポート対象は最新MAJORの最新2マイナーを原則。
- SLO例: 主要コマンドの回帰なし/クロスOSスモークグリーン、100k/15分の条件付き達成。
- ドキュメント: Quickstart/FAQ/トラブルシュート/運用ガイド/RELEASING/SUPPORT。

## 18. 既知の制限
- 高度なHTTP/TLS検証（証明書チェイン詳細/ALPN強制等）は最小限。
- 一部ネットワーク条件下でのRPS/QPSのばらつき。
- Provider APIの権限/制限に依存（最小権限/IAM設計を推奨）。

## 19. 付録
- ベンチマーク手順/最新中央値: `docs/BENCHMARKS.md`
- リリース手順: `RELEASING.md`
- ロードマップ: `ROADMAP.md`

