# DNSweeper

![CI Unit](https://github.com/Kazu-dnssweeper/dnsweeper.ver2/actions/workflows/ci-unit.yml/badge.svg)
![CI Net](https://github.com/Kazu-dnssweeper/dnsweeper.ver2/actions/workflows/ci-net.yml/badge.svg)
![CI Large](https://github.com/Kazu-dnssweeper/dnsweeper.ver2/actions/workflows/ci-large.yml/badge.svg)

DNSweeper は、DNSレコードの健全性と HTTP/TLS の到達性を解析し、リスク判定から掃除計画（sweep plan）までを支援するCLIツールです。

関連ドキュメント: 仕様 docs/SPEC.md / リスク docs/RISK_ENGINE.md / 運用 docs/OPERATIONS.md / 進捗 instructions/PROGRESS.md / ロードマップ ROADMAP.md

---

## 調査（What & Why）
- 課題: 使われていない/誤設定のDNSレコードや到達不能なエンドポイントを継続的に検出したい。
- 目的: DoH+HTTP/TLS の実測に基づく健全性チェックと、ルールベースのリスク判定で優先順位付け、掃除計画を素早く作る。

## 分析（対象 & 機能）
- 対象: ゾーンのドメイン/レコード一覧（CSV/JSON）。
- 主要機能:
  - DoH解決 + HTTP/TLSプローブ（失敗分類、最小TLS情報）
  - リスクエンジン（R-001〜）＋ Evidence 出力、ルールの重み/無効化
  - list（表示/フィルタ/列追加）、export（JSON/CSV/XLSX）
  - sweep plan 生成（review/delete）
  - スナップショット/再開、QPS/並列制御、進捗とサマリ

## 計画（導入 & 準備）
- 要件: Node.js 20系（`.nvmrc` あり）
- インストール:
  ```sh
  npm install
  # （任意）グローバルCLI
  pnpm -C packages/dnsweeper link --global
  dnsweeper --help
  ```
- 今後の計画やマイルストーン: ROADMAP.md（Milestones/Tracking Issues にリンク）

## 実行（Quickstart & ワークフロー）

最短の一連の流れ（CSV → 解析 → サマリ/表示 → エクスポート → 計画）。

1) 解析（DoH+HTTP / Evidence/サマリ任意）
```sh
npm start -- analyze packages/dnsweeper/sample.csv --http-check --doh --summary \
  --output analyzed.json --pretty
```

2) 表示（中リスク以上 / 列追加やフォーマット変更）
```sh
npm start -- list analyzed.json --min-risk medium --sort risk --format table
npm start -- list analyzed.json --format json -o list.json
npm start -- list analyzed.json --format csv  -o list.csv
```

3) エクスポート（JSON/CSV/XLSX）
```sh
npm start -- export analyzed.json --format csv  --output out.csv
npm start -- export analyzed.json --format xlsx --output out.xlsx
```

4) 計画（sweep plan 生成）
```sh
dnsweeper sweep plan analyzed.json --min-risk medium --output sweep-plan.json --format json
```

5) スナップショット/再開（長時間解析向け）
```sh
npm start -- analyze packages/dnsweeper/sample.csv --http-check --doh \
  --snapshot .tmp/snap.json --output out.json
npm start -- analyze packages/dnsweeper/sample.csv --http-check --doh \
  --resume --snapshot .tmp/snap.json --output out.json
```

6) ルールの重み/無効化（dnsweeper.config.json を更新）
```sh
npm start -- ruleset weights --set R-003=10 R-005=20
npm start -- ruleset weights --off R-007 R-010
npm start -- ruleset weights --on  R-007
```

補助: Import（プロバイダ判定/正規化/エラー分離）
```sh
npm start -- import packages/dnsweeper/tests/fixtures/cloudflare-small.csv --pretty --output cf.json
npm start -- import packages/dnsweeper/tests/fixtures/route53-small.csv   --pretty --output r53.json
npm start -- import packages/dnsweeper/tests/fixtures/generic-small.csv   --pretty --output gen.json
```

## テスト（確認 & ベンチ）
- 使い方の確認: `dnsweeper --help`、`npm start -- analyze ... --summary` の出力でサマリ/失敗種別/進捗が出ること。
- ベンチ: docs/BENCHMARKS.md（計測手順/プリセット/最新中央値）
- CI: Unit/Net/Large/OS/Bench/Release を分割（.github/workflows/*）

## 評価（結果の読み方 & 次アクション）
- リスクレベル: `low/medium/high`（Evidenceを含めれば根拠も確認可能）
- list/export で要約と絞り込み → sweep plan で review/delete 候補へ
- ルール調整: `ruleset weights` と設定 `dnsweeper.config.json` で重み/閾値/無効化を更新
- フィードバック: Issue/Discussion で入力/出力/既定値/ルール優先度の意見を歓迎

---

## よくある設定（dnsweeper.config.json）
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
    "rules": { "disabled": [], "weights": {"R-003": 10} },
    "thresholds": { "lowTtlSec": 300 }
  }
}
```

## フィードバック / コントリビュート / ライセンス
- フィードバックは Issue/Discussion へ。PR歓迎（大きな変更はまず相談を）
- ライセンス: Apache-2.0

