# BENCHMARKS

本書は DNSweeper の性能計測手順と記録テンプレートをまとめたものです。M7（調整 & 性能検証）の実施時に利用します。

## 概要
- ベンチスクリプト: `scripts/bench/bench.js`
- 目的: 指定サイズのダミーCSVを生成し、`analyze` を既定/プリセット設定で実行して所要時間・RPSを確認
- 対象機能: DNS/HTTP プロービング（`--doh`/`--http`）の有無を切替可能

## 事前準備
- Node.js 20 系（`.nvmrc` あり）
- 依存関係はリポジトリ同梱（オフラインでビルド可）

## 実行方法
```sh
# 低遅延プリセット + DoH + HTTP, サイズ=10000
node scripts/bench/bench.js \
  --size 10000 \
  --preset examples/presets/low-latency.json \
  --http --doh

# 高遅延プリセット（ネットワークが遅い環境を想定）
node scripts/bench/bench.js --size 10000 --preset examples/presets/high-latency.json --http --doh

# ルール厳格化プリセット（判定しきい値を上げる例）
node scripts/bench/bench.js --size 10000 --preset examples/presets/strict-rules.json --http --doh

# ネットワークを使わずパイプラインだけ計測（生成→解析→出力）
node scripts/bench/bench.js --size 10000

# NXDOMAIN でも HTTP を実行するベンチ（オプション）
node scripts/bench/bench.js --size 100000 --preset examples/presets/low-latency.json --http --doh --http-on-nxdomain
```

実行時の出力ファイル:
- `.tmp/bench/bench-<N>.csv`: 生成CSV
- `.tmp/bench/out-<N>.json`: 解析結果（`--include-original` を含む）

## プリセットの意味
- `examples/presets/low-latency.json`: `qps=200, concurrency=40, timeoutMs=3000, qpsBurst=20`
- `examples/presets/high-latency.json`: `qps=50, concurrency=40, timeoutMs=8000, qpsBurst=10`
- `examples/presets/strict-rules.json`: ルール `weights` 強化 + `qps=100, concurrency=30`

ベンチ実行前にプリセット内容が `dnsweeper.config.json` にコピーされます（上書き）。

## 測定手順（推奨）
1. 計測サイズを選定: 100 → 10,000 → 100,000 の順に拡大
2. 各サイズで同一条件を 3 回実行し中央値を採用
3. 記録する項目:
   - `size`: 行数
   - `elapsed_ms`: 実行時間
   - `rps`: 1秒あたり処理件数（`size / (elapsed_ms/1000)`）
   - `errors`: HTTP/DNS の主要エラー内訳（`--summary` 実行時のstderr集計を併用）
   - `env`: CPU/メモリ/ネットワーク条件（例: 自宅Wi-Fi, 100Mbps）
   - `preset`: 使用したプリセット/個別上書き

## 記録テンプレート
```json
{
  "env": {
    "host": "x86_64, 8c16g",
    "node": "v20.x",
    "network": "wired 1Gbps"
  },
  "preset": "examples/presets/low-latency.json",
  "runs": [
    { "size": 100,   "elapsed_ms": 0,    "rps": 0 },
    { "size": 10000, "elapsed_ms": 0,    "rps": 0 },
    { "size": 100000,"elapsed_ms": 0,    "rps": 0 }
  ],
  "notes": "timeout/dns/tls/http4xx/http5xx の分布とキャッシュ/再試行の設定を明記"
}
```

## 最新結果（中央値）
- 自動集計: main ブランチの “Bench (M7 100k x3 matrix)” が各Runの summary.json を集約し、Step Summary に以下を出力します。
  - `values: rps1, rps2, rps3`
  - `median_rps: <number>`
  - `target_rps (100k<=15m): ~111.11 → PASS/FAIL`
- 判定基準: 100,000 行を 15 分以内（中央値RPS ≈ 111 以上）。
- 最新の中央値・判定は、当該ワークフローRunの Step Summary を参照してください（Artifacts を開かなくても確認可能）。

補足: ダミー `example.com` 生成＋NXDOMAIN多数の条件では、環境・ネット状況でrpsが変動します。プリセット（low/high latency）を用いて安定化してください。

## ヒント
- ボトルネック切り分け: `--http`/`--doh` を個別にオンにして影響を分離
- 負荷制御: `qps` と `qpsBurst` を併用（瞬間バーストと平滑化のバランス）
- 進捗オーバーヘッド削減: `progressIntervalMs` を 1000ms 以上に設定
- タイムアウト/再試行: ネット状況に応じて `timeoutMs` とリトライ回数（将来拡張）を調整
 - DoHキャッシュ: summary の `[dns] hit_rate` を参考にQPS/タイムアウトを調整

## DoD との対応
- 本ドキュメントに沿って 10 万行×3 回の中央値を取得し、NFR を満たす値を README の実測セクションに追記してください。
