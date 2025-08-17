# DNSweeper

![CI Unit](https://github.com/Kazu-dnssweeper/dnsweeper.ver2/actions/workflows/ci-unit.yml/badge.svg)
![CI Net](https://github.com/Kazu-dnssweeper/dnsweeper.ver2/actions/workflows/ci-net.yml/badge.svg)

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
```

補足: 入力の JSON に `risk` フィールドが含まれる場合、XLSX は `Summary`/`High`/`All` の3シートを出力します（`Summary` はリスク分布）。

## 注釈（annotate）
```sh
# ドメインに含まれる文字列でマッチして note/labels を付与
npm start -- annotate out.json --contains openai --note "check ssl" --label important urgent --pretty --output out.annotated.json

# 正規表現でマッチ
npm start -- annotate out.json --regex "^.*example\\.com$" --label watch --output out.annot2.json
```

## 進捗記録
- 最新の進捗は [instructions/PROGRESS.md](instructions/PROGRESS.md) を参照

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
