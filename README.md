# DNSweeper

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
npm start -- analyze sample.csv --http-check
```

注記: `prestart`/`postinstall` により自動ビルドされます（`dist` 生成）。

## グローバルCLIとして利用
```sh
npm link       # 管理者権限が必要な環境あり

# ヘルプ
dnsweeper --help

# 解析（サンプル）
dnsweeper analyze sample.csv --http-check
```

## 開発（TSダイレクト実行）
```sh
npm run dev    # ts-node/esm で起動
```

## 進捗記録
- 最新の進捗は [instructions/PROGRESS.md](instructions/PROGRESS.md) を参照
