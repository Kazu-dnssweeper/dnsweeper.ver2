# DNSweeper

[English](README.en.md) | 日本語

![CI Unit](https://github.com/Kazu-dnssweeper/dnsweeper.ver2/actions/workflows/ci-unit.yml/badge.svg)
![CI Net](https://github.com/Kazu-dnssweeper/dnsweeper.ver2/actions/workflows/ci-net.yml/badge.svg)
![CI Large](https://github.com/Kazu-dnssweeper/dnsweeper.ver2/actions/workflows/ci-large.yml/badge.svg)

DNSweeper は、DNSレコードの健全性と HTTP/TLS の到達性を解析し、リスク判定から掃除計画（sweep plan）までを支援するCLIツールです。個人/SREが「ゾーンの状態を見える化→優先度付け→片付け」を素早く回せるように設計しています。

関連ドキュメント: 仕様 docs/SPEC.md / リスク docs/RISK_ENGINE.md / 運用 docs/OPERATIONS.md / 進捗 instructions/PROGRESS.md / ロードマップ ROADMAP.md

---

## 概要 / 機能
- DoH解決 + HTTP/TLSプローブ（失敗分類、最小TLS情報）
- ルールベースのリスク判定（Evidence出力、重み/無効化）
- list（表示/フィルタ/列追加）、export（JSON/CSV/XLSX）
- sweep plan 生成（review/delete）
- スナップショット/再開、QPS/並列制御、進捗とサマリ

## 必要要件 / インストール
- Node.js 20（`.nvmrc` あり）
```sh
npm install
# （任意）グローバルCLI
pnpm -C packages/dnsweeper link --global
dnsweeper --help
```

## クイックスタート（最短3コマンド）
```sh
# 1) 解析（DoH+HTTP, summary付, JSON保存）
npm start -- analyze packages/dnsweeper/sample.csv --http-check --doh --summary --output analyzed.json --pretty
# 2) 表示（中リスク以上をTable）
npm start -- list analyzed.json --min-risk medium --sort risk --format table
# 3) エクスポート（CSV/XLSX）
npm start -- export analyzed.json --format csv  --output out.csv
npm start -- export analyzed.json --format xlsx --output out.xlsx
```

## 入力フォーマット（最低限）
- CSV/JSONを受け付けます。CSVは `domain` を含むシンプルな表でOK（詳細は Import 例や tests/fixtures を参照）。
```sh
# 自動判定で正規化（Cloudflare/Route53/Generic を判定）
npm start -- import packages/dnsweeper/tests/fixtures/cloudflare-small.csv --pretty --output cf.json
```

## よく使うコマンド（チート）
- analyze: DoH+HTTP→リスク→JSON
- list: JSON表示/フィルタ/列追加
- export: JSON→CSV/XLSX
- import: CSV→正規化JSON（プロバイダ自動判定）
- sweep plan: review/delete の計画生成
- ruleset weights: ルール重み/無効化
- annotate: JSONにメモ/ラベル/マーク付与
```sh
dnsweeper sweep plan analyzed.json --min-risk medium --output sweep-plan.json --format json
npm start -- ruleset weights --set R-003=10 R-005=20
```

## 設定の最小例（dnsweeper.config.json）
```json
{
  "analyze": { "qps": 200, "qpsBurst": 20, "concurrency": 40, "timeoutMs": 3000, "progressIntervalMs": 1000, "dohEndpoint": "https://dns.google/resolve" },
  "risk": { "rules": { "disabled": [], "weights": { "R-003": 10 } } }
}
```

## 注意（安全/制限）
- デフォルトでプライベートIP/特殊ドメインへのHTTPプローブはスキップ（`--allow-private`で解除）
- 負荷制御のため `qps`/`qpsBurst`/`concurrency`/`timeout` を設定可能
- ネットワーク状況に依存するため、計測条件（timeout/retry/qps）はdocsに明記

## リンク / サポート / ライセンス
- 詳細: docs/SPEC.md, docs/RISK_ENGINE.md, docs/OPERATIONS.md, ROADMAP.md
- フィードバック: Issues/Discussions歓迎（入力/出力/既定値/ルール優先度など）
- ライセンス: Apache-2.0
