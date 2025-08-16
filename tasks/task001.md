# task001.md — DNSweeper MVP 着手ブリーフ（M0–M1）

## 目的

DNSweeper の **M0（雛形）〜M1（CSVパーサ＆正規化）** を、Node.js 20+ / TypeScriptで実装して動作させる。
最終的に以下コマンドが通ること：

* `dnsweeper --version` が表示される
* `dnsweeper import <csv>` が **Cloudflare/Route53/Generic** を自動判定し、正規化JSONを出力する
* 失敗行は `errors.csv` に切り出される

## 技術条件

* パッケージマネージャ: **pnpm**
* モジュール: **ESM**
* ビルド: **tsup**
* テスト: **Vitest**
* Lint/Format: **eslint + @typescript-eslint + prettier**
* CI: GitHub Actions（Node 20/22 matrix）

## 生成するリポジトリ構成

```
dnsweeper/
  packages/dnsweeper/
    src/
      cli/
        index.ts
        commands/
          import.ts
      core/
        parsers/
          detect.ts
          provider-detect.ts
          cloudflare.ts
          route53.ts
          generic.ts
          errors.ts
        config/
          schema.ts
      types.ts
    tests/
      unit/
        parser-cloudflare.test.ts
        parser-route53.test.ts
        parser-generic.test.ts
      fixtures/
        cloudflare-small.csv
        route53-small.csv
        generic-small.csv
    bin/dnsweeper
    package.json
    tsconfig.json
    tsup.config.ts
    .eslintrc.cjs
    .prettierrc
  package.json            # pnpm workspace ルート
  pnpm-workspace.yaml
  .github/workflows/ci.yml
  README.md
```

## ファイル作成指示（要点）

* `bin/dnsweeper`:

  ```bash
  #!/usr/bin/env node
  import('../dist/cli/index.js');
  ```

  実行属性を付与。
* `src/cli/index.ts`: Commander で `--version/--help` と `import` コマンドを登録。
* `src/cli/commands/import.ts`:

  * 入力: `<file> [--provider <p>] [--encoding <enc>] [--out <path>]`
  * 流れ: エンコ検出 → プロバイダ検出/上書き → ストリームでパース → 正規化 `CsvRecord[]` JSON を出力 → 失敗行は `errors.csv`。
* `src/core/parsers/detect.ts`: BOM/utf8/sjis/改行を判定。
* `src/core/parsers/provider-detect.ts`: 先頭数行のヘッダから `cloudflare|route53|generic` を返す。
* `src/core/parsers/{cloudflare,route53,generic}.ts`: 各CSVを `CsvRecord` に正規化。末尾ドット除去、数値TTL、CF `proxied`、R53 `AliasTarget` 正規化。
* `src/core/parsers/errors.ts`: 失敗行を収集し CSV 書き出し。
* `src/core/config/schema.ts`: `dnsweeper.config.(json|ts)` ローダ（zod）雛形。M1では読み取りだけ用意。
* `src/types.ts`: 仕様書の型定義をそのまま実装。
* ルート/パッケージ `package.json`: scripts を下記に合わせて定義。
* `tests/fixtures/*.csv`: 小さなサンプルを配置（数行でOK）。

## `package.json`（packages/dnsweeper）の必須 scripts

```json
{
  "scripts": {
    "build": "tsup src/cli/index.ts --format esm --dts --sourcemap --clean",
    "lint": "eslint .",
    "format": "prettier -w .",
    "test": "vitest run",
    "dev": "tsx src/cli/index.ts"
  },
  "bin": { "dnsweeper": "bin/dnsweeper" },
  "type": "module"
}
```

## 受け入れ基準（DoD）

* `pnpm i && pnpm -w -r build` が成功する
* `node packages/dnsweeper/bin/dnsweeper --version` がバージョン文字列を出す
* 次の3ケースで **正規化JSON** が生成され、行数が入力と一致、失敗行は `errors.csv` に分離される

  1. `dnsweeper import packages/dnsweeper/tests/fixtures/cloudflare-small.csv`
  2. `dnsweeper import packages/dnsweeper/tests/fixtures/route53-small.csv`
  3. `dnsweeper import packages/dnsweeper/tests/fixtures/generic-small.csv --provider generic`
* `CsvRecord` プロパティ（`name,type,content?,ttl?,proxied?,aliasTarget?`）が妥当な型で出力される
* CI（lint/test/build）が緑

## テスト観点（最低限）

* Cloudflare: `proxied=true/false` を boolean で取り込む
* Route53: `AliasTarget` を `aliasTarget` へ、`Value` の末尾ドット除去
* Generic: 未知ヘッダはマッピングエラーとして `errors.csv` に落ちる
* SJIS/UTF8 with BOM の取り込み
* 巨大ファイルを想定したストリーム処理（ユニットは小規模、実装はストリームAPI）

## 非スコープ（M0–M1ではやらない）

* DoH 解析、HTTP プローブ、ルール評価、XLSX 出力、進捗メトリクス

## 実行手順（codex向け）

1. リポジトリを上記構成で生成し、必要ファイルを作成
2. `pnpm i` → `pnpm -w -r build`
3. `node packages/dnsweeper/bin/dnsweeper --help` でコマンド定義を確認
4. 3つのfixtureで `dnsweeper import` を実行し JSON/`errors.csv` を検証
5. Vitest を実行しパーサ単体テストが緑であることを確認
6. 変更をコミットし CI を通す

---

