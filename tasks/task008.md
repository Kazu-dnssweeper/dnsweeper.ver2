# M8: パッケージング & リリース運用（配布体制の整備）

## Goal
- npm 配布可能な状態（SemVer/CHANGELOG/Releaseノート）でタグごとに自動配布できる。

## Scope（FR/NFR）
- FR: npm パッケージ公開、`bin/dnsweeper` のグローバル実行、`npm i -g`/`pnpm add -g` 動作確認
- NFR: セマンティックバージョニング、リリース手順の再現性、署名付きタグ、ライセンス明確化

## Deliverables
- npm 公開（scope 有無は判断）/ `npm publish` CI（手動トリガー）
- `CHANGELOG.md`（conventional commits or changesets）
- `RELEASING.md`（タグ運用/pre-release/撤回手順）
- `LICENSE`/`SECURITY.md`/`CODE_OF_CONDUCT.md` の整備

## Tasks
- [ ] `bin`/shebang/改行コードの最終確認（Win/macOS/Linux）
- [ ] `package.json` の `files`/`exports`/`bin` 整理（不要物を除外）
- [ ] Release CI（workflow_dispatch で publish / dry-run）
- [ ] conventional commits or changesets の導入と CHANGELOG 自動生成
- [ ] ライセンス表記と依存ライセンスの確認
- [ ] README にインストール/アップグレード/アンインストール手順を追記

## Definition of Done
- タグ vX.Y.Z で CI が publish → インストール/起動が3OSで確認できる
- CHANGELOG が自動更新され、配布物に不要ファイルが含まれない
