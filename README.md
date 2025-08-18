# DNSweeper

![CI Unit](https://github.com/Kazu-dnssweeper/dnsweeper.ver2/actions/workflows/ci-unit.yml/badge.svg)
![CI Net](https://github.com/Kazu-dnssweeper/dnsweeper.ver2/actions/workflows/ci-net.yml/badge.svg)
![CI Large](https://github.com/Kazu-dnssweeper/dnsweeper.ver2/actions/workflows/ci-large.yml/badge.svg)

最小セットアップと実行手順のメモ。

## 必要要件
- Node.js 20系（`.nvmrc` あり）
- npm 9以降推奨

## セットアップ
```sh
npm install
```

## 実行（ローカル）
```sh
# ヘルプ
npm start -- --help

# サンプルCSVで解析（同梱の sample.csv を使用）
npm start -- analyze packages/dnsweeper/sample.csv --http-check

# HTTPチェックとサマリ
npm start -- analyze packages/dnsweeper/sample.csv --http-check --summary

# 結果を JSON に書き出し（リスク付き）
npm start -- analyze packages/dnsweeper/sample.csv --http-check --summary --output analyzed.json --pretty

# 進捗表示を抑制
npm start -- analyze packages/dnsweeper/sample.csv --http-check --summary --quiet

# DoH も併用（DNS解決 + HTTPチェック）
npm start -- analyze packages/dnsweeper/sample.csv --http-check --doh --dns-type A --summary
# 追加オプション: --doh-endpoint <url> / --dns-timeout <ms> / --dns-retries <n>
# 終了時に stderr へ DNSキャッシュ統計を表示（ヒット率/推定節約時間）

# Evidence を出力（Risk Engine の score/evidences を含める）
npm start -- analyze packages/dnsweeper/sample.csv --http-check --doh \
  --include-evidence --output analyzed.with-evidence.json --pretty

# SRV 回答から候補URLを注釈し、必要時に追加プローブ（--probe-srv）
# 例: _sip._tcp.example.com などの SRV → candidates: [https://target:443/, http://target:5060/]
npm start -- analyze packages/dnsweeper/sample.csv --http-check --doh --probe-srv --output out.json --pretty
# 補足: https の TLS 最小情報（ALPN/Issuer/SNI）は https.tls に反映されます
# 補足: サマリに HTTP エラー種別の集計が表示されます（timeout/tls/http4xx/http5xx 等）

# ルールセット適用（リスク調整）
# .tmp/rulesets/<name>.json を用意して適用（簡易スキーマは src/core/rules/engine.ts を参照）
npm start -- analyze packages/dnsweeper/sample.csv --http-check --doh --ruleset default --ruleset-dir .tmp/rulesets --summary

# 安全ガード/負荷制御
# - プライベートIP/特殊ドメインは既定でHTTPプローブをスキップ（--allow-private で解除）
# - QPS上限を設定して全体負荷を抑制
npm start -- analyze packages/dnsweeper/sample.csv --http-check --doh --qps 5 --allow-private
```

注記: `prestart`/`postinstall` により自動ビルドされます（`dist` 生成）。

## グローバルCLIとして利用
```sh
npm link       # 管理者権限が必要な環境あり

# もしくは pnpm でグローバルリンク
pnpm -C packages/dnsweeper link --global

# ヘルプ
dnsweeper --help

# 解析（サンプル）
dnsweeper analyze packages/dnsweeper/sample.csv --http-check

# サマリ付き
dnsweeper analyze packages/dnsweeper/sample.csv --http-check --summary
```

アンリンク（元に戻す）:
```sh
npm unlink -g dnsweeper
# pnpm の場合
pnpm -C packages/dnsweeper unlink --global
```

## 開発（TSダイレクト実行）
```sh
npm run dev    # ts-node/esm で起動
```

## エクスポート（JSON/CSV/XLSX）
```sh
# JSON を CSV に変換
npm start -- export out.json --format csv --output out.csv

# JSON を XLSX に変換
npm start -- export out.json --format xlsx --output out.xlsx

# JSON を pretty で再出力
npm start -- export out.json --format json --pretty --output out.pretty.json

# パフォーマンス表示（--verbose）
npm start -- export out.json --format csv --output out.csv --verbose
# stderr に [perf] count/elapsed_ms/out_bytes/rss_mb/rps を表示
```

補足: 入力の JSON に `risk` フィールドが含まれる場合、XLSX は `Summary`/`High`/`All` の3シートを出力します（`Summary` はリスク分布）。

## 注釈（annotate）
```sh
# ドメインに含まれる文字列でマッチして note/labels を付与
npm start -- annotate out.json --contains openai --note "check ssl" --label important urgent --pretty --output out.annotated.json

# 正規表現でマッチ
npm start -- annotate out.json --regex "^.*example\\.com$" --label watch --output out.annot2.json

# マークを付与（key:value 形式をマージ）
npm start -- annotate out.json --contains example --mark keep:prod owner:web --output out.marked.json --pretty
```

## 進捗記録
- 最新の進捗は [instructions/PROGRESS.md](instructions/PROGRESS.md) を参照

## ベンチマーク（概況）
- 実行手順・詳細は [docs/BENCHMARKS.md](docs/BENCHMARKS.md)
- 直近の中央値（GitHub Actions, DoH+HTTP, timeout=800ms）:
  - 100行: ~16.5s（rps ≈ 6.1）
  - 10,000行: ~464.5s / 7.7min（rps ≈ 21.5）
  - 100,000行: 実行中（完了後に追記）

## 運用ガイド
- Push/CIの手順・Deploy Key・PAT の扱いは [docs/OPERATIONS.md](docs/OPERATIONS.md) を参照
- CIの最新状態を確認: `GITHUB_TOKEN=xxxx pnpm run ci:status`
- CIログの取得: `GITHUB_TOKEN=xxxx pnpm run ci:logs`
 - DNSのゴミ検出/削除計画（sweeping）の方針は [docs/SWEEPING.md](docs/SWEEPING.md)

## 作業合意と運用（ハイブリッド）
- ガイドライン: [docs/WORKING_AGREEMENT.md](docs/WORKING_AGREEMENT.md)
- 既定は軽量ループ（計画→実装→テスト→レビュー）。跨る変更や外部統合時は 6 ステップ（調査→分析→計画→実行→テスト→評価）。
- テスト分離（高速/決定的 vs. ネット/統合）:
  - ユニット: `pnpm run test:unit`
  - ネット/統合(E2E/DoH等): `pnpm run test:net`
- CI 分割:
  - Unit: Push/PR で自動実行（.github/workflows/ci-unit.yml）
  - Network/Integration: 手動/スケジュール実行（.github/workflows/ci-net.yml）
  - Large Formats: 週次/手動で大規模フォーマットのE2E検証（.github/workflows/ci-large.yml）

## モノレポ構成（pnpm workspace）
このリポジトリはモノレポです。コア実装は `packages/dnsweeper/` 配下にあります。

- コマンド実行（ルート）: `npm start` は `packages/dnsweeper/dist/cli/index.js` を起動
- ビルド/テスト/リント（パッケージ単位）:
  - `pnpm -C packages/dnsweeper run build`
  - `pnpm -C packages/dnsweeper run test`
  - `pnpm -C packages/dnsweeper run lint`
- ルールセット適用例:
  - `cp examples/rulesets/default.json .tmp/rulesets/default.json`
  - `npm start -- analyze packages/dnsweeper/sample.csv --http-check --doh --ruleset default --summary`

## list（表示拡張）
```sh
# リスクしきい値・ソート・色付き表示（ANSI）
npm start -- list analyzed.json --min-risk medium --sort risk

# JSON/CSVでの出力（--output 省略時は標準出力）
npm start -- list analyzed.json --format json -o list.json
npm start -- list analyzed.json --format csv  -o list.csv

# 追加列の表示（TLS/Evidence/SRV候補）と分布サマリ（--verbose）
npm start -- list analyzed.json --min-risk medium --show-tls --show-evidence --show-candidates --format table --verbose
# stderr に [dist] low/medium/high の分布を表示
```

## Import（プロバイダ自動判定とエラー分離）

```sh
# 自動判定で正規化（Cloudflare/Route53/Generic を判定）
npm start -- import packages/dnsweeper/tests/fixtures/cloudflare-small.csv --pretty --output cf.json
npm start -- import packages/dnsweeper/tests/fixtures/route53-small.csv --pretty --output r53.json
npm start -- import packages/dnsweeper/tests/fixtures/generic-small.csv --pretty --output gen.json

# 明示的にプロバイダを指定
npm start -- import packages/dnsweeper/tests/fixtures/cloudflare-small.csv --provider cloudflare --output out.json

# 失敗行は errors.csv に書き出し
npm start -- import packages/dnsweeper/tests/fixtures/generic-small.csv --provider cloudflare --errors errors.csv --output out.json
# 設定ファイル（dnsweeper.config.json）で TTL の既定値を適用
echo '{"defaultTtl": 1800}' > dnsweeper.config.json
# TTL 欄が空でも defaultTtl が補完される
npm start -- import packages/dnsweeper/tests/fixtures/generic-small.csv --pretty
```
# analyze の再開（スナップショット）
```sh
# 初回（スナップショットを定期保存）
npm start -- analyze packages/dnsweeper/sample.csv --http-check --doh --snapshot .tmp/snap.json --output out.json

# 再開（入力ハッシュ一致時に未処理分のみ続行）
npm start -- analyze packages/dnsweeper/sample.csv --http-check --doh --resume --snapshot .tmp/snap.json --output out.json
```

# ルールの重み/無効化（dnsweeper.config.json を更新）
```sh
# 重みを設定（±100、存在するルールIDを指定）
npm start -- ruleset weights --set R-003=10 R-005=20

# ルールを無効化/有効化
npm start -- ruleset weights --off R-007 R-010
npm start -- ruleset weights --on R-007
```
